declare const spindle: import("lumiverse-spindle-types").SpindleAPI;

import type { WorldBookEntryDTO } from "lumiverse-spindle-types";
import type { LMBEntryMeta } from "../shared";
import { EXTENSION_KEY, approximateTokensFromChars } from "../shared";
import { formatEntryName } from "./naming";
import { loadSettings } from "./storage";
import {
  createChapterEntry,
  ensureBookForChat,
  getChatAttachedBookIds,
  invalidateBookCache,
  listAllEntries,
  listLmbEntries,
} from "./world-book";
import { nextStoryOrder } from "./story-order";

export interface ImportAttachedLorebooksResult {
  imported: number;
  skippedNoRange: number;
  skippedDuplicate: number;
  skippedInvalidRange: number;
  scannedBooks: number;
  details: string[];
  hideThroughIdx?: number;
}

interface ImportCandidate {
  source: WorldBookEntryDTO;
  firstMsgIdx: number;
  lastMsgIdx: number;
  title: string;
}

interface ParsedSourceEntry {
  entry: WorldBookEntryDTO;
  parsed: { start: number; end: number; raw: string };
}

const RANGE_PATTERNS = [
  /\((?:msgs?|messages?)?\s*(\d{1,6})\s*[-–—]\s*(\d{1,6})\)/i,
  /\bmsgs?\s*(\d{1,6})\s*[-–—]\s*(\d{1,6})\b/i,
  /\bmessages?\s*(\d{1,6})\s*[-–—]\s*(\d{1,6})\b/i,
];

export async function importAttachedLorebooks(chatId: string, userId: string): Promise<ImportAttachedLorebooksResult> {
  const settings = await loadSettings(userId);
  const targetBook = await ensureBookForChat(chatId, userId);
  const attachedIds = await getChatAttachedBookIds(chatId, userId);
  const sourceBookIds = [...new Set(attachedIds.filter((id) => id !== targetBook.id))];
  const messages = await spindle.chat.getMessages(chatId);
  const existing = await listLmbEntries(chatId, userId);
  const existingRanges = new Set(
    existing
      .filter((entry) => entry.meta.tier === 1)
      .map((entry) => `${entry.meta.firstMsgIdx ?? -1}:${entry.meta.lastMsgIdx ?? -1}`),
  );
  const occupiedRanges = existing
    .filter((entry) => entry.meta.tier === 1)
    .map((entry) => ({
      first: entry.meta.firstMsgIdx ?? -1,
      last: entry.meta.lastMsgIdx ?? -1,
    }))
    .filter((range) => range.first >= 0 && range.last >= range.first);

  const candidates: ImportCandidate[] = [];
  let skippedNoRange = 0;
  let skippedDuplicate = 0;
  let skippedInvalidRange = 0;
  let scannedBooks = 0;
  let hideThroughIdx: number | undefined;
  const details: string[] = [];

  for (const bookId of sourceBookIds) {
    const book = await spindle.world_books.get(bookId, userId).catch(() => null);
    if (!book) continue;
    scannedBooks++;
    const entries = await listAllEntries(bookId, userId).catch(() => [] as WorldBookEntryDTO[]);
    const parsedEntries: ParsedSourceEntry[] = [];
    for (const entry of entries) {
      if (entry.disabled) continue;
      const ext = (entry.extensions || {}) as Record<string, unknown>;
      if (ext[EXTENSION_KEY]) continue;
      const parsed = parseRange(entry.comment || entry.content.split(/\n+/, 1)[0] || "");
      if (!parsed) {
        skippedNoRange++;
        addDetail(details, `${entryLabel(entry)}: no range`);
        continue;
      }
      parsedEntries.push({ entry, parsed });
    }

    const zeroBasedBook = parsedEntries.some(({ parsed }) => parsed.start === 0);
    for (const { entry, parsed } of parsedEntries) {
      const resolved = resolveRange(parsed.start, parsed.end, messages.length, zeroBasedBook);
      if (!resolved) {
        skippedInvalidRange++;
        addDetail(details, `${entryLabel(entry)}: invalid range ${parsed.start}-${parsed.end} for ${messages.length} chat messages`);
        continue;
      }
      const { firstMsgIdx, lastMsgIdx } = resolved;
      const key = `${firstMsgIdx}:${lastMsgIdx}`;
      if (existingRanges.has(key)) {
        skippedDuplicate++;
        addDetail(details, `${entryLabel(entry)}: duplicate range`);
        continue;
      }
      if (occupiedRanges.some((range) => rangesOverlap(firstMsgIdx, lastMsgIdx, range.first, range.last))) {
        skippedDuplicate++;
        addDetail(details, `${entryLabel(entry)}: overlapping range`);
        continue;
      }
      existingRanges.add(key);
      occupiedRanges.push({ first: firstMsgIdx, last: lastMsgIdx });
      candidates.push({
        source: entry,
        firstMsgIdx,
        lastMsgIdx,
        title: cleanTitle(entry.comment, parsed.raw) || cleanTitle(entry.content.split(/\n+/, 1)[0] || "", parsed.raw) || "Imported Memory",
      });
    }
  }

  candidates.sort((a, b) => a.firstMsgIdx - b.firstMsgIdx);
  const maxScene = existing.reduce((max, entry) => {
    if (entry.meta.tier !== 1 || entry.meta.isRoot) return max;
    return Math.max(max, entry.meta.sceneNumber ?? 0);
  }, 0);
  const firstStoryOrder = nextStoryOrder(existing);

  let imported = 0;
  for (const candidate of candidates) {
    const msgIds = messages
      .slice(candidate.firstMsgIdx, candidate.lastMsgIdx + 1)
      .map((message) => message.id);
    const sceneNumber = maxScene + imported + 1;
    const storyOrder = firstStoryOrder + imported;
    const meta: LMBEntryMeta = {
      tier: 1,
      chatId,
      msgIds,
      firstMsgIdx: candidate.firstMsgIdx,
      lastMsgIdx: candidate.lastMsgIdx,
      tokenCountInput: 0,
      tokenCountOutput: approximateTokensFromChars((candidate.source.content || "").length),
      model: "imported",
      connectionId: "imported",
      createdAt: candidate.source.created_at || Date.now(),
      title: candidate.title,
      sceneNumber,
      storyOrder,
    };
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
    await createChapterEntry(
      targetBook.id,
      meta,
      candidate.source.content || "",
      comment,
      userId,
      candidate.source.key ?? [],
      settings.forceConstantEntries,
    );
    hideThroughIdx = hideThroughIdx === undefined
      ? candidate.lastMsgIdx
      : Math.max(hideThroughIdx, candidate.lastMsgIdx);
    imported++;
  }

  if (imported > 0) invalidateBookCache(userId, chatId);
  return { imported, skippedNoRange, skippedDuplicate, skippedInvalidRange, scannedBooks, details, hideThroughIdx };
}

function parseRange(text: string): { start: number; end: number; raw: string } | null {
  for (const pattern of RANGE_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    return { start, end, raw: match[0] };
  }
  return null;
}

function resolveRange(
  start: number,
  end: number,
  messageCount: number,
  preferZeroBased: boolean,
): { firstMsgIdx: number; lastMsgIdx: number } | null {
  const zeroBased = { firstMsgIdx: start, lastMsgIdx: end };
  const oneBased = { firstMsgIdx: start - 1, lastMsgIdx: end - 1 };
  const preferred = preferZeroBased ? zeroBased : oneBased;
  if (isValidRange(preferred.firstMsgIdx, preferred.lastMsgIdx, messageCount)) return preferred;
  const fallback = preferZeroBased ? oneBased : zeroBased;
  if (isValidRange(fallback.firstMsgIdx, fallback.lastMsgIdx, messageCount)) return fallback;
  return null;
}

function isValidRange(firstMsgIdx: number, lastMsgIdx: number, messageCount: number): boolean {
  return firstMsgIdx >= 0 && lastMsgIdx >= firstMsgIdx && lastMsgIdx < messageCount;
}

function cleanTitle(text: string, rangeRaw: string): string {
  return text
    .replace(rangeRaw, "")
    .replace(/\bmsgs?\s*$/i, "")
    .replace(/\bmessages?\s*$/i, "")
    .replace(/[-–—:#[\]()[\]\s]+$/g, "")
    .replace(/^\s*[-–—:#[\]()[\]\s]+/g, "")
    .trim();
}

function rangesOverlap(aFirst: number, aLast: number, bFirst: number, bLast: number): boolean {
  return aFirst <= bLast && bFirst <= aLast;
}

function entryLabel(entry: WorldBookEntryDTO): string {
  const label = (entry.comment || entry.content.split(/\n+/, 1)[0] || entry.id).trim();
  return label.length > 80 ? `${label.slice(0, 77)}...` : label;
}

function addDetail(details: string[], detail: string): void {
  if (details.length < 3) details.push(detail);
}
