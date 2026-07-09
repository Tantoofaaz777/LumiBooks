declare const spindle: import("lumiverse-spindle-types").SpindleAPI;

import type { WorldBookEntryDTO } from "lumiverse-spindle-types";
import type { AdoptLorebookCandidate, AdoptLorebookPlanEntry } from "../types";
import type { LMBEntryMeta } from "../shared";
import { EXTENSION_KEY, approximateTokensFromChars, normalizeOutletName } from "../shared";
import { loadSettings } from "./storage";
import {
  adoptBookForChat,
  findBookForChat,
  getChatAttachedBookIds,
  invalidateBookCache,
  listAllEntries,
  listLmbEntries,
} from "./world-book";

export async function listAdoptLorebookCandidates(chatId: string, userId: string): Promise<AdoptLorebookCandidate[]> {
  const targetBookId = await findBookForChat(chatId, userId).catch(() => null);
  const attachedIds = await getChatAttachedBookIds(chatId, userId);
  const sourceBookIds = [...new Set(attachedIds.filter((id) => id !== targetBookId))];
  const books: AdoptLorebookCandidate[] = [];
  for (const bookId of sourceBookIds) {
    const book = await spindle.world_books.get(bookId, userId).catch(() => null);
    if (!book) continue;
    const entries = await listAllEntries(bookId, userId).catch(() => [] as WorldBookEntryDTO[]);
    const drafts = entries
      .filter((entry) => !entry.disabled)
      .sort((a, b) => {
        if (a.order_value !== b.order_value) return a.order_value - b.order_value;
        return a.created_at - b.created_at;
      })
      .map((entry) => {
        const ext = (entry.extensions || {}) as Record<string, unknown>;
        return {
          entryId: entry.id,
          comment: entry.comment || "(untitled)",
          preview: (entry.content || "").slice(0, 220).replace(/\s+/g, " ").trim(),
          orderValue: entry.order_value,
          contentChars: (entry.content || "").length,
          alreadyManaged: !!ext[EXTENSION_KEY],
        };
      });
    if (drafts.length > 0) books.push({ bookId: book.id, name: book.name || book.id, entries: drafts });
  }
  return books;
}

export async function confirmAdoptLorebook(
  chatId: string,
  userId: string,
  bookId: string,
  plan: AdoptLorebookPlanEntry[],
): Promise<{ adopted: number; skipped: number }> {
  const settings = await loadSettings(userId);
  await adoptBookForChat(chatId, bookId, userId);
  const existing = await listLmbEntries(chatId, userId);
  const sceneCounts = new Map<1 | 2 | 3, number>([
    [1, 0],
    [2, 0],
    [3, 0],
  ]);
  for (const entry of existing) {
    if (entry.meta.isRoot) continue;
    sceneCounts.set(entry.meta.tier, Math.max(sceneCounts.get(entry.meta.tier) ?? 0, entry.meta.sceneNumber ?? 0));
  }

  const entries = await listAllEntries(bookId, userId);
  const byId = new Map(entries.map((entry) => [entry.id, entry] as const));
  const orderedPlan = plan
    .filter((entry) => entry.tier === 1 || entry.tier === 2 || entry.tier === 3)
    .slice()
    .sort((a, b) => a.storyOrder - b.storyOrder);
  let adopted = 0;
  let skipped = 0;
  for (const item of orderedPlan) {
    const source = byId.get(item.entryId);
    if (!source || source.disabled) {
      skipped++;
      continue;
    }
    const ext = (source.extensions || {}) as Record<string, unknown>;
    if (ext[EXTENSION_KEY]) {
      skipped++;
      continue;
    }
    const tier = item.tier as 1 | 2 | 3;
    const sceneNumber = (sceneCounts.get(tier) ?? 0) + 1;
    sceneCounts.set(tier, sceneNumber);
    const title = cleanTitle(source.comment) || cleanTitle(source.content.split(/\n+/, 1)[0] || "") || "Imported Memory";
    const meta: LMBEntryMeta = {
      tier,
      chatId,
      msgIds: [],
      tokenCountInput: 0,
      tokenCountOutput: approximateTokensFromChars((source.content || "").length),
      model: "adopted",
      connectionId: "adopted",
      createdAt: source.created_at || Date.now(),
      title,
      sceneNumber,
      storyOrder: item.storyOrder,
      preserveComment: true,
    };
    await spindle.world_books.entries.update(
      source.id,
      {
        constant: true,
        position: 8,
        outlet_name: normalizeOutletName(settings.memoryOutletName),
        order_value: item.storyOrder,
        extensions: { ...ext, [EXTENSION_KEY]: meta },
      } as never,
      userId,
    );
    adopted++;
  }
  invalidateBookCache(userId, chatId);
  return { adopted, skipped };
}

function cleanTitle(text: string): string {
  return text.trim();
}
