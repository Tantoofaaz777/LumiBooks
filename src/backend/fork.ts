declare const spindle: import("lumiverse-spindle-types").SpindleAPI;

import type { WorldBookEntryDTO } from "lumiverse-spindle-types";
import type { LMBEntryMeta } from "../shared";
import { EXTENSION_KEY, bookNameFor } from "../shared";
import { findBookForChat, invalidateBookCache, listLmbEntries } from "./world-book";
import { loadSettings } from "./storage";
import { resyncVisibility } from "./coverage";
import { describeError, info, warn } from "./runtime";

// When Lumiverse branches a chat it (a) copies the parent's metadata verbatim —
// so the fork inherits a `lumibooks_book_id` claim pointing at the parent's
// shelf — and (b) regenerates every message ID while preserving `index_in_chat`.
// A fork therefore can't see the parent's memories (the ownership guard rejects
// the inherited claim, and msgIds no longer match) and its copied-but-hidden
// messages become silent context holes.
//
// We heal this lazily with copy-on-write: the first time we touch a forked chat
// that doesn't own a shelf, we clone the nearest ancestor's shelf into a new
// book owned by the fork, remapping each entry's msgIds parent->fork by
// index_in_chat. The parent's book is never mutated or shared, so intra-user
// isolation (a chat only ever writes its own shelf) is preserved.

const FORK_ADOPTED_FLAG = "lumibooks_fork_adopted";
const MAX_ANCESTRY_HOPS = 100;

const checked = new Set<string>();
const inflight = new Map<string, Promise<void>>();

function key(userId: string, chatId: string): string {
  return `${userId}::${chatId}`;
}

export async function ensureForkAdoption(chatId: string, userId: string): Promise<void> {
  const k = key(userId, chatId);
  if (checked.has(k)) return;
  const existing = inflight.get(k);
  if (existing) return existing;
  const p = (async () => {
    try {
      await doForkAdoption(chatId, userId);
      checked.add(k);
    } catch (err) {
      // Leave it unchecked so a transient failure retries on the next touch.
      warn(`fork adoption failed for ${chatId.slice(0, 8)}: ${describeError(err)}`);
    } finally {
      inflight.delete(k);
    }
  })();
  inflight.set(k, p);
  return p;
}

async function doForkAdoption(forkChatId: string, userId: string): Promise<void> {
  const chat = await spindle.chats.get(forkChatId, userId).catch(() => null);
  if (!chat) return;
  const meta = chat.metadata && typeof chat.metadata === "object" ? (chat.metadata as Record<string, unknown>) : null;
  const branchedFrom = meta && typeof meta["branched_from"] === "string" ? (meta["branched_from"] as string) : null;
  if (!branchedFrom) return; // not a fork
  if (meta && meta[FORK_ADOPTED_FLAG] === true) return; // already adopted (survives restarts)

  // Already owns a shelf (including a clone left by a prior partial run)? Nothing to do.
  const owned = await findBookForChat(forkChatId, userId).catch(() => null);
  if (owned) return;

  const ancestor = await findAncestorBook(branchedFrom, userId);
  if (!ancestor) return; // no ancestor shelf to inherit — fork starts clean

  await cloneShelfForFork(forkChatId, chat.name ?? null, ancestor.chatId, userId);
}

async function findAncestorBook(
  startChatId: string,
  userId: string,
): Promise<{ chatId: string; bookId: string } | null> {
  const seen = new Set<string>();
  let cur: string | null = startChatId;
  let hops = 0;
  while (cur && hops < MAX_ANCESTRY_HOPS) {
    const chatId: string = cur;
    if (seen.has(chatId)) break;
    seen.add(chatId);
    hops++;
    const bookId = await findBookForChat(chatId, userId).catch(() => null);
    if (bookId) return { chatId, bookId };
    const chat = await spindle.chats.get(chatId, userId).catch(() => null);
    const meta = chat && chat.metadata && typeof chat.metadata === "object"
      ? (chat.metadata as Record<string, unknown>)
      : null;
    cur = meta && typeof meta["branched_from"] === "string" ? (meta["branched_from"] as string) : null;
  }
  return null;
}

async function cloneShelfForFork(
  forkChatId: string,
  forkChatName: string | null,
  parentChatId: string,
  userId: string,
): Promise<void> {
  // findAncestorBook just primed findBookForChat's cache, so this lookup is cheap
  // and resolves the exact ancestor shelf we intend to clone.
  const parentEntries = await listLmbEntries(parentChatId, userId);
  if (parentEntries.length === 0) return; // empty shelf — let the fork make its own lazily

  const [forkMsgs, parentMsgs] = await Promise.all([
    spindle.chat.getMessages(forkChatId),
    spindle.chat.getMessages(parentChatId),
  ]);
  const parentIdxById = new Map<string, number>();
  for (const m of parentMsgs) parentIdxById.set(m.id, m.index_in_chat);
  const forkIdByIdx = new Map<number, string>();
  for (const m of forkMsgs) {
    if (forkIdByIdx.has(m.index_in_chat)) {
      warn(`fork adoption: duplicate index_in_chat ${m.index_in_chat} in fork ${forkChatId.slice(0, 8)}; remap may be imprecise`);
      continue; // first occurrence wins
    }
    forkIdByIdx.set(m.index_in_chat, m.id);
  }

  const remap = (msgIds: string[]): { ids: string[]; first?: number; last?: number } => {
    const ids: string[] = [];
    let first = Number.POSITIVE_INFINITY;
    let last = -1;
    for (const id of msgIds) {
      const idx = parentIdxById.get(id);
      if (idx === undefined) continue;
      const forkId = forkIdByIdx.get(idx);
      if (forkId === undefined) continue; // message lives beyond the branch cut
      ids.push(forkId);
      if (idx < first) first = idx;
      if (idx > last) last = idx;
    }
    return {
      ids,
      first: first === Number.POSITIVE_INFINITY ? undefined : first,
      last: last === -1 ? undefined : last,
    };
  };

  const chapters = parentEntries.filter((e) => e.meta.tier === 1);
  const arcs = parentEntries.filter((e) => e.meta.tier === 2);

  const newBook = await spindle.world_books.create(
    {
      name: bookNameFor(forkChatName, forkChatId),
      description: "Memoria's shelf for this chat. Chapters and arcs live here.",
      metadata: {
        lumibooks_chat_id: forkChatId,
        lumibooks_created_at: Date.now(),
        lumibooks_forked_from: parentChatId,
      },
    },
    userId,
  );

  // From here the clone is all-or-nothing: any failure rolls back the new book so
  // the next adoption attempt starts clean (no half-populated or duplicate shelf).
  const idMap = new Map<string, string>(); // parent entry id -> fork entry id
  const clonedChapterMeta = new Map<string, LMBEntryMeta>(); // parent chapter id -> cloned meta
  try {
    // Pass 1: chapters. Cross-references (supersededByEntryId) are patched in pass 3.
    for (const ch of chapters) {
      const { ids, first, last } = remap(ch.meta.msgIds);
      if (ids.length === 0) continue; // entirely beyond the branch cut -> drop
      const meta: LMBEntryMeta = {
        ...ch.meta,
        chatId: forkChatId,
        msgIds: ids,
        firstMsgIdx: first,
        lastMsgIdx: last,
        supersededByEntryId: null,
      };
      const created = await createClone(newBook.id, ch.raw, meta, userId);
      idMap.set(ch.raw.id, created.id);
      clonedChapterMeta.set(ch.raw.id, meta);
    }

    // Pass 2: arcs, remapping source chapter references to the freshly cloned ids.
    for (const arc of arcs) {
      const { ids, first, last } = remap(arc.meta.msgIds);
      const sourceChapterEntryIds = (arc.meta.sourceChapterEntryIds ?? [])
        .map((oldId) => idMap.get(oldId))
        .filter((x): x is string => typeof x === "string");
      if (ids.length === 0 && sourceChapterEntryIds.length === 0) continue; // nothing survived -> drop
      // When the arc's own msgIds didn't survive the cut, derive its display range
      // from the cloned source chapters rather than the meaningless parent indices.
      let firstIdx = first;
      let lastIdx = last;
      if (firstIdx === undefined || lastIdx === undefined) {
        for (const oldId of arc.meta.sourceChapterEntryIds ?? []) {
          const cm = clonedChapterMeta.get(oldId);
          if (!cm) continue;
          if (cm.firstMsgIdx !== undefined) firstIdx = firstIdx === undefined ? cm.firstMsgIdx : Math.min(firstIdx, cm.firstMsgIdx);
          if (cm.lastMsgIdx !== undefined) lastIdx = lastIdx === undefined ? cm.lastMsgIdx : Math.max(lastIdx, cm.lastMsgIdx);
        }
      }
      const meta: LMBEntryMeta = {
        ...arc.meta,
        chatId: forkChatId,
        msgIds: ids,
        sourceChapterEntryIds,
        firstMsgIdx: firstIdx,
        lastMsgIdx: lastIdx,
      };
      const created = await createClone(newBook.id, arc.raw, meta, userId);
      idMap.set(arc.raw.id, created.id);
    }

    // Pass 3: re-point each surviving chapter at its arc, if that arc also survived.
    // (If the covering arc was dropped, the chapter is left active again — correct,
    // since nothing else now covers its messages.)
    for (const ch of chapters) {
      const newChId = idMap.get(ch.raw.id);
      if (!newChId) continue;
      const oldArcId = ch.meta.supersededByEntryId;
      if (!oldArcId) continue;
      const newArcId = idMap.get(oldArcId);
      if (!newArcId) continue;
      const baseMeta = clonedChapterMeta.get(ch.raw.id);
      if (!baseMeta) continue;
      const ext = (ch.raw.extensions || {}) as Record<string, unknown>;
      await spindle.world_books.entries.update(
        newChId,
        { extensions: { ...ext, [EXTENSION_KEY]: { ...baseMeta, supersededByEntryId: newArcId } } },
        userId,
      );
    }

    await rebindForkShelf(forkChatId, newBook.id, userId);
  } catch (err) {
    await spindle.world_books.delete(newBook.id, userId).catch(() => {});
    throw err;
  }

  invalidateBookCache(userId, forkChatId);

  // Close any context holes: messages copied as hidden whose covering entry did
  // not survive the branch cut must be unhidden.
  try {
    const settings = await loadSettings(userId);
    const profile = settings.profiles.find((p) => p.id === settings.activeProfileId);
    const desiredHidden = profile ? profile.hideCoveredMessages : true;
    await resyncVisibility(forkChatId, userId, desiredHidden);
  } catch (err) {
    warn(`fork adoption: visibility resync failed: ${describeError(err)}`);
  }

  info(`adopted fork ${forkChatId.slice(0, 8)} from ${parentChatId.slice(0, 8)} (${idMap.size} entries cloned)`);
}

async function createClone(
  bookId: string,
  source: WorldBookEntryDTO,
  meta: LMBEntryMeta,
  userId: string,
): Promise<WorldBookEntryDTO> {
  const ext = (source.extensions || {}) as Record<string, unknown>;
  return spindle.world_books.entries.create(
    bookId,
    {
      content: source.content,
      comment: source.comment,
      disabled: source.disabled,
      constant: source.constant,
      key: source.key ?? [],
      keysecondary: source.keysecondary ?? [],
      vectorized: source.vectorized ?? false,
      extensions: { ...ext, [EXTENSION_KEY]: meta },
    },
    userId,
  );
}

async function rebindForkShelf(forkChatId: string, newBookId: string, userId: string): Promise<void> {
  const chat = await spindle.chats.get(forkChatId, userId).catch(() => null);
  if (!chat) return;
  const metadata = chat.metadata && typeof chat.metadata === "object"
    ? { ...(chat.metadata as Record<string, unknown>) }
    : {};
  const inheritedBookId =
    typeof metadata["lumibooks_book_id"] === "string" ? (metadata["lumibooks_book_id"] as string) : null;
  const existing = Array.isArray(metadata["chat_world_book_ids"])
    ? (metadata["chat_world_book_ids"] as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  // Drop the inherited (parent's) shelf and any stale copy of the new id, then bind the clone.
  const nextBookIds = existing.filter((id) => id !== inheritedBookId && id !== newBookId);
  nextBookIds.push(newBookId);
  metadata["chat_world_book_ids"] = nextBookIds;
  metadata["lumibooks_book_id"] = newBookId;
  metadata[FORK_ADOPTED_FLAG] = true;
  await spindle.chats.update(forkChatId, { metadata }, userId);
}
