declare const spindle: import("lumiverse-spindle-types").SpindleAPI;

import type { WorldBookEntryDTO } from "lumiverse-spindle-types";
import { EXTENSION_KEY, PROJECTION_KEY, normalizeEntryMeta, normalizeOutletName } from "../shared";
import { findBookForChat, invalidateBookCache, listAllEntries } from "./world-book";
import { loadSettings } from "./storage";
import { describeError, warn } from "./runtime";
import { storyOrderFromMeta } from "./story-order";
import type { ChatRefreshContext } from "./refresh-context";

interface ProjectionMeta {
  chatId: string;
  kind: "outlet";
}

function isProjection(entry: WorldBookEntryDTO, chatId: string): boolean {
  const ext = (entry.extensions || {}) as Record<string, unknown>;
  const meta = ext[PROJECTION_KEY] as Partial<ProjectionMeta> | undefined;
  return !!meta && meta.kind === "outlet" && meta.chatId === chatId;
}

function orderValueFor(meta: ReturnType<typeof normalizeEntryMeta>, fallback: number): number {
  if (!meta) return fallback;
  return storyOrderFromMeta(meta, fallback);
}

async function updateEntry(
  entry: WorldBookEntryDTO,
  patch: Record<string, unknown>,
  userId: string,
): Promise<WorldBookEntryDTO> {
  return spindle.world_books.entries.update(entry.id, patch as never, userId);
}

export async function syncProjectionEntry(
  chatId: string,
  userId: string,
  context?: ChatRefreshContext,
): Promise<void> {
  try {
    const bookId = context ? context.bookId : await findBookForChat(chatId, userId).catch(() => null);
    if (!bookId) return;

    const settings = context?.settings ?? await loadSettings(userId);
    const outletMode = settings.enabled;
    const outletName = normalizeOutletName(settings.memoryOutletName);
    const desiredConstant = settings.forceConstantEntries;
    const entries = context?.rawEntries ?? await listAllEntries(bookId, userId);
    let touched = false;

    for (const entry of entries) {
      if (!isProjection(entry, chatId)) continue;
      await spindle.world_books.entries.delete(entry.id, userId).catch((err) => {
        warn(`outlet migration: failed to delete projection ${entry.id}: ${describeError(err)}`);
      });
      touched = true;
    }

    for (const entry of entries) {
      const ext = (entry.extensions || {}) as Record<string, unknown>;
      const meta = normalizeEntryMeta(ext[EXTENSION_KEY]);
      if (!meta || meta.chatId !== chatId) continue;

      const orderValue = orderValueFor(meta, entry.order_value);
      const currentOutletName = ((entry as unknown as { outlet_name?: string }).outlet_name ?? "").trim();
      const patch = outletMode
        ? {
            position: 8,
            outlet_name: outletName,
            constant: desiredConstant,
            order_value: orderValue,
          }
        : {
            position: 0,
            outlet_name: "",
            order_value: orderValue,
          };
      const needsPatch =
        entry.position !== patch.position ||
        entry.order_value !== orderValue ||
        (outletMode && entry.constant !== desiredConstant) ||
        currentOutletName !== patch.outlet_name;
      if (!needsPatch) continue;
      const updated = await updateEntry(entry, patch, userId);
      Object.assign(entry, updated);
      touched = true;
    }

    if (touched && !context) invalidateBookCache(userId, chatId);
  } catch (err) {
    warn(`syncProjectionEntry failed: ${describeError(err)}`);
  }
}
