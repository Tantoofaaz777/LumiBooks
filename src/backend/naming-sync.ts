declare const spindle: import("lumiverse-spindle-types").SpindleAPI;

import { formatBookName, formatEntryName, stripGeneratedHeader } from "./naming";
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
    const nextName = await formatBookName(settings, chatId, userId, chat?.name);
    if (nextName && nextName !== book.name) {
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
    const rawContent = entry.raw.content || "";
    const nextContent = settings.includeContentHeaders ? rawContent : stripGeneratedHeader(rawContent);
    const patch: { comment?: string; content?: string } = {};
    if (nextComment && nextComment !== entry.raw.comment) patch.comment = nextComment;
    if (nextContent !== rawContent) patch.content = nextContent;
    if (Object.keys(patch).length === 0) continue;
    await updateEntry(entry.raw.id, patch, userId).catch((err) => {
      warn(`entry rename failed for ${entry.raw.id}: ${describeError(err)}`);
    });
  }
  invalidateBookCache(userId, chatId);
}
