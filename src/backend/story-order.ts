declare const spindle: import("lumiverse-spindle-types").SpindleAPI;

import type { LMBEntryMeta } from "../shared";
import { EXTENSION_KEY } from "../shared";
import { describeError, warn } from "./runtime";
import { invalidateBookCache, listLmbEntries, type LMBEntry } from "./world-book";

export function storyOrderOf(entry: LMBEntry): number {
  return storyOrderFromMeta(entry.meta, entry.raw.order_value);
}

export function storyOrderFromMeta(meta: LMBEntryMeta, fallback = 1000000): number {
  if (typeof meta.storyOrder === "number") return meta.storyOrder;
  if (typeof meta.sceneNumber === "number") return meta.sceneNumber;
  if (typeof meta.firstMsgIdx === "number") return meta.firstMsgIdx + 1;
  return fallback;
}

export function nextStoryOrder(entries: LMBEntry[]): number {
  let max = 0;
  for (const entry of entries) {
    const n = storyOrderFromMeta(entry.meta, entry.raw.order_value);
    if (Number.isFinite(n) && n > max && n < 1000000) max = n;
  }
  return max + 1;
}

export function inheritedStoryOrder(sources: LMBEntry[], fallbackEntries: LMBEntry[] = []): number {
  const values = sources
    .map(storyOrderOf)
    .filter((n) => Number.isFinite(n) && n > 0);
  if (values.length) return Math.min(...values);
  return nextStoryOrder(fallbackEntries);
}

export async function syncStoryOrderForChat(chatId: string, userId: string): Promise<void> {
  const entries = await listLmbEntries(chatId, userId).catch(() => [] as LMBEntry[]);
  if (entries.length === 0) return;

  let next = nextStoryOrder(entries.filter((entry) => typeof entry.meta.storyOrder === "number"));
  const metaById = new Map(entries.map((entry) => [entry.raw.id, entry.meta] as const));
  const sorted = entries
    .slice()
    .sort((a, b) => {
      const ao = storyOrderFromMeta(a.meta, a.raw.order_value);
      const bo = storyOrderFromMeta(b.meta, b.raw.order_value);
      if (ao !== bo) return ao - bo;
      if (a.meta.tier !== b.meta.tier) return a.meta.tier - b.meta.tier;
      return (a.meta.firstMsgIdx ?? 0) - (b.meta.firstMsgIdx ?? 0);
    });

  let touched = false;
  for (const entry of sorted) {
    const hadStoryOrder = typeof entry.meta.storyOrder === "number";
    let storyOrder = entry.meta.storyOrder;
    if (typeof storyOrder !== "number") {
      const sourceOrders = (entry.meta.sourceChapterEntryIds ?? [])
        .map((id) => metaById.get(id)?.storyOrder)
        .filter((n): n is number => typeof n === "number");
      storyOrder = sourceOrders.length ? Math.min(...sourceOrders) : next++;
      entry.meta.storyOrder = storyOrder;
      metaById.set(entry.raw.id, entry.meta);
    }
    if (hadStoryOrder && entry.raw.order_value === storyOrder) continue;
    const ext = (entry.raw.extensions || {}) as Record<string, unknown>;
    try {
      await spindle.world_books.entries.update(
        entry.raw.id,
        {
          order_value: storyOrder,
          extensions: { ...ext, [EXTENSION_KEY]: { ...entry.meta, storyOrder } },
        },
        userId,
      );
      touched = true;
    } catch (err) {
      warn(`storyOrder sync failed for ${entry.raw.id}: ${describeError(err)}`);
    }
  }

  if (touched) invalidateBookCache(userId, chatId);
}
