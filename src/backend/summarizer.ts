declare const spindle: import("lumiverse-spindle-types").SpindleAPI;

import type { ConnectionProfileDTO, LlmMessageDTO } from "lumiverse-spindle-types";
import type { LMBProfile, CustomPreset } from "../shared";
import { SAMPLER_DEFAULTS } from "../shared";
import type { ChatMessage } from "./coverage";
import type { LMBEntry } from "./world-book";
import { applySelectedRegex } from "./regex";
import { describeError, warn } from "./runtime";
import { BUILTIN_ARC_PRESETS, BUILTIN_CHAPTER_PRESETS, BUILTIN_VOLUME_PRESETS } from "./presets";

type ChatMessageDTO = ChatMessage;

const CONNECTION_CACHE_TTL_MS = 5000;
const connectionCache = new Map<string, { connections: ConnectionProfileDTO[]; expiresAt: number }>();

export async function listConnections(userId: string): Promise<ConnectionProfileDTO[]> {
  const cached = connectionCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.connections;
  const fresh = await spindle.connections.list(userId).catch((err) => {
    warn(`failed to list connections: ${describeError(err)}`);
    return [] as ConnectionProfileDTO[];
  });
  connectionCache.set(userId, { connections: fresh, expiresAt: Date.now() + CONNECTION_CACHE_TTL_MS });
  return fresh;
}

export function invalidateConnectionsCache(userId: string): void {
  connectionCache.delete(userId);
}

export async function resolveConnection(
  profile: LMBProfile,
  userId: string,
): Promise<ConnectionProfileDTO | null> {
  const list = await listConnections(userId);
  if (list.length === 0) return null;
  let picked: ConnectionProfileDTO | null = null;
  if (profile.connectionId) {
    picked = list.find((c) => c.id === profile.connectionId) ?? null;
  }
  if (!picked) picked = list.find((c) => c.is_default) ?? null;
  if (!picked) picked = list[0] ?? null;
  if (!picked) return null;
  const modelStr = typeof picked.model === "string" ? picked.model : "";
  if (!modelStr.trim()) {
    throw new FatalSummarizerError(
      `Connection "${picked.name || picked.id}" has no model set, pick one in its settings`,
    );
  }
  return picked;
}

export class FatalSummarizerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FatalSummarizerError";
  }
}

export function findPresetText(profile: LMBProfile, customPresets: CustomPreset[], category: "chapter" | "arc" | "volume"): string {
  const key = category === "arc" ? profile.arcPresetKey : category === "volume" ? profile.volumePresetKey : profile.chapterPresetKey;
  const builtIns = category === "arc" ? BUILTIN_ARC_PRESETS : category === "volume" ? BUILTIN_VOLUME_PRESETS : BUILTIN_CHAPTER_PRESETS;
  const custom = customPresets.find((p) => p.key === key && p.category === category);
  if (custom) return custom.prompt;
  const builtIn = builtIns.find((p) => p.key === key);
  if (builtIn) return builtIn.prompt;
  return builtIns[0]?.prompt ?? "";
}

export function renderTranscript(messages: ChatMessageDTO[], includeIndex = true): string {
  const lines: string[] = [];
  messages.forEach((m, idx) => {
    const role = m.role === "user" ? "USER" : m.role === "assistant" ? "ASSISTANT" : "SYSTEM";
    const content = (m.content || "").trim();
    if (!content) return;
    const head = includeIndex ? `<<${role} #${idx + 1}>>` : `<<${role}>>`;
    lines.push(`${head}\n${content}`);
  });
  return lines.join("\n\n");
}

export interface SummarizationResult {
  rawOutput: string;
  title: string;
  content: string;
  keywords: string[];
  shortComment: string;
  usagePromptTokens: number;
  usageCompletionTokens: number;
  model: string;
  connectionId: string;
  presetKey: string;
}

interface BuildOpts {
  systemPromptTemplate: string;
  previousMemoriesBlock: string;
  bodyHeading: string;
  body: string;
}

function buildMessages(opts: BuildOpts): { system: string; user: string } {
  const system = opts.systemPromptTemplate;
  const user = [opts.previousMemoriesBlock, opts.bodyHeading, opts.body].filter(Boolean).join("\n\n");
  return { system, user };
}

function buildSamplerParameters(profile: LMBProfile): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const s = profile.samplers;
  out["temperature"] = s.temperature ?? SAMPLER_DEFAULTS.temperature;
  out["max_tokens"] = s.max_tokens ?? SAMPLER_DEFAULTS.max_tokens;
  out["max_context_length"] = s.max_input_tokens ?? SAMPLER_DEFAULTS.max_input_tokens;
  if (s.top_p !== null) out["top_p"] = s.top_p;
  if (s.top_k !== null) out["top_k"] = s.top_k;
  if (s.frequency_penalty !== null) out["frequency_penalty"] = s.frequency_penalty;
  if (s.presence_penalty !== null) out["presence_penalty"] = s.presence_penalty;
  return out;
}

interface StreamedGeneration {
  content: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

export interface StreamOptions {
  externalSignal: AbortSignal;
  onProgress?: (chars: number, thinkingChars: number) => void;
}

export class AbortedSummarizerError extends Error {
  constructor() {
    super("Aborted by user");
    this.name = "AbortedSummarizerError";
  }
}

async function runStreamingGeneration(
  conn: ConnectionProfileDTO,
  messages: LlmMessageDTO[],
  profile: LMBProfile,
  userId: string,
  options: StreamOptions,
): Promise<StreamedGeneration> {
  const ttftMs = Math.max(1, profile.ttftTimeoutSecs) * 1000;
  const controller = new AbortController();
  let firstTokenSeen = false;
  let ttftFired = false;
  let externalAborted = options.externalSignal.aborted;
  const onExternalAbort = (): void => {
    externalAborted = true;
    controller.abort();
  };
  if (externalAborted) controller.abort();
  else options.externalSignal.addEventListener("abort", onExternalAbort);
  const ttftTimer = setTimeout(() => {
    if (!firstTokenSeen) {
      ttftFired = true;
      controller.abort();
    }
  }, ttftMs);

  let aggregated = "";
  let thinkingChars = 0;
  let usage: StreamedGeneration["usage"];

  try {
    const request = buildGenerateRequest(conn, messages, profile, userId, controller.signal);
    const stream = spindle.generate.rawStream(request);
    for await (const chunk of stream) {
      if (chunk.type === "token" || chunk.type === "reasoning") {
        if (!firstTokenSeen) {
          firstTokenSeen = true;
          clearTimeout(ttftTimer);
        }
        if (chunk.type === "token") {
          aggregated += chunk.token;
        } else {
          thinkingChars += chunk.token.length;
        }
        options.onProgress?.(aggregated.length, thinkingChars);
        continue;
      }
      if (chunk.type === "done") {
        if (externalAborted) throw new AbortedSummarizerError();
        if (chunk.content) aggregated = chunk.content;
        usage = chunk.usage;
        options.onProgress?.(aggregated.length, thinkingChars);
        return { content: aggregated, usage };
      }
    }
    if (externalAborted) throw new AbortedSummarizerError();
    if (!aggregated.trim()) throw new Error("The stream ended before completing");
    return { content: aggregated, usage };
  } catch (err) {
    if (externalAborted) throw new AbortedSummarizerError();
    if (ttftFired) {
      throw new Error(`No token within ${Math.round(ttftMs / 1000)}s, the provider may be slow or unreachable`);
    }
    throw err;
  } finally {
    clearTimeout(ttftTimer);
    options.externalSignal.removeEventListener("abort", onExternalAbort);
  }
}

function buildGenerateRequest(
  conn: ConnectionProfileDTO,
  messages: LlmMessageDTO[],
  profile: LMBProfile,
  userId: string,
  signal: AbortSignal,
): Parameters<typeof spindle.generate.raw>[0] {
  const baseParams = buildSamplerParameters(profile);
  const effectiveModel = (conn.model ?? "").trim();
  const parameters: Record<string, unknown> = { ...baseParams };
  if (effectiveModel) parameters["model"] = effectiveModel;
  return {
    type: "raw",
    messages,
    connection_id: conn.id,
    ...(effectiveModel ? { model: effectiveModel } : {}),
    ...(Object.keys(parameters).length > 0 ? { parameters } : {}),
    userId,
    signal,
  } as Parameters<typeof spindle.generate.raw>[0];
}

function buildPreviousMemoriesBlock(previous: LMBEntry[]): string {
  if (previous.length === 0) return "";
  const lines = ["<<PREVIOUS MEMORIES (for context, do not rewrite)>>"];
  previous.forEach((p) => {
    lines.push(p.raw.content);
  });
  return lines.join("\n\n");
}

async function resolveSystemMacros(text: string, chatId: string, userId: string): Promise<string> {
  if (!text.includes("{{")) return text;
  try {
    const result = await spindle.macros.resolve(text, { chatId, userId, commit: false });
    return result.text;
  } catch (err) {
    warn(`macros.resolve failed, sending unresolved system: ${describeError(err)}`);
    return text;
  }
}

export interface DryRunAssembly {
  messages: Array<{ role: "system" | "user"; content: string }>;
  diagnostics: Array<{ message: string }>;
}

async function resolveMacrosWithDiagnostics(
  text: string,
  chatId: string,
  userId: string,
  diagnostics: Array<{ message: string }>,
): Promise<string> {
  if (!text.includes("{{")) return text;
  try {
    const result = await spindle.macros.resolve(text, { chatId, userId, commit: false });
    for (const d of result.diagnostics) {
      diagnostics.push({ message: `macro: ${d.message} (offset ${d.offset}, length ${d.length})` });
    }
    return result.text;
  } catch (err) {
    diagnostics.push({ message: `macros.resolve failed: ${describeError(err)}` });
    return text;
  }
}

export async function assembleChapterPrompt(
  profile: LMBProfile,
  customPresets: CustomPreset[],
  chatId: string,
  messages: ChatMessageDTO[],
  previousMemories: LMBEntry[],
  userId: string,
): Promise<DryRunAssembly> {
  const conn = await resolveConnection(profile, userId);
  if (!conn) throw new FatalSummarizerError("No connection available for Memoria");

  const presetText = findPresetText(profile, customPresets, "chapter");
  if (!presetText) throw new Error("Chapter preset missing");

  const transcript = renderTranscript(messages, true);
  if (!transcript.trim()) throw new Error("Empty transcript");

  const built = buildMessages({
    systemPromptTemplate: presetText,
    previousMemoriesBlock: buildPreviousMemoriesBlock(previousMemories),
    bodyHeading: "<<SCENE TO SUMMARIZE>>",
    body: transcript,
  });

  const samplerParams = buildSamplerParameters(profile);
  const diagnostics: Array<{ message: string }> = [
    { message: `Connection: ${conn.name} (${conn.provider}/${conn.model})` },
    { message: `Window: ${messages.length} message(s)` },
    { message: `Previous memories included: ${previousMemories.length}` },
    { message: `Preset key: ${profile.chapterPresetKey}` },
    { message: `Sampler parameters being sent on the wire: ${JSON.stringify(samplerParams)}` },
  ];

  const resolvedSystem = await resolveMacrosWithDiagnostics(built.system, chatId, userId, diagnostics);
  const outgoingUser = await applySelectedRegex(built.user, profile.regexOutgoingScriptIds, userId);
  if (profile.regexOutgoingScriptIds.length > 0) {
    diagnostics.push({ message: `Outgoing regex applied: ${profile.regexOutgoingScriptIds.length} script(s)` });
  }

  return {
    messages: [
      { role: "system", content: resolvedSystem },
      { role: "user", content: outgoingUser },
    ],
    diagnostics,
  };
}

export async function assembleArcPrompt(
  profile: LMBProfile,
  customPresets: CustomPreset[],
  chatId: string,
  chapters: LMBEntry[],
  userId: string,
): Promise<DryRunAssembly> {
  const conn = await resolveConnection(profile, userId);
  if (!conn) throw new FatalSummarizerError("No connection available for Memoria");

  const presetText = findPresetText(profile, customPresets, "arc");
  if (!presetText) throw new Error("Arc preset missing");

  const body = chapters
    .map((c, idx) => `<<CHAPTER ${idx + 1}: ${c.raw.comment || c.meta.title || "untitled"}>>\n${c.raw.content}`)
    .join("\n\n");

  const built = buildMessages({
    systemPromptTemplate: presetText,
    previousMemoriesBlock: "",
    bodyHeading: "<<CHAPTERS TO CONSOLIDATE>>",
    body,
  });

  const samplerParams = buildSamplerParameters(profile);
  const diagnostics: Array<{ message: string }> = [
    { message: `Connection: ${conn.name} (${conn.provider}/${conn.model})` },
    { message: `Source chapters: ${chapters.length}` },
    { message: `Preset key: ${profile.arcPresetKey}` },
    { message: `Sampler parameters being sent on the wire: ${JSON.stringify(samplerParams)}` },
  ];

  const resolvedSystem = await resolveMacrosWithDiagnostics(built.system, chatId, userId, diagnostics);
  const outgoingUser = await applySelectedRegex(built.user, profile.regexOutgoingScriptIds, userId);
  if (profile.regexOutgoingScriptIds.length > 0) {
    diagnostics.push({ message: `Outgoing regex applied: ${profile.regexOutgoingScriptIds.length} script(s)` });
  }

  return {
    messages: [
      { role: "system", content: resolvedSystem },
      { role: "user", content: outgoingUser },
    ],
    diagnostics,
  };
}

export async function assembleVolumePrompt(
  profile: LMBProfile,
  customPresets: CustomPreset[],
  chatId: string,
  arcs: LMBEntry[],
  userId: string,
): Promise<DryRunAssembly> {
  const conn = await resolveConnection(profile, userId);
  if (!conn) throw new FatalSummarizerError("No connection available for Memoria");

  const presetText = findPresetText(profile, customPresets, "volume");
  if (!presetText) throw new Error("Volume preset missing");

  const body = arcs
    .map((a, idx) => `<<ARC ${idx + 1}: ${a.raw.comment || a.meta.title || "untitled"}>>\n${a.raw.content}`)
    .join("\n\n");

  const built = buildMessages({
    systemPromptTemplate: presetText,
    previousMemoriesBlock: "",
    bodyHeading: "<<ARCS TO CONSOLIDATE>>",
    body,
  });

  const samplerParams = buildSamplerParameters(profile);
  const diagnostics: Array<{ message: string }> = [
    { message: `Connection: ${conn.name} (${conn.provider}/${conn.model})` },
    { message: `Source arcs: ${arcs.length}` },
    { message: `Preset key: ${profile.volumePresetKey}` },
    { message: `Sampler parameters being sent on the wire: ${JSON.stringify(samplerParams)}` },
  ];

  const resolvedSystem = await resolveMacrosWithDiagnostics(built.system, chatId, userId, diagnostics);
  const outgoingUser = await applySelectedRegex(built.user, profile.regexOutgoingScriptIds, userId);
  if (profile.regexOutgoingScriptIds.length > 0) {
    diagnostics.push({ message: `Outgoing regex applied: ${profile.regexOutgoingScriptIds.length} script(s)` });
  }

  return {
    messages: [
      { role: "system", content: resolvedSystem },
      { role: "user", content: outgoingUser },
    ],
    diagnostics,
  };
}

export async function summarizeVolume(
  profile: LMBProfile,
  customPresets: CustomPreset[],
  chatId: string,
  arcs: LMBEntry[],
  userId: string,
  streamOptions: StreamOptions,
): Promise<SummarizationResult> {
  const conn = await resolveConnection(profile, userId);
  if (!conn) throw new FatalSummarizerError("No connection available for Memoria");

  const presetText = findPresetText(profile, customPresets, "volume");
  if (!presetText) throw new Error("Volume preset missing");

  const body = arcs
    .map((a, idx) => `<<ARC ${idx + 1}: ${a.raw.comment || a.meta.title || "untitled"}>>\n${a.raw.content}`)
    .join("\n\n");

  const built = buildMessages({
    systemPromptTemplate: presetText,
    previousMemoriesBlock: "",
    bodyHeading: "<<ARCS TO CONSOLIDATE>>",
    body,
  });

  const resolvedSystem = await resolveSystemMacros(built.system, chatId, userId);
  const outgoingUser = await applySelectedRegex(built.user, profile.regexOutgoingScriptIds, userId);

  const llmMessages: LlmMessageDTO[] = [
    { role: "system", content: resolvedSystem },
    { role: "user", content: outgoingUser },
  ];

  const result = await runStreamingGeneration(conn, llmMessages, profile, userId, streamOptions);

  const rawText = (result.content || "").trim();
  if (!rawText) throw new Error("Empty model output");
  const processed = await applySelectedRegex(rawText, profile.regexIncomingScriptIds, userId);
  const parsed = parseSummaryJson(processed);
  if (!parsed.content.trim()) throw new Error("The volume summary came back empty");
  return {
    rawOutput: rawText,
    title: parsed.title,
    content: parsed.content,
    keywords: parsed.keywords,
    shortComment: parsed.shortComment,
    usagePromptTokens: result.usage?.prompt_tokens ?? 0,
    usageCompletionTokens: result.usage?.completion_tokens ?? 0,
    model: conn.model,
    connectionId: conn.id,
    presetKey: profile.volumePresetKey,
  };
}

export async function summarizeChapter(
  profile: LMBProfile,
  customPresets: CustomPreset[],
  chatId: string,
  messages: ChatMessageDTO[],
  previousMemories: LMBEntry[],
  userId: string,
  streamOptions: StreamOptions,
): Promise<SummarizationResult> {
  const conn = await resolveConnection(profile, userId);
  if (!conn) throw new FatalSummarizerError("No connection available for Memoria");

  const presetText = findPresetText(profile, customPresets, "chapter");
  if (!presetText) throw new Error("Chapter preset missing");

  const transcript = renderTranscript(messages, true);
  if (!transcript.trim()) throw new Error("Empty transcript");

  const built = buildMessages({
    systemPromptTemplate: presetText,
    previousMemoriesBlock: buildPreviousMemoriesBlock(previousMemories),
    bodyHeading: "<<SCENE TO SUMMARIZE>>",
    body: transcript,
  });

  const resolvedSystem = await resolveSystemMacros(built.system, chatId, userId);
  const outgoingUser = await applySelectedRegex(built.user, profile.regexOutgoingScriptIds, userId);

  const llmMessages: LlmMessageDTO[] = [
    { role: "system", content: resolvedSystem },
    { role: "user", content: outgoingUser },
  ];

  const result = await runStreamingGeneration(conn, llmMessages, profile, userId, streamOptions);

  const rawText = (result.content || "").trim();
  if (!rawText) throw new Error("Empty model output");
  const processed = await applySelectedRegex(rawText, profile.regexIncomingScriptIds, userId);

  const parsed = parseSummaryJson(processed);
  if (!parsed.content.trim()) throw new Error("The summary came back empty");
  return {
    rawOutput: rawText,
    title: parsed.title,
    content: parsed.content,
    keywords: parsed.keywords,
    shortComment: parsed.shortComment,
    usagePromptTokens: result.usage?.prompt_tokens ?? 0,
    usageCompletionTokens: result.usage?.completion_tokens ?? 0,
    model: conn.model,
    connectionId: conn.id,
    presetKey: profile.chapterPresetKey,
  };
}

export async function summarizeArc(
  profile: LMBProfile,
  customPresets: CustomPreset[],
  chatId: string,
  chapters: LMBEntry[],
  userId: string,
  streamOptions: StreamOptions,
): Promise<SummarizationResult> {
  const conn = await resolveConnection(profile, userId);
  if (!conn) throw new FatalSummarizerError("No connection available for Memoria");

  const presetText = findPresetText(profile, customPresets, "arc");
  if (!presetText) throw new Error("Arc preset missing");

  const body = chapters
    .map((c, idx) => `<<CHAPTER ${idx + 1}: ${c.raw.comment || c.meta.title || "untitled"}>>\n${c.raw.content}`)
    .join("\n\n");

  const built = buildMessages({
    systemPromptTemplate: presetText,
    previousMemoriesBlock: "",
    bodyHeading: "<<CHAPTERS TO CONSOLIDATE>>",
    body,
  });

  const resolvedSystem = await resolveSystemMacros(built.system, chatId, userId);
  const outgoingUser = await applySelectedRegex(built.user, profile.regexOutgoingScriptIds, userId);

  const llmMessages: LlmMessageDTO[] = [
    { role: "system", content: resolvedSystem },
    { role: "user", content: outgoingUser },
  ];

  const result = await runStreamingGeneration(conn, llmMessages, profile, userId, streamOptions);

  const rawText = (result.content || "").trim();
  if (!rawText) throw new Error("Empty model output");
  const processed = await applySelectedRegex(rawText, profile.regexIncomingScriptIds, userId);
  const parsed = parseSummaryJson(processed);
  if (!parsed.content.trim()) throw new Error("The arc summary came back empty");
  return {
    rawOutput: rawText,
    title: parsed.title,
    content: parsed.content,
    keywords: parsed.keywords,
    shortComment: parsed.shortComment,
    usagePromptTokens: result.usage?.prompt_tokens ?? 0,
    usageCompletionTokens: result.usage?.completion_tokens ?? 0,
    model: conn.model,
    connectionId: conn.id,
    presetKey: profile.arcPresetKey,
  };
}

interface ParsedSummary {
  title: string;
  content: string;
  keywords: string[];
  shortComment: string;
}

function parseSummaryJson(raw: string): ParsedSummary {
  const cleaned = stripThinkBlocks(raw);
  const normalized = normalizeText(cleaned);

  const candidates = collectJsonCandidates(normalized);
  let sawParseableObject = false;
  for (const cand of candidates) {
    const obj = tryParseJsonObject(cand);
    if (!obj) continue;
    sawParseableObject = true;
    const title = typeof obj["title"] === "string" ? (obj["title"] as string) : "";
    const contentRaw = obj["content"] ?? obj["summary"] ?? obj["memory_content"];
    if (typeof contentRaw !== "string") continue;
    const kw = obj["keywords"];
    const keywords = Array.isArray(kw) ? kw.filter((x): x is string => typeof x === "string") : [];
    const sc = typeof obj["short_comment"] === "string" ? (obj["short_comment"] as string) : "";
    return { title, content: contentRaw, keywords, shortComment: sc };
  }
  if (sawParseableObject) {
    throw new Error("The model's JSON had no content field");
  }
  throw new Error("The model didn't return valid JSON");
}

function stripThinkBlocks(raw: string): string {
  return raw.replace(/<(?:think(?:ing)?|reasoning)>[\s\S]*?<\/(?:think(?:ing)?|reasoning)>/gi, "");
}

function normalizeText(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/^\uFEFF/, "")
    .replace(/[\u200B-\u200D\u2060]/g, "")
    .trim();
}

function collectJsonCandidates(s: string): string[] {
  const out: string[] = [];
  for (const block of extractFencedBlocks(s)) out.push(block);
  out.push(s);
  const balanced = extractBalancedJson(s);
  if (balanced) out.push(balanced);
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const c of out) {
    if (!c) continue;
    if (seen.has(c)) continue;
    seen.add(c);
    uniq.push(c);
  }
  return uniq;
}

function extractFencedBlocks(s: string): string[] {
  const re = /```([\w-]*)\s*([\s\S]*?)```/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    out.push((m[2] || "").trim());
  }
  return out;
}

function extractBalancedJson(s: string): string | null {
  const startIdx = s.search(/[{[]/);
  if (startIdx === -1) return null;
  const open = s[startIdx];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = startIdx; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) { esc = false; }
      else if (ch === "\\") { esc = true; }
      else if (ch === "\"") { inStr = false; }
      continue;
    }
    if (ch === "\"") { inStr = true; continue; }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return s.slice(startIdx, i + 1).trim();
    }
  }
  return null;
}

function tryParseJsonObject(cand: string): Record<string, unknown> | null {
  const strict = tryJsonParse(cand);
  if (strict) return strict;
  return tryJsonParse(repairJson(cand));
}

function tryJsonParse(cand: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(cand) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    return v as Record<string, unknown>;
  } catch {
    return null;
  }
}

function repairJson(s: string): string {
  let out = "";
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (inStr) {
      out += ch;
      if (esc) { esc = false; }
      else if (ch === "\\") { esc = true; }
      else if (ch === "\"") { inStr = false; }
      continue;
    }
    if (ch === "\"") { inStr = true; out += ch; continue; }
    if (ch === "/" && s[i + 1] === "/") {
      while (i < s.length && s[i] !== "\n") i++;
      if (i < s.length) out += s[i];
      continue;
    }
    if (ch === "/" && s[i + 1] === "*") {
      i += 2;
      while (i < s.length - 1 && !(s[i] === "*" && s[i + 1] === "/")) i++;
      i += 1;
      continue;
    }
    if (ch === ",") {
      let j = i + 1;
      while (j < s.length && /\s/.test(s[j]!)) j++;
      if (s[j] === "}" || s[j] === "]") continue;
    }
    out += ch;
  }
  return out;
}
