declare const spindle: import("lumiverse-spindle-types").SpindleAPI;

import type { ChatDTO, WorldBookDTO, WorldBookEntryDTO } from "lumiverse-spindle-types";
import type { LMBSettings } from "../shared";
import { ensureForkAdoption } from "./fork";
import { loadSettings } from "./storage";
import {
  findBookForChat,
  listAllEntries,
  lmbEntriesFromRaw,
  reassertChatBinding,
  type LMBEntry,
} from "./world-book";

export interface ChatRefreshContext {
  settings: LMBSettings;
  chat: ChatDTO | null;
  bookId: string | null;
  book: WorldBookDTO | null;
  rawEntries: WorldBookEntryDTO[];
  entries: LMBEntry[];
}

export async function loadChatRefreshContext(
  userId: string,
  requestedChatId?: string | null,
): Promise<ChatRefreshContext> {
  const [settings, chat] = await Promise.all([
    loadSettings(userId),
    requestedChatId
      ? spindle.chats.get(requestedChatId, userId).catch(() => null)
      : spindle.chats.getActive(userId).catch(() => null),
  ]);

  if (!chat) {
    return { settings, chat: null, bookId: null, book: null, rawEntries: [], entries: [] };
  }

  if (settings.enabled) {
    await ensureForkAdoption(chat.id, userId).catch(() => {});
    await reassertChatBinding(chat.id, userId).catch(() => {});
  }

  const bookId = await findBookForChat(chat.id, userId, chat);
  const book = bookId ? await spindle.world_books.get(bookId, userId).catch(() => null) : null;
  const rawEntries = bookId ? await listAllEntries(bookId, userId).catch(() => []) : [];
  const entries = lmbEntriesFromRaw(rawEntries, chat.id);

  return { settings, chat, bookId, book, rawEntries, entries };
}
