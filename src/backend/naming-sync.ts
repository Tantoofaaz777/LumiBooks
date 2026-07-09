declare const spindle: import("lumiverse-spindle-types").SpindleAPI;

import { formatBookName, formatEntryName } from "./naming";
import { EXTENSION_KEY } from "../shared";
import { describeError, warn } from "./runtime";
import { loadSettings } from "./storage";
import { findBookForChat, invalidateBookCache, listLmbEntries, updateEntry } from "./world-book";

export async function syncNamingForChat(chatId: string, userId: string): Promise<void> {
  const settings = await loadSettings(userId);
  const bookId = await findBookForChat(chatId, userId);
  if (!bookId) return;

  const chat = await spindle.chats.get(chatId, userId).catch(() => null);
  const book = await spindle.world_books.get(bookId, userId).catch(() => null);
  if (book) {
    const bookMeta = (book.metadata && typeof book.metadata === "object") ? (book.metadata as Record<string, unknown>) : {};
    const preserveBookName = bookMeta["lumibooks_preserve_name"] === true;
    const nextName = preserveBookName ? "" : await formatBookName(settings, chatId, userId, chat?.name);
    if (!preserveBookName && nextName && nextName !== book.name) {
      await spindle.world_books.update(book.id, { name: nextName }, userId).catch((err) => {
        warn(`book rename failed: ${describeError(err)}`);
      });
    }
  }

  const entries = await listLmbEntries(chatId, userId).catch(() => []);
  for (const entry of entries) {
    const tier = entry.meta.tier === 3 ? "volume" : entry.meta.tier === 2 ? "arc" : "chapter";
    const nextComment = await formatEntryName(settings, {
      chatId,
      userId,
      tier,
      title: entry.meta.title ?? "",
      sceneNumber: entry.meta.sceneNumber ?? 1,
      storyOrder: entry.meta.storyOrder,
      firstMsgIdx: entry.meta.firstMsgIdx,
      lastMsgIdx: entry.meta.lastMsgIdx,
      sourceCount: entry.meta.sourceChapterEntryIds?.length,
      turnCount: entry.meta.msgIds.length,
      isRoot: entry.meta.isRoot,
    });
    const patch: { comment?: string; extensions?: Record<string, unknown> } = {};
    if (isAdoptedEntry(entry.meta)) {
      const ext = (entry.raw.extensions || {}) as Record<string, unknown>;
      const nextMeta = { ...entry.meta, preserveComment: true };
      const repaired = repairLegacyAdoptedComment(entry.raw.comment || "");
      if (!entry.meta.preserveComment) patch.extensions = { ...ext, [EXTENSION_KEY]: nextMeta };
      if (repaired && repaired !== entry.raw.comment) patch.comment = repaired;
    } else if (!entry.meta.preserveComment && nextComment && nextComment !== entry.raw.comment) {
      patch.comment = nextComment;
    }
    if (Object.keys(patch).length === 0) continue;
    await updateEntry(entry.raw.id, patch, userId).catch((err) => {
      warn(`entry rename failed for ${entry.raw.id}: ${describeError(err)}`);
    });
  }
  invalidateBookCache(userId, chatId);
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
