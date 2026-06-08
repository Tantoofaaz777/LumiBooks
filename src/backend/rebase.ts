import type { LMBEntry } from "./world-book";
import {
  deleteEntry,
  ensureBookForChat,
  invalidateBookCache,
  invalidateRootCandidates,
  listLmbEntries,
  setEntryDisabled,
} from "./world-book";
import { copyLmbEntries, type CopyTransform } from "./book-copy";
import { describeError, info, warn } from "./runtime";


export type RebaseFailure = "same_chat" | "has_own" | "empty_source" | "busy";

const inFlight = new Set<string>();
function lockKey(userId: string, chatId: string): string {
  return `${userId}::${chatId}`;
}

export function ownEntries(entries: LMBEntry[]): LMBEntry[] {
  return entries.filter((e) => !e.meta.isRoot);
}

function computeNegativeOrder(entries: LMBEntry[]): Map<string, number> {
  const sorted = [...entries].sort((a, b) => (a.meta.firstMsgIdx ?? 0) - (b.meta.firstMsgIdx ?? 0));
  const n = sorted.length;
  const order = new Map<string, number>();
  sorted.forEach((e, i) => order.set(e.raw.id, -(n - i)));
  return order;
}

async function seedRoot(
  targetChatId: string,
  sourceChatId: string,
  sourceEntries: LMBEntry[],
  existingRoots: LMBEntry[],
  userId: string,
): Promise<{ count: number; newIds: Set<string> }> {
  const book = await ensureBookForChat(targetChatId, userId);
  const negIdx = computeNegativeOrder(sourceEntries);
  const transform: CopyTransform = (entry) => {
    const idx = negIdx.get(entry.raw.id);
    const baseComment = entry.raw.comment || "";
    return {
      msgIds: entry.meta.msgIds.slice(),
      firstMsgIdx: idx,
      lastMsgIdx: idx,
      extra: { chatId: targetChatId, isRoot: true, rootOrigin: sourceChatId },
      comment: baseComment.startsWith("[Root]") ? baseComment : `[Root] ${baseComment}`.trim(),
    };
  };
  const idMap = await copyLmbEntries(book.id, sourceEntries, userId, transform);
  for (const r of existingRoots) {
    await deleteEntry(r.raw.id, userId).catch((err) => warn(`rebase: failed to drop old root ${r.raw.id}: ${describeError(err)}`));
  }
  invalidateBookCache(userId, targetChatId);
  invalidateRootCandidates(userId);
  info(`rebased ${targetChatId.slice(0, 8)} onto root from ${sourceChatId.slice(0, 8)} (${idMap.size} entries)`);
  return { count: idMap.size, newIds: new Set(idMap.values()) };
}

export async function rebaseRoot(
  targetChatId: string,
  sourceChatId: string,
  userId: string,
): Promise<{ ok: true; count: number } | { ok: false; reason: RebaseFailure }> {
  if (sourceChatId === targetChatId) return { ok: false, reason: "same_chat" };
  const key = lockKey(userId, targetChatId);
  if (inFlight.has(key)) return { ok: false, reason: "busy" };
  inFlight.add(key);
  try {
    const targetEntries = await listLmbEntries(targetChatId, userId);
    if (ownEntries(targetEntries).some((e) => !e.raw.disabled)) return { ok: false, reason: "has_own" };
    const sourceEntries = (await listLmbEntries(sourceChatId, userId)).filter((e) => !e.raw.disabled);
    if (sourceEntries.length === 0) return { ok: false, reason: "empty_source" };
    const existingRoots = targetEntries.filter((e) => e.meta.isRoot);
    const { count } = await seedRoot(targetChatId, sourceChatId, sourceEntries, existingRoots, userId);
    return { ok: true, count };
  } finally {
    inFlight.delete(key);
  }
}

export async function rebuildRoot(
  targetChatId: string,
  sourceChatId: string,
  userId: string,
): Promise<{ ok: true; count: number } | { ok: false; reason: RebaseFailure }> {
  if (sourceChatId === targetChatId) return { ok: false, reason: "same_chat" };
  const key = lockKey(userId, targetChatId);
  if (inFlight.has(key)) return { ok: false, reason: "busy" };
  inFlight.add(key);
  try {
    const sourceEntries = (await listLmbEntries(sourceChatId, userId)).filter((e) => !e.raw.disabled);
    if (sourceEntries.length === 0) return { ok: false, reason: "empty_source" };
    const { count, newIds } = await seedRoot(targetChatId, sourceChatId, sourceEntries, [], userId);
    const after = await listLmbEntries(targetChatId, userId);
    const survivors: typeof after = [];
    for (const e of after) {
      if (newIds.has(e.raw.id)) continue;
      try {
        await deleteEntry(e.raw.id, userId);
      } catch (err) {
        warn(`rebuild: failed to delete ${e.raw.id}: ${describeError(err)}`);
        survivors.push(e);
      }
    }
    for (const e of survivors) {
      await setEntryDisabled(e.raw.id, true, userId).catch(() => {});
    }
    invalidateBookCache(userId, targetChatId);
    invalidateRootCandidates(userId);
    return { ok: true, count };
  } finally {
    inFlight.delete(key);
  }
}

export async function detachRoot(targetChatId: string, userId: string): Promise<number> {
  const entries = await listLmbEntries(targetChatId, userId);
  const roots = entries.filter((e) => e.meta.isRoot);
  for (const r of roots) {
    await deleteEntry(r.raw.id, userId).catch((err) => warn(`detach: failed to delete root ${r.raw.id}: ${describeError(err)}`));
  }
  if (roots.length > 0) {
    invalidateBookCache(userId, targetChatId);
    invalidateRootCandidates(userId);
  }
  return roots.length;
}
