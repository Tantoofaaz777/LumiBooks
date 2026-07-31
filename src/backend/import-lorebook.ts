declare const spindle: import("lumiverse-spindle-types").SpindleAPI;

import type { WorldBookEntryDTO } from "lumiverse-spindle-types";
import type { AdoptLorebookCandidate, AdoptLorebookPlanEntry } from "../types";
import type { LMBEntryMeta } from "../shared";
import { EXTENSION_KEY, approximateTokensFromChars, normalizeEntryMeta, normalizeOutletName } from "../shared";
import { loadSettings } from "./storage";
import { describeError, warn } from "./runtime";
import {
  adoptBookForChat,
  findBookForChat,
  getChatAttachedBookIds,
  invalidateBookCache,
  listAllEntries,
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
        const existingMeta = normalizeEntryMeta(ext[EXTENSION_KEY]);
        return {
          entryId: entry.id,
          comment: entry.comment || "(untitled)",
          preview: (entry.content || "").slice(0, 220).replace(/\s+/g, " ").trim(),
          orderValue: entry.order_value,
          contentChars: (entry.content || "").length,
          alreadyManaged: !!existingMeta,
          managedChatId: existingMeta?.chatId ?? null,
          managedTier: existingMeta?.tier ?? null,
          managedStoryOrder: existingMeta?.storyOrder ?? existingMeta?.sceneNumber ?? null,
          managedSourceEntryIds: existingMeta?.sourceChapterEntryIds ?? [],
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
  const entries = await listAllEntries(bookId, userId);
  const sceneCounts = new Map<1 | 2 | 3, number>([
    [1, 0],
    [2, 0],
    [3, 0],
  ]);
  for (const entry of entries) {
    const ext = (entry.extensions || {}) as Record<string, unknown>;
    const meta = normalizeEntryMeta(ext[EXTENSION_KEY]);
    if (!meta || meta.chatId !== chatId) continue;
    sceneCounts.set(meta.tier, Math.max(sceneCounts.get(meta.tier) ?? 0, meta.sceneNumber ?? 0));
  }

  const byId = new Map(entries.map((entry) => [entry.id, entry] as const));
  const planIds = new Set<string>();
  for (const item of plan) {
    if (planIds.has(item.entryId)) throw new Error(`Adoption plan contains entry ${item.entryId} more than once`);
    planIds.add(item.entryId);
  }

  interface PreparedEntry {
    source: WorldBookEntryDTO;
    item: AdoptLorebookPlanEntry & { tier: 1 | 2 | 3 };
    existingMeta: LMBEntryMeta | null;
    planIndex: number;
    sourceEntryIds: string[];
    storyOrder: number;
  }

  let adopted = 0;
  let skipped = 0;
  const prepared: PreparedEntry[] = [];
  for (let planIndex = 0; planIndex < plan.length; planIndex++) {
    const item = plan[planIndex]!;
    if (item.tier !== 1 && item.tier !== 2 && item.tier !== 3) continue;
    const source = byId.get(item.entryId);
    if (!source || source.disabled) {
      skipped++;
      continue;
    }
    const ext = (source.extensions || {}) as Record<string, unknown>;
    const existingMeta = normalizeEntryMeta(ext[EXTENSION_KEY]);
    if (existingMeta?.chatId === chatId) {
      skipped++;
      continue;
    }
    const storyOrder = Number.isFinite(item.storyOrder) && item.storyOrder > 0
      ? Math.floor(item.storyOrder)
      : planIndex + 1;
    prepared.push({
      source,
      item: { ...item, tier: item.tier },
      existingMeta,
      planIndex,
      sourceEntryIds: [],
      storyOrder,
    });
  }

  const preparedById = new Map(prepared.map((entry) => [entry.source.id, entry] as const));
  const claimedSources = new Map<string, string>();
  for (const parent of prepared) {
    const rawSourceIds = Array.isArray(parent.item.sourceEntryIds)
      ? parent.item.sourceEntryIds.filter((id): id is string => typeof id === "string")
      : [];
    const sourceIds = [...new Set(rawSourceIds)];
    if (parent.item.tier === 1 && sourceIds.length > 0) {
      throw new Error(`Chapter "${parent.source.comment || parent.source.id}" cannot contain source entries`);
    }
    for (const sourceId of sourceIds) {
      const child = preparedById.get(sourceId);
      if (!child) {
        throw new Error(`Source entry ${sourceId} must also be selected for adoption`);
      }
      if (child.item.tier !== parent.item.tier - 1) {
        const expected = parent.item.tier === 3 ? "arc" : "chapter";
        throw new Error(`"${child.source.comment || child.source.id}" is not a valid ${expected} source`);
      }
      const claimedBy = claimedSources.get(sourceId);
      if (claimedBy && claimedBy !== parent.source.id) {
        throw new Error(`"${child.source.comment || child.source.id}" is assigned to more than one parent`);
      }
      claimedSources.set(sourceId, parent.source.id);
    }
    parent.sourceEntryIds = sourceIds;
  }

  const resolving = new Set<string>();
  const resolvedOrders = new Map<string, number>();
  const resolveStoryOrder = (entry: PreparedEntry): number => {
    const cached = resolvedOrders.get(entry.source.id);
    if (cached !== undefined) return cached;
    if (resolving.has(entry.source.id)) throw new Error("Adoption hierarchy contains a cycle");
    resolving.add(entry.source.id);
    const sourceOrders = entry.sourceEntryIds.map((sourceId) => resolveStoryOrder(preparedById.get(sourceId)!));
    const resolved = sourceOrders.length > 0 ? Math.min(...sourceOrders) : entry.storyOrder;
    resolving.delete(entry.source.id);
    resolvedOrders.set(entry.source.id, resolved);
    return resolved;
  };
  for (const entry of prepared) entry.storyOrder = resolveStoryOrder(entry);
  for (const entry of prepared) {
    entry.sourceEntryIds.sort((left, right) => {
      const leftEntry = preparedById.get(left)!;
      const rightEntry = preparedById.get(right)!;
      return leftEntry.storyOrder - rightEntry.storyOrder || leftEntry.planIndex - rightEntry.planIndex;
    });
  }
  prepared.sort((left, right) => {
    return left.storyOrder - right.storyOrder || left.item.tier - right.item.tier || left.planIndex - right.planIndex;
  });
  if (prepared.length === 0) return { adopted: 0, skipped };

  const updatedEntries: WorldBookEntryDTO[] = [];
  try {
    for (const preparedEntry of prepared) {
      const { source, item, existingMeta, sourceEntryIds, storyOrder } = preparedEntry;
      const ext = (source.extensions || {}) as Record<string, unknown>;
      const tier = item.tier as 1 | 2 | 3;
      const sceneNumber = (sceneCounts.get(tier) ?? 0) + 1;
      sceneCounts.set(tier, sceneNumber);
      const title = existingMeta?.title || cleanTitle(source.comment) || cleanTitle(source.content.split(/\n+/, 1)[0] || "") || "Imported entry";
      const meta: LMBEntryMeta = {
        ...existingMeta,
        tier,
        chatId,
        msgIds: [],
        sourceChapterEntryIds: tier === 1 ? undefined : sourceEntryIds,
        firstMsgIdx: undefined,
        lastMsgIdx: undefined,
        tokenCountInput: 0,
        tokenCountOutput: approximateTokensFromChars((source.content || "").length),
        model: existingMeta?.model || "adopted",
        connectionId: existingMeta?.connectionId || "adopted",
        createdAt: existingMeta?.createdAt || source.created_at || Date.now(),
        title,
        sceneNumber,
        storyOrder,
        preserveComment: true,
        forkMode: "baseline",
        supersededByEntryId: claimedSources.get(source.id) ?? null,
      };
      await spindle.world_books.entries.update(
        source.id,
        {
          disabled: claimedSources.has(source.id),
          constant: settings.forceConstantEntries,
          position: 8,
          outlet_name: normalizeOutletName(settings.memoryOutletName),
          order_value: storyOrder,
          extensions: { ...ext, [EXTENSION_KEY]: meta },
        } as never,
        userId,
      );
      updatedEntries.push(source);
      adopted++;
    }
    await adoptBookForChat(chatId, bookId, userId);
  } catch (err) {
    for (let i = updatedEntries.length - 1; i >= 0; i--) {
      const source = updatedEntries[i]!;
      const outletName = (source as unknown as { outlet_name?: string }).outlet_name;
      await spindle.world_books.entries.update(
        source.id,
        {
          disabled: source.disabled,
          constant: source.constant,
          position: source.position,
          outlet_name: typeof outletName === "string" ? outletName : "",
          order_value: source.order_value,
          extensions: source.extensions || {},
        } as never,
        userId,
      ).catch((rollbackErr) => {
        warn(`entry adoption rollback failed for ${source.id}: ${describeError(rollbackErr)}`);
      });
    }
    invalidateBookCache(userId, chatId);
    throw err;
  }
  invalidateBookCache(userId, chatId);
  return { adopted, skipped };
}

function cleanTitle(text: string): string {
  return text.trim();
}
