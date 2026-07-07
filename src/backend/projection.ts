declare const spindle: import("lumiverse-spindle-types").SpindleAPI;

import type { WorldBookEntryDTO } from "lumiverse-spindle-types";
import { PROJECTION_KEY, normalizeOutletName } from "../shared";
import { buildCoverage } from "./coverage";
import { loadSettings } from "./storage";
import { describeError, warn } from "./runtime";
import { ensureBookForChat, findBookForChat, invalidateBookCache, listAllEntries, listLmbEntries, type LMBEntry } from "./world-book";

interface ProjectionMeta {
  chatId: string;
  kind: "outlet";
}

function isProjection(entry: WorldBookEntryDTO, chatId: string): boolean {
  const ext = (entry.extensions || {}) as Record<string, unknown>;
  const meta = ext[PROJECTION_KEY] as Partial<ProjectionMeta> | undefined;
  return !!meta && meta.kind === "outlet" && meta.chatId === chatId;
}

function entrySortValue(entry: LMBEntry): number {
  if (typeof entry.meta.firstMsgIdx === "number") return entry.meta.firstMsgIdx;
  return entry.meta.isRoot ? -1000000 : 0;
}

export async function buildProjectionContent(chatId: string, userId: string): Promise<string> {
  const entries = await listLmbEntries(chatId, userId);
  if (entries.length === 0) return "";
  const coverage = await buildCoverage(chatId, userId, entries);
  return coverage.activeEntries
    .slice()
    .sort((a, b) => entrySortValue(a) - entrySortValue(b))
    .map((entry) => (entry.raw.content || "").trim())
    .filter(Boolean)
    .join("\n\n");
}

async function updateProjection(
  entry: WorldBookEntryDTO,
  patch: Record<string, unknown>,
  userId: string,
): Promise<void> {
  await spindle.world_books.entries.update(entry.id, patch as never, userId);
}

export async function syncProjectionEntry(chatId: string, userId: string): Promise<void> {
  try {
    const settings = await loadSettings(userId);
    const outletName = normalizeOutletName(settings.memoryOutletName);

    if (!settings.enabled || settings.memoryInjectionMode !== "outlet") {
      const existingBookId = await findBookForChat(chatId, userId).catch(() => null);
      if (!existingBookId) return;
      const entries = await listAllEntries(existingBookId, userId);
      const existing = entries.find((entry) => isProjection(entry, chatId)) ?? null;
      if (existing && (!existing.disabled || existing.content)) {
        await updateProjection(existing, { content: "", disabled: true }, userId);
        invalidateBookCache(userId, chatId);
      }
      return;
    }

    const book = await ensureBookForChat(chatId, userId);
    const entries = await listAllEntries(book.id, userId);
    const existing = entries.find((entry) => isProjection(entry, chatId)) ?? null;
    const content = await buildProjectionContent(chatId, userId);
    if (!content.trim()) {
      if (existing) {
        await updateProjection(existing, { content: "", disabled: true, outlet_name: outletName, position: 8 }, userId);
        invalidateBookCache(userId, chatId);
      }
      return;
    }

    const extensions = {
      ...(existing?.extensions && typeof existing.extensions === "object" ? existing.extensions : {}),
      [PROJECTION_KEY]: { chatId, kind: "outlet" satisfies ProjectionMeta["kind"] },
    };

    if (existing) {
      await updateProjection(existing, {
        content,
        comment: "[LumiBooks outlet projection]",
        disabled: false,
        constant: true,
        position: 8,
        outlet_name: outletName,
        key: [],
        keysecondary: [],
        vectorized: false,
        extensions,
      }, userId);
      invalidateBookCache(userId, chatId);
      return;
    }

    await spindle.world_books.entries.create(
      book.id,
      {
        content,
        comment: "[LumiBooks outlet projection]",
        disabled: false,
        constant: true,
        position: 8,
        outlet_name: outletName,
        key: [],
        keysecondary: [],
        vectorized: false,
        extensions,
      } as never,
      userId,
    );
    invalidateBookCache(userId, chatId);
  } catch (err) {
    warn(`syncProjectionEntry failed: ${describeError(err)}`);
  }
}
