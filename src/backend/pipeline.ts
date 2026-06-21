declare const spindle: import("lumiverse-spindle-types").SpindleAPI;

import type { LMBProfile, LMBSettings, LMBEntryMeta } from "../shared";
import type { BusyEntry, FailureRecord, PendingPreview } from "../types";
import type { ChatMessage } from "./coverage";
import { approximateTokensFromChars, buildArcHeader, buildChapterHeader } from "../shared";
import {
  buildCoverage,
  computeCoverageStats,
  isExcluded,
  pickUncoveredTail,
  selectNextChapterWindow,
  syncHiddenForCoveredMessages,
} from "./coverage";
import { createChapterEntry, deleteEntry, ensureBookForChat, invalidateBookCache, listLmbEntries, patchEntryMeta, type LMBEntry } from "./world-book";
import { loadSettings } from "./storage";
import {
  AbortedSummarizerError,
  FatalSummarizerError,
  assembleArcPrompt,
  assembleChapterPrompt,
  summarizeArc,
  summarizeChapter,
  type DryRunAssembly,
  type SummarizationResult,
} from "./summarizer";
import { describeError, info, warn } from "./runtime";
import { publishChapterCreated, publishArcCreated } from "./hooks";
import { pickPhrase } from "./memoria";
import { ensureForkAdoption } from "./fork";

type ChatMessageDTO = ChatMessage;

const inflight = new Map<string, BusyEntry>();
const busyByUser = new Map<string, BusyEntry[]>();
const aborters = new Map<string, AbortController>();
const progressLastPush = new Map<string, number>();
interface ProgressState { kind: BusyKind; chars: number; thinkingChars: number; userId: string; chatId: string }
const progressState = new Map<string, ProgressState>();
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
const HEARTBEAT_INTERVAL_MS = 1000;
const failureByChat = new Map<string, FailureRecord>();
const previewsByChat = new Map<string, PendingPreview[]>();
const committingDrafts = new Set<string>();

const PROGRESS_PUSH_INTERVAL_MS = 250;

const commitChain = new Map<string, Promise<unknown>>();
function withCommitMutex<T>(userId: string, chatId: string, tier: 1 | 2, fn: () => Promise<T>): Promise<T> {
  const key = `${userId}::${chatId}::t${tier}`;
  const prev = commitChain.get(key) ?? Promise.resolve();
  const tail = prev.then(fn, fn);
  const guarded = tail.catch(() => undefined);
  commitChain.set(key, guarded);
  guarded.then(() => {
    if (commitChain.get(key) === guarded) commitChain.delete(key);
  });
  return tail;
}
const FAILURE_MAP_CAP = 500;
const PREVIEW_MAP_CAP = 500;

function capMap<K, V>(map: Map<K, V>, cap: number): void {
  while (map.size > cap) {
    const oldest = map.keys().next().value as K | undefined;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
}
type BusyKind = BusyEntry["kind"];

function busyKey(userId: string, chatId: string, kind: BusyKind): string {
  return `${userId}::${chatId}::${kind}`;
}

function chatKey(userId: string, chatId: string): string {
  return `${userId}::${chatId}`;
}

export interface PipelineCallbacks {
  onBusyChange(userId: string, entries: BusyEntry[]): void;
  onToast(userId: string, tone: "success" | "info" | "warn" | "error", text: string): void;
  onStateChange(userId: string, chatId: string): void;
}

let cb: PipelineCallbacks | null = null;
export function registerPipelineCallbacks(c: PipelineCallbacks): void {
  cb = c;
}

function setBusy(userId: string, chatId: string, kind: BusyKind, label: string): boolean {
  const key = busyKey(userId, chatId, kind);
  if (inflight.has(key)) return false;
  const entry: BusyEntry = { kind, chatId, label, startedAt: Date.now() };
  inflight.set(key, entry);
  progressState.set(key, { kind, chars: 0, thinkingChars: 0, userId, chatId });
  const list = busyByUser.get(userId) ?? [];
  list.push(entry);
  busyByUser.set(userId, list);
  cb?.onBusyChange(userId, list.slice());
  ensureHeartbeat();
  return true;
}

function clearBusy(userId: string, chatId: string, kind: BusyKind): void {
  const key = busyKey(userId, chatId, kind);
  inflight.delete(key);
  aborters.delete(key);
  progressLastPush.delete(key);
  progressState.delete(key);
  const fresh: BusyEntry[] = [];
  for (const k of inflight.keys()) {
    if (!k.startsWith(`${userId}::`)) continue;
    const found = inflight.get(k);
    if (found) fresh.push(found);
  }
  busyByUser.set(userId, fresh);
  cb?.onBusyChange(userId, fresh.slice());
}

export function registerAborter(userId: string, chatId: string, kind: BusyKind, controller: AbortController): void {
  aborters.set(busyKey(userId, chatId, kind), controller);
}

export function abortBusy(userId: string, chatId: string, kind: BusyKind): boolean {
  const controller = aborters.get(busyKey(userId, chatId, kind));
  if (!controller) return false;
  controller.abort();
  return true;
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m${rem.toString().padStart(2, "0")}s`;
}

function chapterBusyLabel(chars: number, thinkingChars: number, elapsedMs: number): string {
  const tokens = approximateTokensFromChars(chars);
  const thinkTokens = approximateTokensFromChars(thinkingChars);
  const t = formatElapsed(elapsedMs);
  if (tokens === 0 && thinkTokens === 0) return `Memoria is filing a chapter (${t})`;
  if (tokens === 0 && thinkTokens > 0) return `Memoria is thinking (~${thinkTokens} tokens, ${t})`;
  if (thinkTokens > 0) return `Memoria is ~${tokens} tokens into a chapter (~${thinkTokens} thinking, ${t})`;
  return `Memoria is ~${tokens} tokens into a chapter (${t})`;
}

function arcBusyLabel(chars: number, thinkingChars: number, elapsedMs: number): string {
  const tokens = approximateTokensFromChars(chars);
  const thinkTokens = approximateTokensFromChars(thinkingChars);
  const t = formatElapsed(elapsedMs);
  if (tokens === 0 && thinkTokens === 0) return `Memoria is binding an arc (${t})`;
  if (tokens === 0 && thinkTokens > 0) return `Memoria is thinking (~${thinkTokens} tokens, ${t})`;
  if (thinkTokens > 0) return `Memoria is ~${tokens} tokens into an arc (~${thinkTokens} thinking, ${t})`;
  return `Memoria is ~${tokens} tokens into an arc (${t})`;
}

function formatBusyLabel(state: ProgressState, elapsedMs: number): string {
  if (state.kind === "arc") return arcBusyLabel(state.chars, state.thinkingChars, elapsedMs);
  return chapterBusyLabel(state.chars, state.thinkingChars, elapsedMs);
}

function ensureHeartbeat(): void {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    if (progressState.size === 0) {
      if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
      return;
    }
    const touched = new Set<string>();
    for (const [key, ps] of progressState) {
      const entry = inflight.get(key);
      if (!entry) continue;
      const elapsed = Date.now() - entry.startedAt;
      entry.label = formatBusyLabel(ps, elapsed);
      touched.add(ps.userId);
    }
    for (const userId of touched) {
      const list = busyByUser.get(userId) ?? [];
      cb?.onBusyChange(userId, list.slice());
    }
  }, HEARTBEAT_INTERVAL_MS);
}

function updateProgressNumbers(userId: string, chatId: string, kind: BusyKind, chars: number, thinkingChars: number): void {
  const key = busyKey(userId, chatId, kind);
  const ps = progressState.get(key);
  if (!ps) return;
  ps.chars = chars;
  ps.thinkingChars = thinkingChars;
  const entry = inflight.get(key);
  if (!entry) return;
  const now = Date.now();
  const last = progressLastPush.get(key) ?? 0;
  if (now - last < PROGRESS_PUSH_INTERVAL_MS) return;
  progressLastPush.set(key, now);
  entry.label = formatBusyLabel(ps, now - entry.startedAt);
  const list = busyByUser.get(userId) ?? [];
  cb?.onBusyChange(userId, list.slice());
}

function updateBusyProgress(userId: string, chatId: string, kind: BusyKind, label: string, force = false): void {
  const key = busyKey(userId, chatId, kind);
  const entry = inflight.get(key);
  if (!entry) return;
  const now = Date.now();
  const last = progressLastPush.get(key) ?? 0;
  if (!force && now - last < PROGRESS_PUSH_INTERVAL_MS) return;
  progressLastPush.set(key, now);
  entry.label = label;
  const list = busyByUser.get(userId) ?? [];
  cb?.onBusyChange(userId, list.slice());
}

export function getBusy(userId: string): BusyEntry[] {
  return (busyByUser.get(userId) ?? []).slice();
}

export function getLastFailure(userId: string, chatId: string): FailureRecord | null {
  return failureByChat.get(chatKey(userId, chatId)) ?? null;
}

export function clearLastFailure(userId: string, chatId: string): void {
  failureByChat.delete(chatKey(userId, chatId));
}

export function getPendingPreviews(userId: string, chatId: string): PendingPreview[] {
  return (previewsByChat.get(chatKey(userId, chatId)) ?? []).slice();
}

export function findPendingPreview(userId: string, chatId: string, draftId: string): PendingPreview | null {
  return (previewsByChat.get(chatKey(userId, chatId)) ?? []).find((p) => p.draftId === draftId) ?? null;
}

export function dropPendingPreview(userId: string, chatId: string, draftId: string): void {
  const list = previewsByChat.get(chatKey(userId, chatId)) ?? [];
  previewsByChat.set(chatKey(userId, chatId), list.filter((p) => p.draftId !== draftId));
}

export function patchPendingPreview(
  userId: string,
  chatId: string,
  draftId: string,
  patch: { title?: string; content?: string },
): void {
  const key = chatKey(userId, chatId);
  const list = previewsByChat.get(key) ?? [];
  const idx = list.findIndex((p) => p.draftId === draftId);
  if (idx === -1) return;
  const old = list[idx]!;
  list[idx] = {
    ...old,
    title: patch.title !== undefined ? patch.title : old.title,
    content: patch.content !== undefined ? patch.content : old.content,
  };
  previewsByChat.set(key, list);
}

function pushPreview(userId: string, chatId: string, preview: PendingPreview): void {
  const key = chatKey(userId, chatId);
  const existing = previewsByChat.get(key);
  if (existing) {
    previewsByChat.delete(key);
    existing.push(preview);
    previewsByChat.set(key, existing);
  } else {
    previewsByChat.set(key, [preview]);
  }
  capMap(previewsByChat, PREVIEW_MAP_CAP);
}

async function runWithRetry<T>(
  attempts: number,
  fn: () => Promise<T>,
  onRetry: (attemptNum: number, err: unknown) => void,
): Promise<{ ok: true; value: T } | { ok: false; err: unknown; retries: number }> {
  let lastErr: unknown = null;
  const tries = Math.max(1, attempts);
  for (let i = 0; i < tries; i++) {
    try {
      const v = await fn();
      return { ok: true, value: v };
    } catch (err) {
      lastErr = err;
      if (err instanceof FatalSummarizerError || err instanceof AbortedSummarizerError) {
        return { ok: false, err, retries: i };
      }
      if (i < tries - 1) onRetry(i + 1, err);
    }
  }
  return { ok: false, err: lastErr, retries: tries - 1 };
}

function recordFailure(userId: string, chatId: string, kind: BusyKind, retries: number, err: unknown): void {
  const key = chatKey(userId, chatId);
  if (failureByChat.has(key)) failureByChat.delete(key);
  failureByChat.set(key, {
    kind,
    message: describeError(err),
    retriedTimes: retries,
    at: Date.now(),
  });
  capMap(failureByChat, FAILURE_MAP_CAP);
}

function nyaaToast(userId: string, kind: "fire" | "retry" | "success" | "fail" | "arc_fire" | "arc_success"): void {
  if (!cb) return;
  const tone = kind === "fail" ? "error" : kind === "retry" ? "warn" : kind === "success" || kind === "arc_success" ? "success" : "info";
  cb.onToast(userId, tone, pickPhrase(kind));
}

export async function createChapterAuto(
  chatId: string,
  profile: LMBProfile,
  settings: LMBSettings,
  userId: string,
): Promise<string | null> {
  if (!setBusy(userId, chatId, "chapter", "Memoria is filing a chapter")) return null;
  try {
    const messages = await spindle.chat.getMessages(chatId);
    if (!messages || messages.length === 0) return null;
    const coverage = await buildCoverage(chatId, userId);
    const stats = computeCoverageStats(messages, coverage, profile);
    if (!stats.lagSatisfied || !stats.windowAvailable) return null;
    const uncoveredTail = pickUncoveredTail(messages, coverage);
    const window = selectNextChapterWindow(uncoveredTail, profile);
    if (window.length === 0) return null;
    return await runChapter(chatId, profile, settings, userId, messages, window);
  } finally {
    clearBusy(userId, chatId, "chapter");
  }
}

export async function createChapterFromRange(
  chatId: string,
  messageIds: string[],
  profile: LMBProfile,
  settings: LMBSettings,
  userId: string,
  opts: { replacesEntryId?: string } = {},
): Promise<string | null> {
  if (!setBusy(userId, chatId, "chapter", "Memoria is filing a chapter")) return null;
  try {
    const messages = await spindle.chat.getMessages(chatId);
    if (!messages.length) return null;
    const set = new Set(messageIds);
    const window = messages.filter((m) => set.has(m.id) && !isExcluded(m));
    if (window.length === 0) return null;
    return await runChapter(chatId, profile, settings, userId, messages, window, opts.replacesEntryId);
  } finally {
    clearBusy(userId, chatId, "chapter");
  }
}

async function runChapter(
  chatId: string,
  profile: LMBProfile,
  settings: LMBSettings,
  userId: string,
  allMessages: ChatMessageDTO[],
  window: ChatMessageDTO[],
  replacesEntryId?: string,
): Promise<string | null> {
  nyaaToast(userId, "fire");
  const entries = await listLmbEntries(chatId, userId);
  const coverage = await buildCoverage(chatId, userId, entries);
  const chapters = coverage.activeEntries
    .filter((e) => e.meta.tier === 1 && typeof e.meta.firstMsgIdx === "number")
    .sort((a, b) => (a.meta.firstMsgIdx as number) - (b.meta.firstMsgIdx as number));
  const previousMemories = profile.previousMemoriesCount > 0
    ? chapters.slice(-profile.previousMemoriesCount)
    : [];
  const provisionalSceneNumber = await nextSceneNumber(chatId, 1, userId);
  const opener = buildChapterHeader(provisionalSceneNumber, window.length);

  const outcome = await runWithRetry(profile.retryCount + 1, async () => {
    const controller = new AbortController();
    registerAborter(userId, chatId, "chapter", controller);
    try {
      return await summarizeChapter(
        profile, settings.customPresets, chatId, window, previousMemories, userId, opener,
        {
          externalSignal: controller.signal,
          onProgress: (chars, thinking) => updateProgressNumbers(userId, chatId, "chapter", chars, thinking),
        },
      );
    } finally {
      aborters.delete(busyKey(userId, chatId, "chapter"));
    }
  }, (n, err) => {
    warn(`chapter attempt ${n} failed: ${describeError(err)}`);
    nyaaToast(userId, "retry");
  });

  if (!outcome.ok) {
    if (outcome.err instanceof AbortedSummarizerError) {
      cb?.onToast(userId, "info", "Memoria sets the pen down");
      cb?.onStateChange(userId, chatId);
      return null;
    }
    recordFailure(userId, chatId, "chapter", outcome.retries, outcome.err);
    nyaaToast(userId, "fail");
    cb?.onStateChange(userId, chatId);
    return null;
  }
  clearLastFailure(userId, chatId);

  const result = outcome.value;
  const firstIdx = allMessages.findIndex((m) => m.id === window[0]!.id);
  const lastIdx = allMessages.findIndex((m) => m.id === window[window.length - 1]!.id);

  if (profile.showMemoryPreviews) {
    const draft: PendingPreview = makePreview("chapter", chatId, window, result, firstIdx, lastIdx, replacesEntryId);
    pushPreview(userId, chatId, draft);
    cb?.onStateChange(userId, chatId);
    return null;
  }
  try {
    const entryId = await commitChapter(chatId, profile, userId, window, result, firstIdx, lastIdx, allMessages, false, replacesEntryId);
    nyaaToast(userId, "success");
    return entryId;
  } catch (err) {
    warn(`commitChapter failed: ${describeError(err)}`);
    recordFailure(userId, chatId, "chapter", 0, err);
    nyaaToast(userId, "fail");
    cb?.onStateChange(userId, chatId);
    return null;
  }
}

async function commitChapter(
  chatId: string,
  profile: LMBProfile,
  userId: string,
  window: ChatMessageDTO[],
  result: SummarizationResult,
  firstIdx: number,
  lastIdx: number,
  allMessages: ChatMessageDTO[],
  fromPreview: boolean,
  replacesEntryId?: string,
): Promise<string> {
  return withCommitMutex(userId, chatId, 1, async () => {
  const freshEntries = await listLmbEntries(chatId, userId);
  const entriesForCoverage = replacesEntryId
    ? freshEntries.filter((e) => e.raw.id !== replacesEntryId)
    : freshEntries;
  const freshCoverage = await buildCoverage(chatId, userId, entriesForCoverage);
  const validWindow = window.filter((m) => !freshCoverage.coveredBy.has(m.id));
  if (validWindow.length === 0) {
    throw new Error("All messages in this window were just bound by another chapter");
  }
  if (validWindow.length < window.length) {
    window = validWindow;
    const validIds = new Set(validWindow.map((m) => m.id));
    firstIdx = allMessages.findIndex((m) => validIds.has(m.id));
    lastIdx = -1;
    for (let i = allMessages.length - 1; i >= 0; i--) {
      if (validIds.has(allMessages[i]!.id)) { lastIdx = i; break; }
    }
  }
  const book = await ensureBookForChat(chatId, userId);
  // On regenerate, keep the replaced chapter's scene number so a mid-list
  // regen doesn't jump to the end (nextSceneNumber returns max+1, and the
  // entry being replaced still exists at this point).
  const replacedEntry = replacesEntryId ? freshEntries.find((e) => e.raw.id === replacesEntryId) : undefined;
  const sceneNumber = typeof replacedEntry?.meta.sceneNumber === "number"
    ? replacedEntry.meta.sceneNumber
    : await nextSceneNumber(chatId, 1, userId);
  const title = fromPreview
    ? (result.title?.trim() || `Chapter - msgs ${firstIdx + 1}-${lastIdx + 1}`)
    : deriveTitle(result, firstIdx + 1, lastIdx + 1);
  const msgIds = window.map((m) => m.id);
  const meta: LMBEntryMeta = {
    tier: 1,
    chatId,
    msgIds,
    firstMsgIdx: firstIdx >= 0 ? firstIdx : undefined,
    lastMsgIdx: lastIdx >= 0 ? lastIdx : undefined,
    tokenCountInput: window.reduce((acc, m) => acc + approximateTokensFromChars((m.content || "").length), 0),
    tokenCountOutput: result.usageCompletionTokens || approximateTokensFromChars(result.content.length),
    model: result.model,
    connectionId: result.connectionId,
    createdAt: Date.now(),
    title,
    shortComment: result.shortComment,
    presetKey: result.presetKey,
    sceneNumber,
    rawOutput: result.rawOutput,
  };
  const baseComment = meta.title ?? `Chapter - msgs ${(firstIdx + 1)}-${(lastIdx + 1)}`;
  const comment = `#${sceneNumber} - ${baseComment}`;
  const settings = await loadSettings(userId);
  const opener = buildChapterHeader(sceneNumber, msgIds.length);
  const finalContent = `${opener}\n\n${result.content}`;
  const entry = await createChapterEntry(book.id, meta, finalContent, comment, userId, result.keywords ?? [], settings.forceConstantEntries);
  invalidateBookCache(userId, chatId);

  if (replacesEntryId) {
    try {
      await deleteEntry(replacesEntryId, userId);
      invalidateBookCache(userId, chatId);
    } catch (err) {
      warn(`regen: failed to delete replaced chapter ${replacesEntryId}: ${describeError(err)}`);
    }
  }

  if (profile.hideCoveredMessages) {
    try {
      await syncHiddenForCoveredMessages(
        chatId,
        allMessages,
        {
          coveredBy: new Map(window.map((m) => [m.id, entry.id])),
          activeEntries: [],
          arcs: [],
          chapters: [],
        },
        userId,
        true,
      );
    } catch (err) {
      warn(`setMessagesHidden failed: ${describeError(err)}`);
    }
  }
  publishChapterCreated(userId, {
    chatId,
    chapterEntryId: entry.id,
    bookId: book.id,
    sourceMessageIds: meta.msgIds,
    summaryText: finalContent,
    model: result.model,
    title: meta.title,
  });
  cb?.onStateChange(userId, chatId);
  return entry.id;
  });
}

export async function createArcAuto(
  chatId: string,
  profile: LMBProfile,
  settings: LMBSettings,
  userId: string,
): Promise<string | null> {
  if (!setBusy(userId, chatId, "arc", "Memoria is binding an arc")) return null;
  try {
    const entries = await listLmbEntries(chatId, userId);
    const coverage = await buildCoverage(chatId, userId, entries);
    const chapters = coverage.activeEntries
      .filter((e) => e.meta.tier === 1 && !e.meta.isRoot)
      .sort((a, b) => (a.meta.firstMsgIdx ?? 0) - (b.meta.firstMsgIdx ?? 0));
    if (chapters.length === 0) return null;
    let selected: LMBEntry[] = [];
    if (profile.arcTrigger === "chapters") {
      const compressible = Math.max(0, chapters.length - profile.arcLagChapters);
      if (compressible < profile.arcAfterChapters) return null;
      selected = chapters.slice(0, compressible).slice(0, profile.arcAfterChapters);
    } else if (profile.arcTrigger === "tokens") {
      const reservedFromTail: LMBEntry[] = [];
      let reservedTokens = 0;
      for (let i = chapters.length - 1; i >= 0 && reservedTokens < profile.arcLagTokens; i--) {
        reservedFromTail.unshift(chapters[i]!);
        reservedTokens += chapters[i]!.meta.tokenCountOutput;
      }
      const reservedSet = new Set(reservedFromTail.map((c) => c.raw.id));
      const compressible = chapters.filter((c) => !reservedSet.has(c.raw.id));
      const compressibleTokens = compressible.reduce((a, c) => a + c.meta.tokenCountOutput, 0);
      if (compressibleTokens < profile.arcAfterTokens) return null;
      const take: LMBEntry[] = [];
      let acc = 0;
      for (const ch of compressible) {
        take.push(ch);
        acc += ch.meta.tokenCountOutput;
        if (acc >= profile.arcAfterTokens) break;
      }
      selected = take;
    } else {
      return null;
    }
    if (selected.length === 0) return null;
    return await runArc(chatId, profile, settings, userId, selected);
  } finally {
    clearBusy(userId, chatId, "arc");
  }
}

export async function createArcFromChapters(
  chatId: string,
  chapterEntryIds: string[],
  profile: LMBProfile,
  settings: LMBSettings,
  userId: string,
  opts: { replacesEntryId?: string } = {},
): Promise<string | null> {
  if (!setBusy(userId, chatId, "arc", "Memoria is binding an arc")) return null;
  try {
    const entries = await listLmbEntries(chatId, userId);
    const entriesForSelection = opts.replacesEntryId
      ? entries.filter((e) => e.raw.id !== opts.replacesEntryId)
      : entries;
    const coverage = await buildCoverage(chatId, userId, entriesForSelection);
    const wanted = new Set(chapterEntryIds);
    const chapters = coverage.activeEntries
      .filter((e) => e.meta.tier === 1 && wanted.has(e.raw.id))
      .sort((a, b) => (a.meta.firstMsgIdx ?? 0) - (b.meta.firstMsgIdx ?? 0));
    if (chapters.length === 0) return null;
    return await runArc(chatId, profile, settings, userId, chapters, opts.replacesEntryId);
  } finally {
    clearBusy(userId, chatId, "arc");
  }
}

async function runArc(
  chatId: string,
  profile: LMBProfile,
  settings: LMBSettings,
  userId: string,
  selected: LMBEntry[],
  replacesEntryId?: string,
): Promise<string | null> {
  nyaaToast(userId, "arc_fire");
  const totalTurns = selected.reduce((acc, c) => acc + c.meta.msgIds.length, 0);
  const provisionalSceneNumber = await nextSceneNumber(chatId, 2, userId);
  const opener = buildArcHeader(provisionalSceneNumber, selected.length, totalTurns);
  const outcome = await runWithRetry(profile.retryCount + 1, async () => {
    const controller = new AbortController();
    registerAborter(userId, chatId, "arc", controller);
    try {
      return await summarizeArc(
        profile, settings.customPresets, chatId, selected, userId, opener,
        {
          externalSignal: controller.signal,
          onProgress: (chars, thinking) => updateProgressNumbers(userId, chatId, "arc", chars, thinking),
        },
      );
    } finally {
      aborters.delete(busyKey(userId, chatId, "arc"));
    }
  }, (n, err) => {
    warn(`arc attempt ${n} failed: ${describeError(err)}`);
    nyaaToast(userId, "retry");
  });

  if (!outcome.ok) {
    if (outcome.err instanceof AbortedSummarizerError) {
      cb?.onToast(userId, "info", "Memoria sets the pen down");
      cb?.onStateChange(userId, chatId);
      return null;
    }
    recordFailure(userId, chatId, "arc", outcome.retries, outcome.err);
    nyaaToast(userId, "fail");
    cb?.onStateChange(userId, chatId);
    return null;
  }
  clearLastFailure(userId, chatId);

  const result = outcome.value;
  const firstIdxs = selected.map((c) => c.meta.firstMsgIdx).filter((n): n is number => typeof n === "number");
  const lastIdxs = selected.map((c) => c.meta.lastMsgIdx).filter((n): n is number => typeof n === "number");
  const firstIdx = firstIdxs.length ? Math.min(...firstIdxs) : 0;
  const lastIdx = lastIdxs.length ? Math.max(...lastIdxs) : firstIdx;

  if (profile.showMemoryPreviews) {
    const draft = makeArcPreview(chatId, selected, result, firstIdx, lastIdx, replacesEntryId);
    pushPreview(userId, chatId, draft);
    cb?.onStateChange(userId, chatId);
    return null;
  }
  try {
    const entryId = await commitArc(chatId, userId, selected, result, firstIdx, lastIdx, replacesEntryId);
    nyaaToast(userId, "arc_success");
    return entryId;
  } catch (err) {
    warn(`commitArc failed: ${describeError(err)}`);
    recordFailure(userId, chatId, "arc", 0, err);
    nyaaToast(userId, "fail");
    cb?.onStateChange(userId, chatId);
    return null;
  }
}

async function commitArc(
  chatId: string,
  userId: string,
  selected: LMBEntry[],
  result: SummarizationResult,
  firstIdx: number,
  lastIdx: number,
  replacesEntryId?: string,
): Promise<string> {
  return withCommitMutex(userId, chatId, 2, async () => {
  const freshEntries = await listLmbEntries(chatId, userId);
  const entriesForCoverage = replacesEntryId
    ? freshEntries.filter((e) => e.raw.id !== replacesEntryId)
    : freshEntries;
  const freshCoverage = await buildCoverage(chatId, userId, entriesForCoverage);
  const stillActive = new Set(freshCoverage.activeEntries.filter((e) => e.meta.tier === 1).map((e) => e.raw.id));
  const filtered = selected.filter((c) => stillActive.has(c.raw.id));
  if (filtered.length === 0) {
    throw new Error("All source chapters were already bound by another arc or deleted");
  }
  if (filtered.length < selected.length) {
    selected = filtered;
    const firstIdxs = selected.map((c) => c.meta.firstMsgIdx).filter((n): n is number => typeof n === "number");
    const lastIdxs = selected.map((c) => c.meta.lastMsgIdx).filter((n): n is number => typeof n === "number");
    firstIdx = firstIdxs.length ? Math.min(...firstIdxs) : 0;
    lastIdx = lastIdxs.length ? Math.max(...lastIdxs) : firstIdx;
  }
  const book = await ensureBookForChat(chatId, userId);
  // On regenerate, keep the replaced arc's scene number (see commitChapter).
  const replacedArc = replacesEntryId ? freshEntries.find((e) => e.raw.id === replacesEntryId) : undefined;
  const sceneNumber = typeof replacedArc?.meta.sceneNumber === "number"
    ? replacedArc.meta.sceneNumber
    : await nextSceneNumber(chatId, 2, userId);
  const msgIds = selected.flatMap((c) => c.meta.msgIds);
  const sourceChapterEntryIds = selected.map((c) => c.raw.id);
  const isRootArc = selected.length > 0 && selected.every((c) => c.meta.isRoot);
  const rootOrigin = isRootArc ? selected.find((c) => c.meta.rootOrigin)?.meta.rootOrigin : undefined;
  if (!isRootArc && selected.some((c) => c.meta.isRoot)) {
    const own = selected.filter((c) => !c.meta.isRoot);
    const fs = own.map((c) => c.meta.firstMsgIdx).filter((n): n is number => typeof n === "number");
    const ls = own.map((c) => c.meta.lastMsgIdx).filter((n): n is number => typeof n === "number");
    if (fs.length) firstIdx = Math.min(...fs);
    else if (firstIdx < 0) firstIdx = 0;
    if (ls.length) lastIdx = Math.max(...ls);
    else if (lastIdx < firstIdx) lastIdx = firstIdx;
  }
  const arcTitle = isRootArc
    ? (result.title?.trim() || "Inherited Arc")
    : deriveTitle(result, firstIdx + 1, lastIdx + 1);
  const meta: LMBEntryMeta = {
    tier: 2,
    chatId,
    msgIds,
    sourceChapterEntryIds,
    firstMsgIdx: firstIdx,
    lastMsgIdx: lastIdx,
    tokenCountInput: selected.reduce((a, c) => a + c.meta.tokenCountOutput, 0),
    tokenCountOutput: result.usageCompletionTokens || approximateTokensFromChars(result.content.length),
    model: result.model,
    connectionId: result.connectionId,
    createdAt: Date.now(),
    title: arcTitle,
    shortComment: result.shortComment,
    presetKey: result.presetKey,
    sceneNumber,
    rawOutput: result.rawOutput,
    ...(isRootArc ? { isRoot: true, rootOrigin } : {}),
  };
  const baseComment = meta.title ?? `Arc - msgs ${(firstIdx + 1)}-${(lastIdx + 1)}`;
  const comment = `${isRootArc ? "[Root] " : ""}Arc #${sceneNumber} - ${baseComment}`;
  const arcSettings = await loadSettings(userId);
  const arcOpener = buildArcHeader(sceneNumber, sourceChapterEntryIds.length, msgIds.length);
  const finalArcContent = `${arcOpener}\n\n${result.content}`;
  const arcEntry = await createChapterEntry(book.id, meta, finalArcContent, comment, userId, result.keywords ?? [], arcSettings.forceConstantEntries);
  const failedSupersedes: string[] = [];
  for (const ch of selected) {
    try {
      await patchEntryMeta(ch, { supersededByEntryId: arcEntry.id }, userId);
    } catch (err) {
      failedSupersedes.push(ch.raw.id);
      warn(`failed to mark chapter ${ch.raw.id} superseded by arc ${arcEntry.id}: ${describeError(err)}`);
    }
  }
  if (failedSupersedes.length > 0) {
    cb?.onToast(
      userId,
      "warn",
      `Memoria's arc is shelved but ${failedSupersedes.length} chapter${failedSupersedes.length === 1 ? "" : "s"} resisted being marked superseded`,
    );
  }
  invalidateBookCache(userId, chatId);
  if (replacesEntryId) {
    try {
      await deleteEntry(replacesEntryId, userId);
      invalidateBookCache(userId, chatId);
    } catch (err) {
      warn(`regen: failed to delete replaced arc ${replacesEntryId}: ${describeError(err)}`);
    }
  }
  publishArcCreated(userId, {
    chatId,
    arcEntryId: arcEntry.id,
    bookId: book.id,
    sourceChapterEntryIds: selected.map((c) => c.raw.id),
    sourceMessageIds: msgIds,
    summaryText: finalArcContent,
    model: result.model,
    title: meta.title,
  });
  cb?.onStateChange(userId, chatId);
  return arcEntry.id;
  });
}

export async function acceptPreview(
  chatId: string,
  draftId: string,
  profile: LMBProfile,
  userId: string,
): Promise<string | null> {
  const preview = findPendingPreview(userId, chatId, draftId);
  if (!preview) return null;
  const guardKey = `${userId}::${chatId}::${draftId}`;
  if (committingDrafts.has(guardKey)) return null;
  committingDrafts.add(guardKey);
  try {
    if (preview.kind === "chapter") {
      const messages = await spindle.chat.getMessages(chatId);
      const acceptEntries = preview.replacesEntryId
        ? (await listLmbEntries(chatId, userId)).filter((e) => e.raw.id !== preview.replacesEntryId)
        : undefined;
      const coverage = await buildCoverage(chatId, userId, acceptEntries);
      const intent = new Set(preview.sourceMessageIds);
      const window = messages.filter((m) => intent.has(m.id) && !coverage.coveredBy.has(m.id) && !isExcluded(m));
      if (window.length === 0) {
        dropPendingPreview(userId, chatId, draftId);
        cb?.onToast(userId, "warn", "Memoria can't save this chapter - its messages were deleted or already filed by another chapter");
        cb?.onStateChange(userId, chatId);
        return null;
      }
      if (window.length < preview.sourceMessageIds.length) {
        cb?.onToast(userId, "warn", "Memoria notes some messages went missing or were already covered, saving what is left");
      }
      const firstIdx = messages.findIndex((m) => m.id === window[0]!.id);
      const lastIdx = messages.findIndex((m) => m.id === window[window.length - 1]!.id);
      const fakeResult: SummarizationResult = {
        rawOutput: preview.content,
        title: preview.title,
        opener: "",
        content: preview.content,
        keywords: [],
        shortComment: preview.shortComment,
        usagePromptTokens: preview.tokenCountInput,
        usageCompletionTokens: preview.tokenCountOutput,
        model: preview.model,
        connectionId: preview.connectionId,
        presetKey: preview.presetKey,
      };
      try {
        const entryId = await commitChapter(
          chatId, profile, userId, window, fakeResult,
          firstIdx, lastIdx, messages, true, preview.replacesEntryId,
        );
        dropPendingPreview(userId, chatId, draftId);
        nyaaToast(userId, "success");
        cb?.onStateChange(userId, chatId);
        return entryId;
      } catch (err) {
        recordFailure(userId, chatId, "chapter", 0, err);
        nyaaToast(userId, "fail");
        cb?.onStateChange(userId, chatId);
        return null;
      }
    }
    const entries = await listLmbEntries(chatId, userId);
    const arcSelectionEntries = preview.replacesEntryId
      ? entries.filter((e) => e.raw.id !== preview.replacesEntryId)
      : entries;
    const coverage = await buildCoverage(chatId, userId, arcSelectionEntries);
    const wanted = new Set(preview.sourceChapterEntryIds ?? []);
    const selected = coverage.activeEntries.filter((e) => e.meta.tier === 1 && wanted.has(e.raw.id));
    if (selected.length === 0) {
      dropPendingPreview(userId, chatId, draftId);
      cb?.onToast(userId, "warn", "Memoria can't save this arc, all source chapters were deleted or already bound by another arc");
      cb?.onStateChange(userId, chatId);
      return null;
    }
    const fakeResult: SummarizationResult = {
      rawOutput: preview.content,
      title: preview.title,
      opener: "",
      content: preview.content,
      keywords: [],
      shortComment: preview.shortComment,
      usagePromptTokens: preview.tokenCountInput,
      usageCompletionTokens: preview.tokenCountOutput,
      model: preview.model,
      connectionId: preview.connectionId,
      presetKey: preview.presetKey,
    };
    try {
      const entryId = await commitArc(
        chatId, userId, selected, fakeResult,
        preview.firstMsgIdx ?? 0, preview.lastMsgIdx ?? 0, preview.replacesEntryId,
      );
      dropPendingPreview(userId, chatId, draftId);
      nyaaToast(userId, "arc_success");
      cb?.onStateChange(userId, chatId);
      return entryId;
    } catch (err) {
      recordFailure(userId, chatId, "arc", 0, err);
      nyaaToast(userId, "fail");
      cb?.onStateChange(userId, chatId);
      return null;
    }
  } finally {
    committingDrafts.delete(guardKey);
  }
}

const CHAPTER_BACKLOG_CAP = 500;
const ARC_BACKLOG_CAP = 100;

export async function drainChapterBacklog(
  chatId: string,
  profile: LMBProfile,
  settings: LMBSettings,
  userId: string,
): Promise<number> {
  let made = 0;
  for (let i = 0; i < CHAPTER_BACKLOG_CAP; i++) {
    const created = await createChapterAuto(chatId, profile, settings, userId).catch((err) => {
      warn(`createChapterAuto failed: ${describeError(err)}`);
      return null;
    });
    if (!created) break;
    made++;
  }
  return made;
}

export async function dryRunChapter(
  chatId: string,
  profile: LMBProfile,
  settings: LMBSettings,
  userId: string,
): Promise<DryRunAssembly> {
  const messages = await spindle.chat.getMessages(chatId);
  if (!messages || messages.length === 0) throw new Error("Chat has no messages");
  const entries = await listLmbEntries(chatId, userId);
  const coverage = await buildCoverage(chatId, userId, entries);
  const uncoveredTail = pickUncoveredTail(messages, coverage);
  const window = selectNextChapterWindow(uncoveredTail, profile);
  if (window.length === 0) {
    throw new Error("No window available. Increase the chat length or lower the lag and window thresholds.");
  }
  const chapters = coverage.activeEntries
    .filter((e) => e.meta.tier === 1 && typeof e.meta.firstMsgIdx === "number")
    .sort((a, b) => (a.meta.firstMsgIdx as number) - (b.meta.firstMsgIdx as number));
  const previousMemories = profile.previousMemoriesCount > 0
    ? chapters.slice(-profile.previousMemoriesCount)
    : [];
  const provisionalSceneNumber = await nextSceneNumber(chatId, 1, userId);
  const opener = buildChapterHeader(provisionalSceneNumber, window.length);
  return assembleChapterPrompt(profile, settings.customPresets, chatId, window, previousMemories, userId, opener);
}

export async function dryRunArc(
  chatId: string,
  profile: LMBProfile,
  settings: LMBSettings,
  userId: string,
): Promise<DryRunAssembly> {
  const entries = await listLmbEntries(chatId, userId);
  const coverage = await buildCoverage(chatId, userId, entries);
  const chapters = coverage.activeEntries
    .filter((e) => e.meta.tier === 1 && !e.meta.isRoot)
    .sort((a, b) => (a.meta.firstMsgIdx ?? 0) - (b.meta.firstMsgIdx ?? 0));
  if (chapters.length === 0) throw new Error("No chapters to bind. File a few chapters first.");
  const totalTurns = chapters.reduce((acc, c) => acc + c.meta.msgIds.length, 0);
  const provisionalSceneNumber = await nextSceneNumber(chatId, 2, userId);
  const opener = buildArcHeader(provisionalSceneNumber, chapters.length, totalTurns);
  return assembleArcPrompt(profile, settings.customPresets, chatId, chapters, userId, opener);
}

export async function drainArcBacklog(
  chatId: string,
  profile: LMBProfile,
  settings: LMBSettings,
  userId: string,
): Promise<number> {
  if (profile.arcTrigger === "manual") return 0;
  let made = 0;
  for (let i = 0; i < ARC_BACKLOG_CAP; i++) {
    const created = await createArcAuto(chatId, profile, settings, userId).catch((err) => {
      warn(`createArcAuto failed: ${describeError(err)}`);
      return null;
    });
    if (!created) break;
    made++;
  }
  return made;
}

export async function maybeRunPipeline(
  chatId: string,
  profile: LMBProfile,
  settings: LMBSettings,
  userId: string,
): Promise<void> {
  if (!profile.autoCreate) return;
  await ensureForkAdoption(chatId, userId).catch(() => {});
  if (profile.autoCreateChapter) {
    await drainChapterBacklog(chatId, profile, settings, userId);
  }
  await maybeRunArcCheck(chatId, profile, settings, userId);
}

export async function maybeRunArcCheck(
  chatId: string,
  profile: LMBProfile,
  settings: LMBSettings,
  userId: string,
): Promise<void> {
  if (!profile.autoCreate) return;
  if (!profile.autoCreateArc) return;
  if (profile.arcTrigger === "manual") return;
  await drainArcBacklog(chatId, profile, settings, userId);
}

async function nextSceneNumber(chatId: string, tier: 1 | 2, userId: string): Promise<number> {
  const entries = await listLmbEntries(chatId, userId).catch(() => [] as LMBEntry[]);
  let max = 0;
  for (const e of entries) {
    if (e.meta.tier !== tier) continue;
    if (e.meta.isRoot) continue;
    const n = e.meta.sceneNumber;
    if (typeof n === "number" && n > max) max = n;
  }
  return max + 1;
}

function deriveTitle(result: SummarizationResult, firstMsg: number, lastMsg: number): string {
  if (result.title && result.title.trim()) return `${result.title.trim()} (msgs ${firstMsg}-${lastMsg})`;
  const firstLine = (result.content.split(/\n+/, 1)[0] || "").trim();
  const firstSentence = firstLine.split(/(?<=[.!?])\s/, 1)[0] || firstLine;
  const trimmed = firstSentence.slice(0, 60).trim();
  if (trimmed) return `${trimmed}${trimmed.length === 60 ? "..." : ""} (msgs ${firstMsg}-${lastMsg})`;
  return `Compressed - msgs ${firstMsg}-${lastMsg}`;
}

function makePreview(
  kind: "chapter" | "arc",
  chatId: string,
  window: ChatMessageDTO[],
  result: SummarizationResult,
  firstIdx: number,
  lastIdx: number,
  replacesEntryId?: string,
): PendingPreview {
  void chatId;
  return {
    kind,
    draftId: `draft_${kind}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    title: result.title || `Chapter - msgs ${firstIdx + 1}-${lastIdx + 1}`,
    content: result.content,
    shortComment: result.shortComment,
    sourceMessageIds: window.map((m) => m.id),
    model: result.model,
    connectionId: result.connectionId,
    tokenCountInput: result.usagePromptTokens || 0,
    tokenCountOutput: result.usageCompletionTokens || 0,
    firstMsgIdx: firstIdx,
    lastMsgIdx: lastIdx,
    presetKey: result.presetKey,
    replacesEntryId,
  };
}

function makeArcPreview(
  chatId: string,
  selected: LMBEntry[],
  result: SummarizationResult,
  firstIdx: number,
  lastIdx: number,
  replacesEntryId?: string,
): PendingPreview {
  void chatId;
  return {
    kind: "arc",
    draftId: `draft_arc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    title: result.title || `Arc - msgs ${firstIdx + 1}-${lastIdx + 1}`,
    content: result.content,
    shortComment: result.shortComment,
    sourceMessageIds: selected.flatMap((c) => c.meta.msgIds),
    sourceChapterEntryIds: selected.map((c) => c.raw.id),
    model: result.model,
    connectionId: result.connectionId,
    tokenCountInput: result.usagePromptTokens || 0,
    tokenCountOutput: result.usageCompletionTokens || 0,
    firstMsgIdx: firstIdx,
    lastMsgIdx: lastIdx,
    presetKey: result.presetKey,
    replacesEntryId,
  };
}

void info;
