declare const spindle: import("lumiverse-spindle-types").SpindleAPI;

import type { LMBProfile, LMBSettings, LMBEntryMeta } from "../shared";
import type { BusyEntry, FailureRecord, PendingPreview } from "../types";
import type { ChatMessage } from "./coverage";
import { approximateTokensFromChars } from "../shared";
import {
  buildCoverage,
  isExcluded,
  syncHiddenForCoveredMessages,
} from "./coverage";
import { createChapterEntry, deleteEntry, ensureBookForChat, invalidateBookCache, listLmbEntries, patchEntryMeta, type LMBEntry } from "./world-book";
import { loadSettings } from "./storage";
import { formatEntryName, savedMemoryContent } from "./naming";
import { inheritedStoryOrder, nextStoryOrder, storyOrderOf } from "./story-order";
import {
  AbortedSummarizerError,
  FatalSummarizerError,
  assembleArcPrompt,
  assembleVolumePrompt,
  summarizeArc,
  summarizeChapter,
  summarizeVolume,
  type DryRunAssembly,
  type SummarizationResult,
} from "./summarizer";
import { describeError, info, warn } from "./runtime";
import { publishChapterCreated, publishArcCreated, publishVolumeCreated } from "./hooks";
import { pickPhrase, type PhraseKind } from "./memoria";

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
function withCommitMutex<T>(userId: string, chatId: string, tier: 1 | 2 | 3, fn: () => Promise<T>): Promise<T> {
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

function volumeBusyLabel(chars: number, thinkingChars: number, elapsedMs: number): string {
  const tokens = approximateTokensFromChars(chars);
  const thinkTokens = approximateTokensFromChars(thinkingChars);
  const t = formatElapsed(elapsedMs);
  if (tokens === 0 && thinkTokens === 0) return `Memoria is pressing a volume (${t})`;
  if (tokens === 0 && thinkTokens > 0) return `Memoria is thinking (~${thinkTokens} tokens, ${t})`;
  if (thinkTokens > 0) return `Memoria is ~${tokens} tokens into a volume (~${thinkTokens} thinking, ${t})`;
  return `Memoria is ~${tokens} tokens into a volume (${t})`;
}

function formatBusyLabel(state: ProgressState, elapsedMs: number): string {
  if (state.kind === "arc") return arcBusyLabel(state.chars, state.thinkingChars, elapsedMs);
  if (state.kind === "volume") return volumeBusyLabel(state.chars, state.thinkingChars, elapsedMs);
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

function nyaaToast(userId: string, kind: PhraseKind): void {
  if (!cb) return;
  const tone = kind === "retry" ? "warn"
    : kind === "success" || kind === "arc_success" || kind === "volume_success" ? "success"
    : "info";
  cb.onToast(userId, tone, pickPhrase(kind));
}

function shortErrorText(err: unknown): string {
  const raw = describeError(err).replace(/\s+/g, " ").trim();
  const firstSentence = raw.split(/(?<=[.!?])\s/, 1)[0] || raw;
  const cleaned = firstSentence.replace(/;/g, ",");
  return cleaned.length > 160 ? `${cleaned.slice(0, 159)}…` : cleaned;
}

function failToast(userId: string, kind: BusyKind, err: unknown): void {
  const noun = kind === "arc" ? "bind the arc" : kind === "volume" ? "press the volume" : "file the chapter";
  cb?.onToast(userId, "error", `Memoria couldn't ${noun}: ${shortErrorText(err)}`);
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
    return await runChapter(chatId, profile, settings, userId, messages, window, { replacesEntryId: opts.replacesEntryId });
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
  opts: { replacesEntryId?: string } = {},
): Promise<string | null> {
  const { replacesEntryId } = opts;
  nyaaToast(userId, "fire");
  const entries = await listLmbEntries(chatId, userId);
  const coverage = await buildCoverage(chatId, userId, entries);
  const chapters = coverage.activeEntries
    .filter((e) => e.meta.tier === 1 && typeof e.meta.firstMsgIdx === "number")
    .sort((a, b) => storyOrderOf(a) - storyOrderOf(b));
  const previousMemories = profile.previousMemoriesCount > 0
    ? chapters.slice(-profile.previousMemoriesCount)
    : [];
  const outcome = await runWithRetry(profile.retryCount + 1, async () => {
    const controller = new AbortController();
    registerAborter(userId, chatId, "chapter", controller);
    try {
      return await summarizeChapter(
        profile, settings.customPresets, chatId, window, previousMemories, userId,
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
    failToast(userId, "chapter", outcome.err);
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
    failToast(userId, "chapter", err);
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
  const storyOrder = typeof replacedEntry?.meta.storyOrder === "number"
    ? replacedEntry.meta.storyOrder
    : nextStoryOrder(entriesForCoverage);
  const title = fromPreview
    ? (result.title?.trim() || `Chapter ${firstIdx + 1}-${lastIdx + 1}`)
    : deriveTitle(result);
  const msgIds = window.map((m) => m.id);
  const windowIdxs = window.map(chatMessageIndex).filter((n): n is number => typeof n === "number");
  const firstMsgIdx = windowIdxs.length ? Math.min(...windowIdxs) : firstIdx;
  const lastMsgIdx = windowIdxs.length ? Math.max(...windowIdxs) : lastIdx;
  const meta: LMBEntryMeta = {
    tier: 1,
    chatId,
    msgIds,
    firstMsgIdx: firstMsgIdx >= 0 ? firstMsgIdx : undefined,
    lastMsgIdx: lastMsgIdx >= 0 ? lastMsgIdx : undefined,
    tokenCountInput: window.reduce((acc, m) => acc + approximateTokensFromChars((m.content || "").length), 0),
    tokenCountOutput: result.usageCompletionTokens || approximateTokensFromChars(result.content.length),
    model: result.model,
    connectionId: result.connectionId,
    createdAt: Date.now(),
    title,
    shortComment: result.shortComment,
    presetKey: result.presetKey,
    sceneNumber,
    storyOrder,
    rawOutput: result.rawOutput,
  };
  const settings = await loadSettings(userId);
  const comment = await formatEntryName(settings, {
    chatId,
    userId,
    tier: "chapter",
    title: meta.title ?? "",
    sceneNumber,
    storyOrder,
    firstMsgIdx: meta.firstMsgIdx,
    lastMsgIdx: meta.lastMsgIdx,
    turnCount: msgIds.length,
  });
  const finalContent = savedMemoryContent(result.content);
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

  try {
    await syncHiddenForCoveredMessages(
      chatId,
      allMessages,
      {
        coveredBy: new Map(window.map((m) => [m.id, entry.id])),
        activeEntries: [],
        volumes: [],
        arcs: [],
        chapters: [],
      },
      userId,
      true,
      meta.lastMsgIdx,
    );
  } catch (err) {
    warn(`setMessagesHidden failed: ${describeError(err)}`);
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
      .sort((a, b) => storyOrderOf(a) - storyOrderOf(b));
    if (chapters.length === 0) return null;
    return await runArc(chatId, profile, settings, userId, chapters, { replacesEntryId: opts.replacesEntryId });
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
  opts: { replacesEntryId?: string } = {},
): Promise<string | null> {
  const { replacesEntryId } = opts;
  nyaaToast(userId, "arc_fire");
  const outcome = await runWithRetry(profile.retryCount + 1, async () => {
    const controller = new AbortController();
    registerAborter(userId, chatId, "arc", controller);
    try {
      return await summarizeArc(
        profile, settings.customPresets, chatId, selected, userId,
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
    failToast(userId, "arc", outcome.err);
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
    const draft = makeGroupPreview("arc", selected, result, firstIdx, lastIdx, replacesEntryId);
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
    failToast(userId, "arc", err);
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
  const storyOrder = typeof replacedArc?.meta.storyOrder === "number"
    ? replacedArc.meta.storyOrder
    : inheritedStoryOrder(selected, entriesForCoverage);
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
    : deriveTitle(result);
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
    storyOrder,
    rawOutput: result.rawOutput,
    ...(isRootArc ? { isRoot: true, rootOrigin } : {}),
  };
  const arcSettings = await loadSettings(userId);
  const comment = await formatEntryName(arcSettings, {
    chatId,
    userId,
    tier: "arc",
    title: meta.title ?? "",
    sceneNumber,
    storyOrder,
    firstMsgIdx: meta.firstMsgIdx,
    lastMsgIdx: meta.lastMsgIdx,
    sourceCount: sourceChapterEntryIds.length,
    turnCount: msgIds.length,
    isRoot: isRootArc,
  });
  const finalArcContent = savedMemoryContent(result.content);
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
      `The arc saved but ${failedSupersedes.length} chapter${failedSupersedes.length === 1 ? "" : "s"} couldn't be marked superseded`,
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

export async function createVolumeFromArcs(
  chatId: string,
  arcEntryIds: string[],
  profile: LMBProfile,
  settings: LMBSettings,
  userId: string,
  opts: { replacesEntryId?: string } = {},
): Promise<string | null> {
  if (!setBusy(userId, chatId, "volume", "Memoria is pressing a volume")) return null;
  try {
    const entries = await listLmbEntries(chatId, userId);
    const entriesForSelection = opts.replacesEntryId
      ? entries.filter((e) => e.raw.id !== opts.replacesEntryId)
      : entries;
    const coverage = await buildCoverage(chatId, userId, entriesForSelection);
    const wanted = new Set(arcEntryIds);
    const arcs = coverage.activeEntries
      .filter((e) => e.meta.tier === 2 && wanted.has(e.raw.id))
      .sort((a, b) => storyOrderOf(a) - storyOrderOf(b));
    if (arcs.length === 0) return null;
    return await runVolume(chatId, profile, settings, userId, arcs, opts.replacesEntryId);
  } finally {
    clearBusy(userId, chatId, "volume");
  }
}

async function runVolume(
  chatId: string,
  profile: LMBProfile,
  settings: LMBSettings,
  userId: string,
  selected: LMBEntry[],
  replacesEntryId?: string,
): Promise<string | null> {
  nyaaToast(userId, "volume_fire");
  const outcome = await runWithRetry(profile.retryCount + 1, async () => {
    const controller = new AbortController();
    registerAborter(userId, chatId, "volume", controller);
    try {
      return await summarizeVolume(
        profile, settings.customPresets, chatId, selected, userId,
        {
          externalSignal: controller.signal,
          onProgress: (chars, thinking) => updateProgressNumbers(userId, chatId, "volume", chars, thinking),
        },
      );
    } finally {
      aborters.delete(busyKey(userId, chatId, "volume"));
    }
  }, (n, err) => {
    warn(`volume attempt ${n} failed: ${describeError(err)}`);
    nyaaToast(userId, "retry");
  });

  if (!outcome.ok) {
    if (outcome.err instanceof AbortedSummarizerError) {
      cb?.onToast(userId, "info", "Memoria sets the pen down");
      cb?.onStateChange(userId, chatId);
      return null;
    }
    recordFailure(userId, chatId, "volume", outcome.retries, outcome.err);
    failToast(userId, "volume", outcome.err);
    cb?.onStateChange(userId, chatId);
    return null;
  }
  clearLastFailure(userId, chatId);

  const result = outcome.value;
  const firstIdxs = selected.map((a) => a.meta.firstMsgIdx).filter((n): n is number => typeof n === "number");
  const lastIdxs = selected.map((a) => a.meta.lastMsgIdx).filter((n): n is number => typeof n === "number");
  const firstIdx = firstIdxs.length ? Math.min(...firstIdxs) : 0;
  const lastIdx = lastIdxs.length ? Math.max(...lastIdxs) : firstIdx;

  if (profile.showMemoryPreviews) {
    const draft = makeGroupPreview("volume", selected, result, firstIdx, lastIdx, replacesEntryId);
    pushPreview(userId, chatId, draft);
    cb?.onStateChange(userId, chatId);
    return null;
  }
  try {
    const entryId = await commitVolume(chatId, userId, selected, result, firstIdx, lastIdx, replacesEntryId);
    nyaaToast(userId, "volume_success");
    return entryId;
  } catch (err) {
    warn(`commitVolume failed: ${describeError(err)}`);
    recordFailure(userId, chatId, "volume", 0, err);
    failToast(userId, "volume", err);
    cb?.onStateChange(userId, chatId);
    return null;
  }
}

async function commitVolume(
  chatId: string,
  userId: string,
  selected: LMBEntry[],
  result: SummarizationResult,
  firstIdx: number,
  lastIdx: number,
  replacesEntryId?: string,
): Promise<string> {
  return withCommitMutex(userId, chatId, 3, async () => {
  const freshEntries = await listLmbEntries(chatId, userId);
  const entriesForCoverage = replacesEntryId
    ? freshEntries.filter((e) => e.raw.id !== replacesEntryId)
    : freshEntries;
  const freshCoverage = await buildCoverage(chatId, userId, entriesForCoverage);
  const stillActive = new Set(freshCoverage.activeEntries.filter((e) => e.meta.tier === 2).map((e) => e.raw.id));
  const filtered = selected.filter((a) => stillActive.has(a.raw.id));
  if (filtered.length === 0) {
    throw new Error("All source arcs were already bound by another volume or deleted");
  }
  if (filtered.length < selected.length) {
    selected = filtered;
    const firstIdxs = selected.map((a) => a.meta.firstMsgIdx).filter((n): n is number => typeof n === "number");
    const lastIdxs = selected.map((a) => a.meta.lastMsgIdx).filter((n): n is number => typeof n === "number");
    firstIdx = firstIdxs.length ? Math.min(...firstIdxs) : 0;
    lastIdx = lastIdxs.length ? Math.max(...lastIdxs) : firstIdx;
  }
  const book = await ensureBookForChat(chatId, userId);
  // On regenerate, keep the replaced volume's scene number (see commitChapter).
  const replacedVolume = replacesEntryId ? freshEntries.find((e) => e.raw.id === replacesEntryId) : undefined;
  const sceneNumber = typeof replacedVolume?.meta.sceneNumber === "number"
    ? replacedVolume.meta.sceneNumber
    : await nextSceneNumber(chatId, 3, userId);
  const storyOrder = typeof replacedVolume?.meta.storyOrder === "number"
    ? replacedVolume.meta.storyOrder
    : inheritedStoryOrder(selected, entriesForCoverage);
  const msgIds = selected.flatMap((a) => a.meta.msgIds);
  const sourceArcEntryIds = selected.map((a) => a.raw.id);
  const isRootVolume = selected.length > 0 && selected.every((a) => a.meta.isRoot);
  const rootOrigin = isRootVolume ? selected.find((a) => a.meta.rootOrigin)?.meta.rootOrigin : undefined;
  if (!isRootVolume && selected.some((a) => a.meta.isRoot)) {
    const own = selected.filter((a) => !a.meta.isRoot);
    const fs = own.map((a) => a.meta.firstMsgIdx).filter((n): n is number => typeof n === "number");
    const ls = own.map((a) => a.meta.lastMsgIdx).filter((n): n is number => typeof n === "number");
    if (fs.length) firstIdx = Math.min(...fs);
    else if (firstIdx < 0) firstIdx = 0;
    if (ls.length) lastIdx = Math.max(...ls);
    else if (lastIdx < firstIdx) lastIdx = firstIdx;
  }
  const volumeTitle = isRootVolume
    ? (result.title?.trim() || "Inherited Volume")
    : deriveTitle(result);
  const meta: LMBEntryMeta = {
    tier: 3,
    chatId,
    msgIds,
    sourceChapterEntryIds: sourceArcEntryIds,
    firstMsgIdx: firstIdx,
    lastMsgIdx: lastIdx,
    tokenCountInput: selected.reduce((a, e) => a + e.meta.tokenCountOutput, 0),
    tokenCountOutput: result.usageCompletionTokens || approximateTokensFromChars(result.content.length),
    model: result.model,
    connectionId: result.connectionId,
    createdAt: Date.now(),
    title: volumeTitle,
    shortComment: result.shortComment,
    presetKey: result.presetKey,
    sceneNumber,
    storyOrder,
    rawOutput: result.rawOutput,
    ...(isRootVolume ? { isRoot: true, rootOrigin } : {}),
  };
  const volumeSettings = await loadSettings(userId);
  const comment = await formatEntryName(volumeSettings, {
    chatId,
    userId,
    tier: "volume",
    title: meta.title ?? "",
    sceneNumber,
    storyOrder,
    firstMsgIdx: meta.firstMsgIdx,
    lastMsgIdx: meta.lastMsgIdx,
    sourceCount: sourceArcEntryIds.length,
    turnCount: msgIds.length,
    isRoot: isRootVolume,
  });
  const finalVolumeContent = savedMemoryContent(result.content);
  const volumeEntry = await createChapterEntry(book.id, meta, finalVolumeContent, comment, userId, result.keywords ?? [], volumeSettings.forceConstantEntries);
  const failedSupersedes: string[] = [];
  for (const arc of selected) {
    try {
      await patchEntryMeta(arc, { supersededByEntryId: volumeEntry.id }, userId);
    } catch (err) {
      failedSupersedes.push(arc.raw.id);
      warn(`failed to mark arc ${arc.raw.id} superseded by volume ${volumeEntry.id}: ${describeError(err)}`);
    }
  }
  if (failedSupersedes.length > 0) {
    cb?.onToast(
      userId,
      "warn",
      `The volume saved but ${failedSupersedes.length} arc${failedSupersedes.length === 1 ? "" : "s"} couldn't be marked superseded`,
    );
  }
  invalidateBookCache(userId, chatId);
  if (replacesEntryId) {
    try {
      await deleteEntry(replacesEntryId, userId);
      invalidateBookCache(userId, chatId);
    } catch (err) {
      warn(`regen: failed to delete replaced volume ${replacesEntryId}: ${describeError(err)}`);
    }
  }
  publishVolumeCreated(userId, {
    chatId,
    volumeEntryId: volumeEntry.id,
    bookId: book.id,
    sourceArcEntryIds,
    sourceMessageIds: msgIds,
    summaryText: finalVolumeContent,
    model: result.model,
    title: meta.title,
  });
  cb?.onStateChange(userId, chatId);
  return volumeEntry.id;
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
        cb?.onToast(userId, "warn", "Memoria can't save this chapter, its messages were deleted or already filed");
        cb?.onStateChange(userId, chatId);
        return null;
      }
      if (window.length < preview.sourceMessageIds.length) {
        cb?.onToast(userId, "warn", "Some messages were missing or already covered, Memoria saved the rest");
      }
      const firstIdx = messages.findIndex((m) => m.id === window[0]!.id);
      const lastIdx = messages.findIndex((m) => m.id === window[window.length - 1]!.id);
      const fakeResult: SummarizationResult = {
        rawOutput: preview.content,
        title: preview.title,
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
        failToast(userId, "chapter", err);
        cb?.onStateChange(userId, chatId);
        return null;
      }
    }
    const isVolume = preview.kind === "volume";
    const entries = await listLmbEntries(chatId, userId);
    const groupSelectionEntries = preview.replacesEntryId
      ? entries.filter((e) => e.raw.id !== preview.replacesEntryId)
      : entries;
    const coverage = await buildCoverage(chatId, userId, groupSelectionEntries);
    const wanted = new Set(preview.sourceChapterEntryIds ?? []);
    const sourceTier = isVolume ? 2 : 1;
    const selected = coverage.activeEntries.filter((e) => e.meta.tier === sourceTier && wanted.has(e.raw.id));
    if (selected.length === 0) {
      dropPendingPreview(userId, chatId, draftId);
      cb?.onToast(userId, "warn", isVolume
        ? "Memoria can't save this volume, its arcs were deleted or already bound"
        : "Memoria can't save this arc, its chapters were deleted or already bound");
      cb?.onStateChange(userId, chatId);
      return null;
    }
    const fakeResult: SummarizationResult = {
      rawOutput: preview.content,
      title: preview.title,
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
      const entryId = isVolume
        ? await commitVolume(
            chatId, userId, selected, fakeResult,
            preview.firstMsgIdx ?? 0, preview.lastMsgIdx ?? 0, preview.replacesEntryId,
          )
        : await commitArc(
            chatId, userId, selected, fakeResult,
            preview.firstMsgIdx ?? 0, preview.lastMsgIdx ?? 0, preview.replacesEntryId,
          );
      dropPendingPreview(userId, chatId, draftId);
      nyaaToast(userId, isVolume ? "volume_success" : "arc_success");
      cb?.onStateChange(userId, chatId);
      return entryId;
    } catch (err) {
      recordFailure(userId, chatId, isVolume ? "volume" : "arc", 0, err);
      failToast(userId, isVolume ? "volume" : "arc", err);
      cb?.onStateChange(userId, chatId);
      return null;
    }
  } finally {
    committingDrafts.delete(guardKey);
  }
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
    .sort((a, b) => storyOrderOf(a) - storyOrderOf(b));
  if (chapters.length === 0) throw new Error("No chapters to bind yet");
  return assembleArcPrompt(profile, settings.customPresets, chatId, chapters, userId);
}

export async function dryRunVolume(
  chatId: string,
  profile: LMBProfile,
  settings: LMBSettings,
  userId: string,
): Promise<DryRunAssembly> {
  const entries = await listLmbEntries(chatId, userId);
  const coverage = await buildCoverage(chatId, userId, entries);
  const arcs = coverage.activeEntries
    .filter((e) => e.meta.tier === 2 && !e.meta.isRoot)
    .sort((a, b) => storyOrderOf(a) - storyOrderOf(b));
  if (arcs.length === 0) throw new Error("No arcs to press yet");
  return assembleVolumePrompt(profile, settings.customPresets, chatId, arcs, userId);
}

async function nextSceneNumber(chatId: string, tier: 1 | 2 | 3, userId: string): Promise<number> {
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

function deriveTitle(result: SummarizationResult): string {
  if (result.title && result.title.trim()) return result.title.trim();
  const firstLine = (result.content.split(/\n+/, 1)[0] || "").trim();
  const firstSentence = firstLine.split(/(?<=[.!?])\s/, 1)[0] || firstLine;
  const trimmed = firstSentence.slice(0, 60).trim();
  if (trimmed) return `${trimmed}${trimmed.length === 60 ? "..." : ""}`;
  return "Compressed";
}

function chatMessageIndex(message: ChatMessageDTO): number | undefined {
  const idx = (message as { index_in_chat?: number }).index_in_chat;
  return typeof idx === "number" && Number.isFinite(idx) ? idx : undefined;
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

function makeGroupPreview(
  kind: "arc" | "volume",
  selected: LMBEntry[],
  result: SummarizationResult,
  firstIdx: number,
  lastIdx: number,
  replacesEntryId?: string,
): PendingPreview {
  return {
    kind,
    draftId: `draft_${kind}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    title: result.title || `${kind === "volume" ? "Volume" : "Arc"} - msgs ${firstIdx + 1}-${lastIdx + 1}`,
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
