declare const spindle: import("lumiverse-spindle-types").SpindleAPI;

import { formatEntryName } from "./naming";
import { EXTENSION_KEY } from "../shared";
import { describeError, warn } from "./runtime";
import { loadSettings } from "./storage";
import { findBookForChat, invalidateBookCache, listLmbEntries, updateEntry } from "./world-book";
import type { ChatRefreshContext } from "./refresh-context";

const NAME_SYNC_CONCURRENCY = 4;

export async function syncNamingForChat(
  chatId: string,
  userId: string,
  context?: ChatRefreshContext,
): Promise<void> {
  const settings = context?.settings ?? await loadSettings(userId);
  let chat = context?.chat;
  if (!context) {
    chat = await spindle.chats.get(chatId, userId).catch((err) => {
      warn(`chat name lookup failed during naming sync: ${describeError(err)}`);
      return undefined;
    });
    if (chat === undefined) return;
  }
  if (!chat) return;

  const bookId = context ? context.bookId : await findBookForChat(chatId, userId, chat);
  if (!bookId) return;
  const chatName = chat?.name?.trim() || null;

  const book = context ? context.book : await spindle.world_books.get(bookId, userId).catch(() => null);
  let touched = false;
  if (book) {
    const bookMeta = (book.metadata && typeof book.metadata === "object") ? (book.metadata as Record<string, unknown>) : {};
    if (bookMeta["lumibooks_preserve_name"] !== true || typeof bookMeta["lumibooks_initial_name"] !== "string") {
      const updated = await spindle.world_books.update(
        book.id,
        {
          metadata: {
            ...bookMeta,
            lumibooks_preserve_name: true,
            lumibooks_initial_name: book.name,
          },
        },
        userId,
      ).catch((err) => {
        warn(`book name snapshot failed: ${describeError(err)}`);
        return null;
      });
      if (updated) {
        Object.assign(book, updated);
        touched = true;
      }
    }
  }

  const entries = context?.entries ?? await listLmbEntries(chatId, userId).catch(() => []);
  const renameCandidates = [];
  for (const entry of entries) {
    const patch: { comment?: string; extensions?: Record<string, unknown> } = {};
    if (isAdoptedEntry(entry.meta)) {
      const ext = (entry.raw.extensions || {}) as Record<string, unknown>;
      const nextMeta = { ...entry.meta, preserveComment: true };
      const repaired = repairLegacyAdoptedComment(entry.raw.comment || "");
      if (!entry.meta.preserveComment) patch.extensions = { ...ext, [EXTENSION_KEY]: nextMeta };
      if (repaired && repaired !== entry.raw.comment) patch.comment = repaired;
      if (Object.keys(patch).length === 0) continue;
      const updated = await updateEntry(entry.raw.id, patch, userId).catch((err) => {
        warn(`entry rename failed for ${entry.raw.id}: ${describeError(err)}`);
        return null;
      });
      if (!updated) continue;
      Object.assign(entry.raw, updated);
      entry.meta = nextMeta;
      touched = true;
      continue;
    }
    if (!entry.meta.preserveComment) renameCandidates.push(entry);
  }

  await forEachConcurrent(renameCandidates, NAME_SYNC_CONCURRENCY, async (entry) => {
    const tier = entry.meta.tier === 3 ? "volume" : entry.meta.tier === 2 ? "arc" : "chapter";
    const nextComment = await formatEntryName(settings, {
      chatId,
      userId,
      chatName,
      tier,
      title: entry.meta.title ?? "",
      sceneNumber: entry.meta.sceneNumber ?? 1,
      storyOrder: entry.meta.storyOrder,
      firstMsgIdx: entry.meta.firstMsgIdx,
      lastMsgIdx: entry.meta.lastMsgIdx,
      sourceCount: entry.meta.sourceChapterEntryIds?.length,
      turnCount: entry.meta.msgIds.length,
    });
    if (!nextComment || nextComment === entry.raw.comment) return;
    const updated = await updateEntry(entry.raw.id, { comment: nextComment }, userId).catch((err) => {
      warn(`entry rename failed for ${entry.raw.id}: ${describeError(err)}`);
      return null;
    });
    if (!updated) return;
    Object.assign(entry.raw, updated);
    touched = true;
  });

  if (touched && !context) invalidateBookCache(userId, chatId);
}

async function forEachConcurrent<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const item = items[nextIndex++];
      if (item !== undefined) await fn(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
}

function isAdoptedEntry(meta: { model?: string; connectionId?: string }): boolean {
  return meta.model === "adopted" || meta.connectionId === "adopted";
}

function repairLegacyAdoptedComment(comment: string): string {
  let next = comment.replace(/\s+\(\d+\)?\s*$/, "").trim();
  const opens = (next.match(/\(/g) ?? []).length;
  const closes = (next.match(/\)/g) ?? []).length;
  if (opens > closes) next += ")".repeat(opens - closes);
  return next;
}
