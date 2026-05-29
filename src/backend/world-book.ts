declare const spindle: import("lumiverse-spindle-types").SpindleAPI;

import type { WorldBookDTO, WorldBookEntryDTO } from "lumiverse-spindle-types";
import type { LMBEntryMeta } from "../shared";
import { EXTENSION_KEY, bookNameFor, normalizeEntryMeta } from "../shared";

const PAGE_LIMIT = 200;
const BOOK_INDEX_CACHE_TTL_MS = 4000;

interface ChatBookCacheEntry {
  bookId: string;
  expiresAt: number;
}

const CHAT_BOOK_CACHE_CAP = 1000;
const chatBookCache = new Map<string, ChatBookCacheEntry>();
const ensureInflight = new Map<string, Promise<WorldBookDTO>>();

function setBookCache(key: string, value: ChatBookCacheEntry): void {
  if (chatBookCache.has(key)) chatBookCache.delete(key);
  chatBookCache.set(key, value);
  while (chatBookCache.size > CHAT_BOOK_CACHE_CAP) {
    const oldest = chatBookCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    chatBookCache.delete(oldest);
  }
}

function cacheKey(userId: string, chatId: string): string {
  return `${userId}::${chatId}`;
}

export interface LMBEntry {
  raw: WorldBookEntryDTO;
  meta: LMBEntryMeta;
}

export async function listAllBooks(userId: string): Promise<WorldBookDTO[]> {
  const out: WorldBookDTO[] = [];
  let offset = 0;
  while (true) {
    const page = await spindle.world_books.list({ limit: PAGE_LIMIT, offset, userId });
    out.push(...page.data);
    if (out.length >= page.total || page.data.length === 0) break;
    offset += page.data.length;
  }
  return out;
}

export async function listAllEntries(bookId: string, userId: string): Promise<WorldBookEntryDTO[]> {
  const out: WorldBookEntryDTO[] = [];
  let offset = 0;
  while (true) {
    const page = await spindle.world_books.entries.list(bookId, { limit: PAGE_LIMIT, offset, userId });
    out.push(...page.data);
    if (out.length >= page.total || page.data.length === 0) break;
    offset += page.data.length;
  }
  return out;
}

export async function findBookForChat(chatId: string, userId: string): Promise<string | null> {
  const cached = chatBookCache.get(cacheKey(userId, chatId));
  if (cached && cached.expiresAt > Date.now()) return cached.bookId;

  const chat = await spindle.chats.get(chatId, userId).catch(() => null);
  const fromMeta = chat?.metadata && typeof chat.metadata === "object" ? (chat.metadata as Record<string, unknown>) : null;
  const claimed = fromMeta && typeof fromMeta["lumibooks_book_id"] === "string" ? (fromMeta["lumibooks_book_id"] as string) : null;
  if (claimed) {
    const exists = await spindle.world_books.get(claimed, userId).catch(() => null);
    if (exists) {
      const bookMeta = exists.metadata && typeof exists.metadata === "object" ? (exists.metadata as Record<string, unknown>) : null;
      const bookChatId = bookMeta ? bookMeta["lumibooks_chat_id"] : undefined;
      if (bookChatId === chatId) {
        setBookCache(cacheKey(userId, chatId), { bookId: claimed, expiresAt: Date.now() + BOOK_INDEX_CACHE_TTL_MS });
        return claimed;
      }
    }
  }

  const books = await listAllBooks(userId);
  for (const book of books) {
    const meta = book.metadata as Record<string, unknown> | undefined;
    if (meta && meta["lumibooks_chat_id"] === chatId) {
      setBookCache(cacheKey(userId, chatId), { bookId: book.id, expiresAt: Date.now() + BOOK_INDEX_CACHE_TTL_MS });
      return book.id;
    }
  }
  return null;
}

export async function ensureBookForChat(chatId: string, userId: string): Promise<WorldBookDTO> {
  const key = cacheKey(userId, chatId);
  const inflight = ensureInflight.get(key);
  if (inflight) return inflight;
  const p = doEnsureBookForChat(chatId, userId).finally(() => {
    ensureInflight.delete(key);
  });
  ensureInflight.set(key, p);
  return p;
}

async function doEnsureBookForChat(chatId: string, userId: string): Promise<WorldBookDTO> {
  const existingId = await findBookForChat(chatId, userId);
  if (existingId) {
    const existing = await spindle.world_books.get(existingId, userId);
    if (existing) {
      await bindBookToChat(chatId, existing.id, userId).catch(() => {});
      return existing;
    }
  }

  const chat = await spindle.chats.get(chatId, userId);
  if (!chat) throw new Error(`Chat ${chatId} not found for user`);

  const book = await spindle.world_books.create(
    {
      name: bookNameFor(chat.name, chatId),
      description: "Memoria's shelf for this chat. Chapters and arcs live here.",
      metadata: {
        lumibooks_chat_id: chatId,
        lumibooks_created_at: Date.now(),
      },
    },
    userId,
  );

  await bindBookToChat(chatId, book.id, userId).catch(() => {});

  setBookCache(cacheKey(userId, chatId), { bookId: book.id, expiresAt: Date.now() + BOOK_INDEX_CACHE_TTL_MS });
  return book;
}

async function bindBookToChat(chatId: string, bookId: string, userId: string): Promise<void> {
  const chat = await spindle.chats.get(chatId, userId).catch(() => null);
  if (!chat) return;
  const metadata = (chat.metadata && typeof chat.metadata === "object") ? chat.metadata : {};
  const existing = Array.isArray((metadata as Record<string, unknown>)["chat_world_book_ids"])
    ? ((metadata as Record<string, unknown>)["chat_world_book_ids"] as string[]).filter((x) => typeof x === "string")
    : [];
  const alreadyBound = existing.includes(bookId);
  const alreadyClaimed = (metadata as Record<string, unknown>)["lumibooks_book_id"] === bookId;
  if (alreadyBound && alreadyClaimed) return;
  const nextChatBookIds = alreadyBound ? existing : [...existing, bookId];
  await spindle.chats.update(
    chatId,
    {
      metadata: {
        ...(metadata as Record<string, unknown>),
        chat_world_book_ids: nextChatBookIds,
        lumibooks_book_id: bookId,
      },
    },
    userId,
  );
}

export async function listLmbEntries(chatId: string, userId: string): Promise<LMBEntry[]> {
  const bookId = await findBookForChat(chatId, userId);
  if (!bookId) return [];
  const raw = await listAllEntries(bookId, userId);
  const out: LMBEntry[] = [];
  for (const entry of raw) {
    const ext = (entry.extensions || {}) as Record<string, unknown>;
    const meta = normalizeEntryMeta(ext[EXTENSION_KEY]);
    if (!meta) continue;
    if (meta.chatId !== chatId) continue;
    out.push({ raw: entry, meta });
  }
  return out;
}

export async function createChapterEntry(
  bookId: string,
  meta: LMBEntryMeta,
  content: string,
  comment: string,
  userId: string,
  keys: string[] = [],
  constant: boolean = true,
): Promise<WorldBookEntryDTO> {
  return spindle.world_books.entries.create(
    bookId,
    {
      content,
      comment,
      disabled: false,
      constant,
      key: keys,
      keysecondary: [],
      vectorized: false,
      extensions: {
        [EXTENSION_KEY]: meta,
      },
    },
    userId,
  );
}

export async function applyConstantToAllLmbEntries(userId: string, constant: boolean): Promise<number> {
  const books = await listAllBooks(userId);
  let updated = 0;
  for (const book of books) {
    const meta = book.metadata as Record<string, unknown> | undefined;
    if (!meta || typeof meta["lumibooks_chat_id"] !== "string") continue;
    const entries = await listAllEntries(book.id, userId).catch(() => [] as WorldBookEntryDTO[]);
    for (const entry of entries) {
      const ext = (entry.extensions || {}) as Record<string, unknown>;
      if (!ext[EXTENSION_KEY]) continue;
      if (entry.constant === constant) continue;
      try {
        await spindle.world_books.entries.update(entry.id, { constant }, userId);
        updated++;
      } catch (_) { void _; }
    }
  }
  return updated;
}

export async function updateEntry(
  entryId: string,
  patch: { content?: string; comment?: string; extensions?: Record<string, unknown> },
  userId: string,
): Promise<WorldBookEntryDTO> {
  return spindle.world_books.entries.update(entryId, patch, userId);
}

export async function deleteEntry(entryId: string, userId: string): Promise<void> {
  await spindle.world_books.entries.delete(entryId, userId);
}

export async function setEntryDisabled(entryId: string, disabled: boolean, userId: string): Promise<WorldBookEntryDTO> {
  return spindle.world_books.entries.update(entryId, { disabled }, userId);
}

export async function releaseEntry(entry: LMBEntry, userId: string): Promise<WorldBookEntryDTO> {
  const ext = (entry.raw.extensions || {}) as Record<string, unknown>;
  const nextExt: Record<string, unknown> = { ...ext };
  delete nextExt[EXTENSION_KEY];
  const currentComment = entry.raw.comment || "";
  const nextComment = currentComment.startsWith("[orphaned]")
    ? currentComment
    : `[orphaned] ${currentComment}`.trim();
  return spindle.world_books.entries.update(
    entry.raw.id,
    { extensions: nextExt, comment: nextComment },
    userId,
  );
}

export async function patchEntryMeta(
  entry: LMBEntry,
  metaPatch: Partial<LMBEntryMeta>,
  userId: string,
): Promise<WorldBookEntryDTO> {
  const next: LMBEntryMeta = { ...entry.meta, ...metaPatch };
  const ext = (entry.raw.extensions || {}) as Record<string, unknown>;
  return spindle.world_books.entries.update(
    entry.raw.id,
    {
      extensions: { ...ext, [EXTENSION_KEY]: next },
    },
    userId,
  );
}

export function invalidateBookCache(userId: string, chatId: string): void {
  chatBookCache.delete(cacheKey(userId, chatId));
}

export function findCachedChatIdForBook(userId: string, bookId: string): string | null {
  const prefix = `${userId}::`;
  for (const [key, value] of chatBookCache) {
    if (!key.startsWith(prefix)) continue;
    if (value.bookId === bookId) return key.slice(prefix.length);
  }
  return null;
}

export async function findChatIdForBook(userId: string, bookId: string): Promise<string | null> {
  const cached = findCachedChatIdForBook(userId, bookId);
  if (cached) return cached;
  const book = await spindle.world_books.get(bookId, userId).catch(() => null);
  if (!book) return null;
  const meta = book.metadata && typeof book.metadata === "object" ? (book.metadata as Record<string, unknown>) : null;
  const claimed = meta && typeof meta["lumibooks_chat_id"] === "string" ? (meta["lumibooks_chat_id"] as string) : null;
  return claimed;
}

export function invalidateAllBookCacheEntriesForBook(userId: string, bookId: string): void {
  const prefix = `${userId}::`;
  const toDelete: string[] = [];
  for (const [key, value] of chatBookCache) {
    if (!key.startsWith(prefix)) continue;
    if (value.bookId === bookId) toDelete.push(key);
  }
  for (const k of toDelete) chatBookCache.delete(k);
}
