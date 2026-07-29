declare const spindle: import("lumiverse-spindle-types").SpindleAPI;

import type { CoverageStats } from "../types";
import { approximateTokensFromChars, type LMBEntryMeta } from "../shared";
import { listLmbEntries, type LMBEntry } from "./world-book";
import { describeError, warn } from "./runtime";

export type ChatMessage = Awaited<ReturnType<typeof spindle.chat.getMessages>>[number];
type ChatMessageDTO = ChatMessage;

export interface CoverageMap {
  coveredBy: Map<string, string>;
  activeEntries: LMBEntry[];
  hideFrontier: number | null;
  volumes: LMBEntry[];
  arcs: LMBEntry[];
  chapters: LMBEntry[];
}

export interface ReconcileVisibilityResult {
  frontier: number | null;
  hidden: number;
  unhidden: number;
}

export const VISIBILITY_FRONTIER_KEY = "lumibooks_hide_frontier";
export const VISIBILITY_IDS_KEY = "lumibooks_hidden_message_ids";

const VISIBILITY_CHUNK_SIZE = 500;
const visibilityChains = new Map<string, Promise<unknown>>();

export interface HierarchyLmbEntry {
  readonly raw: {
    readonly id: string;
    readonly disabled: boolean;
  };
  readonly meta: Pick<LMBEntryMeta, "tier" | "sourceChapterEntryIds">;
}

interface ActiveHierarchy<TEntry extends HierarchyLmbEntry> {
  entries: TEntry[];
  chapters: TEntry[];
  arcs: TEntry[];
  volumes: TEntry[];
  supersededArcIds: Set<string>;
  supersededChapterIds: Set<string>;
  activeEntries: TEntry[];
}

function resolveActiveHierarchy<TEntry extends HierarchyLmbEntry>(
  allEntries: readonly TEntry[],
): ActiveHierarchy<TEntry> {
  const entries = allEntries.filter((entry) => !entry.raw.disabled);
  const chapters = entries.filter((entry) => entry.meta.tier === 1);
  const arcs = entries.filter((entry) => entry.meta.tier === 2);
  const volumes = entries.filter((entry) => entry.meta.tier === 3);

  const supersededArcIds = new Set<string>();
  for (const volume of volumes) {
    for (const arcId of volume.meta.sourceChapterEntryIds ?? []) {
      supersededArcIds.add(arcId);
    }
  }

  // Arcs keep superseding their chapters even when a volume supersedes the arc.
  const supersededChapterIds = new Set<string>();
  for (const arc of arcs) {
    for (const chapterId of arc.meta.sourceChapterEntryIds ?? []) {
      supersededChapterIds.add(chapterId);
    }
  }

  const activeEntries = [
    ...volumes,
    ...arcs.filter((arc) => !supersededArcIds.has(arc.raw.id)),
    ...chapters.filter((chapter) => !supersededChapterIds.has(chapter.raw.id)),
  ];

  return {
    entries,
    chapters,
    arcs,
    volumes,
    supersededArcIds,
    supersededChapterIds,
    activeEntries,
  };
}

export function activeHierarchyEntryIds(entries: readonly HierarchyLmbEntry[]): Set<string> {
  return new Set(resolveActiveHierarchy(entries).activeEntries.map((entry) => entry.raw.id));
}

export async function buildCoverage(chatId: string, userId: string, preloadedEntries?: LMBEntry[]): Promise<CoverageMap> {
  const allEntries = preloadedEntries ?? (await listLmbEntries(chatId, userId));
  const {
    entries,
    chapters,
    arcs,
    volumes,
    supersededArcIds,
    supersededChapterIds,
    activeEntries,
  } = resolveActiveHierarchy(allEntries);
  const chapterById = new Map(chapters.map((c) => [c.raw.id, c] as const));
  const arcById = new Map(arcs.map((a) => [a.raw.id, a] as const));

  const coveredBy = new Map<string, string>();

  for (const vol of volumes) {
    for (const msgId of vol.meta.msgIds) {
      if (!coveredBy.has(msgId)) coveredBy.set(msgId, vol.raw.id);
    }
    for (const aid of vol.meta.sourceChapterEntryIds ?? []) {
      const arc = arcById.get(aid);
      if (!arc) continue;
      for (const msgId of arc.meta.msgIds) {
        if (!coveredBy.has(msgId)) coveredBy.set(msgId, vol.raw.id);
      }
      for (const cid of arc.meta.sourceChapterEntryIds ?? []) {
        const ch = chapterById.get(cid);
        if (!ch) continue;
        for (const msgId of ch.meta.msgIds) {
          if (!coveredBy.has(msgId)) coveredBy.set(msgId, vol.raw.id);
        }
      }
    }
  }

  for (const arc of arcs) {
    if (supersededArcIds.has(arc.raw.id)) continue;
    for (const msgId of arc.meta.msgIds) {
      if (!coveredBy.has(msgId)) coveredBy.set(msgId, arc.raw.id);
    }
    for (const cid of arc.meta.sourceChapterEntryIds ?? []) {
      const ch = chapterById.get(cid);
      if (!ch) continue;
      for (const msgId of ch.meta.msgIds) {
        if (!coveredBy.has(msgId)) coveredBy.set(msgId, arc.raw.id);
      }
    }
  }

  for (const chapter of chapters) {
    if (supersededChapterIds.has(chapter.raw.id)) continue;
    for (const msgId of chapter.meta.msgIds) {
      if (!coveredBy.has(msgId)) coveredBy.set(msgId, chapter.raw.id);
    }
  }

  const entryById = new Map(entries.map((entry) => [entry.raw.id, entry] as const));
  const frontierMemo = new Map<string, number | null>();
  const inheritedFrontier = (entry: LMBEntry, visiting = new Set<string>()): number | null => {
    if (frontierMemo.has(entry.raw.id)) return frontierMemo.get(entry.raw.id) ?? null;
    if (visiting.has(entry.raw.id)) return null;
    visiting.add(entry.raw.id);
    let frontier = typeof entry.meta.lastMsgIdx === "number" && Number.isFinite(entry.meta.lastMsgIdx)
      ? entry.meta.lastMsgIdx
      : null;
    for (const sourceId of entry.meta.sourceChapterEntryIds ?? []) {
      const source = entryById.get(sourceId);
      if (!source) continue;
      const sourceFrontier = inheritedFrontier(source, visiting);
      if (sourceFrontier !== null) frontier = frontier === null ? sourceFrontier : Math.max(frontier, sourceFrontier);
    }
    visiting.delete(entry.raw.id);
    frontierMemo.set(entry.raw.id, frontier);
    return frontier;
  };
  const activeFrontiers = activeEntries
    .map((entry) => inheritedFrontier(entry))
    .filter((value): value is number => value !== null);
  const hideFrontier = activeFrontiers.length > 0 ? Math.max(...activeFrontiers) : null;

  return { coveredBy, activeEntries, hideFrontier, volumes, arcs, chapters };
}

export function isExcluded(m: ChatMessageDTO): boolean {
  const md = (m as { metadata?: Record<string, unknown> }).metadata;
  return !!(md && md["lmb_excluded"] === true);
}

export function computeCoverageStats(
  messages: ChatMessageDTO[],
  coverage: CoverageMap,
): CoverageStats {
  const totalMessages = messages.length;
  let coveredMessages = 0;
  let approxUncoveredTokens = 0;
  for (const m of messages) {
    if (coverage.coveredBy.has(m.id)) {
      coveredMessages++;
    } else {
      approxUncoveredTokens += approximateTokensFromChars((m.content || "").length);
    }
  }
  const uncoveredMessages = totalMessages - coveredMessages;

  return {
    totalMessages,
    coveredMessages,
    uncoveredMessages,
    approxUncoveredTokens,
  };
}

function messageIndex(message: ChatMessageDTO, fallback: number): number {
  const index = (message as { index_in_chat?: number }).index_in_chat;
  return typeof index === "number" && Number.isFinite(index) ? index : fallback;
}

function isHidden(message: ChatMessageDTO): boolean {
  return !!(message.extra && (message.extra as Record<string, unknown>).hidden);
}

function readOwnedIds(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0));
}

function sameStringArray(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function setHiddenState(
  chatId: string,
  messageIds: string[],
  hidden: boolean,
): Promise<Set<string>> {
  const changed = new Set<string>();
  for (let i = 0; i < messageIds.length; i += VISIBILITY_CHUNK_SIZE) {
    const slice = messageIds.slice(i, i + VISIBILITY_CHUNK_SIZE);
    try {
      await spindle.chat.setMessagesHidden(chatId, slice, hidden);
      for (const id of slice) changed.add(id);
    } catch (batchError) {
      let failed = 0;
      let firstError: unknown = batchError;
      for (const id of slice) {
        try {
          await spindle.chat.setMessageHidden(chatId, id, hidden);
          changed.add(id);
        } catch (error) {
          if (failed === 0) firstError = error;
          failed++;
        }
      }
      if (failed > 0) {
        warn(
          `visibility ${hidden ? "hide" : "unhide"} failed for ${failed} message${failed === 1 ? "" : "s"}: `
          + describeError(firstError),
        );
      }
    }
  }
  return changed;
}

async function reconcileVisibilityNow(
  chatId: string,
  userId: string,
): Promise<ReconcileVisibilityResult> {
  const chat = await spindle.chats.get(chatId, userId);
  if (!chat) return { frontier: null, hidden: 0, unhidden: 0 };

  const messages = await spindle.chat.getMessages(chatId);
  const coverage = await buildCoverage(chatId, userId);
  const frontier = coverage.hideFrontier;

  const metadata = chat.metadata && typeof chat.metadata === "object"
    ? (chat.metadata as Record<string, unknown>)
    : {};
  const ownedIds = readOwnedIds(metadata[VISIBILITY_IDS_KEY]);
  const messageById = new Map(messages.map((message) => [message.id, message] as const));
  const indexById = new Map(messages.map((message, index) => [message.id, messageIndex(message, index)] as const));
  const desiredIds = new Set<string>();

  if (frontier !== null) {
    for (let index = 0; index < messages.length; index++) {
      const message = messages[index]!;
      if (!isExcluded(message) && messageIndex(message, index) <= frontier) desiredIds.add(message.id);
    }
  }

  const toUnhide: string[] = [];
  for (const id of Array.from(ownedIds)) {
    const message = messageById.get(id);
    if (!message) {
      ownedIds.delete(id);
      continue;
    }
    if (desiredIds.has(id)) continue;
    if (isHidden(message)) toUnhide.push(id);
    else ownedIds.delete(id);
  }

  const unhiddenIds = await setHiddenState(chatId, toUnhide, false);
  for (const id of unhiddenIds) ownedIds.delete(id);

  const toHide: string[] = [];
  for (const id of desiredIds) {
    const message = messageById.get(id);
    if (!message) continue;
    // An already-hidden, unowned message may have been hidden manually.
    if (isHidden(message)) continue;
    toHide.push(id);
  }

  const hiddenIds = await setHiddenState(chatId, toHide, true);
  for (const id of hiddenIds) ownedIds.add(id);

  const sortedOwnedIds = Array.from(ownedIds).sort((left, right) => {
    const leftIndex = indexById.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = indexById.get(right) ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex || left.localeCompare(right);
  });

  const freshChat = await spindle.chats.get(chatId, userId);
  if (!freshChat) {
    await setHiddenState(chatId, Array.from(hiddenIds), false);
    await setHiddenState(chatId, Array.from(unhiddenIds), true);
    throw new Error(`Chat ${chatId} disappeared while LumiBooks reconciled visibility`);
  }

  const freshMetadata = freshChat.metadata && typeof freshChat.metadata === "object"
    ? { ...(freshChat.metadata as Record<string, unknown>) }
    : {};
  const oldFrontier = typeof freshMetadata[VISIBILITY_FRONTIER_KEY] === "number"
    ? (freshMetadata[VISIBILITY_FRONTIER_KEY] as number)
    : null;
  const oldOwnedIds = Array.from(readOwnedIds(freshMetadata[VISIBILITY_IDS_KEY])).sort((left, right) => {
    const leftIndex = indexById.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = indexById.get(right) ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex || left.localeCompare(right);
  });

  if (frontier === null) delete freshMetadata[VISIBILITY_FRONTIER_KEY];
  else freshMetadata[VISIBILITY_FRONTIER_KEY] = frontier;
  if (sortedOwnedIds.length === 0) delete freshMetadata[VISIBILITY_IDS_KEY];
  else freshMetadata[VISIBILITY_IDS_KEY] = sortedOwnedIds;

  if (oldFrontier !== frontier || !sameStringArray(oldOwnedIds, sortedOwnedIds)) {
    try {
      await spindle.chats.update(chatId, { metadata: freshMetadata }, userId);
    } catch (error) {
      // Do not leave visibility changes behind without their ownership ledger.
      await setHiddenState(chatId, Array.from(hiddenIds), false);
      await setHiddenState(chatId, Array.from(unhiddenIds), true);
      throw error;
    }
  }

  return {
    frontier,
    hidden: hiddenIds.size,
    unhidden: unhiddenIds.size,
  };
}

export function reconcileVisibility(
  chatId: string,
  userId: string,
): Promise<ReconcileVisibilityResult> {
  const chainKey = `${userId}::${chatId}`;
  const previous = visibilityChains.get(chainKey) ?? Promise.resolve();
  const current = previous.then(
    () => reconcileVisibilityNow(chatId, userId),
    () => reconcileVisibilityNow(chatId, userId),
  );
  const guarded = current.catch(() => undefined);
  visibilityChains.set(chainKey, guarded);
  void guarded.finally(() => {
    if (visibilityChains.get(chainKey) === guarded) visibilityChains.delete(chainKey);
  });
  return current;
}
