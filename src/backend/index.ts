declare const spindle: import("lumiverse-spindle-types").SpindleAPI;

import type { LlmMessageDTO } from "lumiverse-spindle-types";
import type { FrontendToBackend } from "../types";
import { EXTENSION_KEY, normalizeProfile, normalizeCustomPreset } from "../shared";
import {
  debug,
  describeError,
  ensureUserFolders,
  error,
  getBootstrapUserId,
  hostToast,
  info,
  readChatIdFromMessage,
  rememberChatUser,
  resolveUserId,
  send,
  setLastFrontendUserId,
  warn,
} from "./runtime";
import { loadSettings, mutateSettings, patchSettings } from "./storage";
import {
  applyConstantToAllLmbEntries,
  ensureBookForChat,
  deleteEntry,
  patchEntryMeta,
  releaseEntry,
  updateEntry,
  listLmbEntries,
  invalidateBookCache,
  findChatIdForBook,
  findCachedChatIdForBook,
  invalidateAllBookCacheEntriesForBook,
} from "./world-book";
import { buildInjection } from "./injection";
import {
  abortBusy,
  acceptPreview,
  createArcFromChapters,
  maybeRunArcCheck,
  createChapterAuto,
  createChapterFromRange,
  drainArcBacklog,
  drainChapterBacklog,
  dropPendingPreview,
  dryRunArc,
  dryRunChapter,
  getBusy,
  clearLastFailure,
  getLastFailure,
  maybeRunPipeline,
  patchPendingPreview,
  registerPipelineCallbacks,
} from "./pipeline";
import { buildCoverage, resyncVisibility, syncHiddenForCoveredMessages, unhideCoveredMessages } from "./coverage";
import { invalidateConnectionsCache } from "./summarizer";
import { invalidateRegexCache } from "./regex";
import { registerHookEndpoints } from "./hooks";
import { buildState } from "./state";
import { parseStmbPresetExport } from "./presets";

const PUSH_DEBOUNCE_MS = 30;
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingPushChatIds = new Map<string, string | null>();
const pendingPushResolvers = new Map<string, Array<() => void>>();

async function doPushState(userId: string, chatId?: string | null): Promise<void> {
  try {
    if (chatId) {
      const active = await spindle.chats.getActive(userId).catch(() => null);
      if (active && active.id !== chatId) return;
    }
    const state = await buildState(userId, chatId);
    if (chatId) {
      const active = await spindle.chats.getActive(userId).catch(() => null);
      if (active && active.id !== chatId) return;
    }
    send({ type: "state", state }, userId);
  } catch (err) {
    error(`pushState failed: ${describeError(err)}`);
    send({ type: "error", text: `LumiBooks state refresh failed: ${describeError(err)}` }, userId);
  }
}

function pushState(userId: string, chatId?: string | null): Promise<void> {
  pendingPushChatIds.set(userId, chatId ?? null);
  const prev = pushTimers.get(userId);
  if (prev) clearTimeout(prev);
  return new Promise((resolve) => {
    const resolvers = pendingPushResolvers.get(userId) ?? [];
    resolvers.push(resolve);
    pendingPushResolvers.set(userId, resolvers);
    const timer = setTimeout(() => {
      pushTimers.delete(userId);
      const finalChatId = pendingPushChatIds.get(userId) ?? null;
      pendingPushChatIds.delete(userId);
      const waiting = pendingPushResolvers.get(userId) ?? [];
      pendingPushResolvers.delete(userId);
      doPushState(userId, finalChatId).finally(() => {
        for (const r of waiting) {
          try { r(); } catch (_) { void _; }
        }
      });
    }, PUSH_DEBOUNCE_MS);
    pushTimers.set(userId, timer);
  });
}

registerPipelineCallbacks({
  onBusyChange(userId, entries) {
    send({ type: "busy", entries }, userId);
  },
  onToast(userId, tone, text) {
    hostToast(userId, tone, text);
    send({ type: "toast", tone, text }, userId);
  },
  onStateChange(userId, chatId) {
    void pushState(userId, chatId);
  },
});

spindle.registerWorldInfoInterceptor(async (ctx) => {
  const ours: string[] = [];
  for (const entry of ctx.entries) {
    const ext = entry.extensions as Record<string, unknown> | undefined;
    if (ext && ext[EXTENSION_KEY]) ours.push(entry.id);
  }
  return ours.length ? { disabled: ours } : undefined;
}, 90);

spindle.registerInterceptor(async (messages, context) => {
  try {
    const chatId =
      context && typeof context === "object" && typeof (context as { chatId?: unknown }).chatId === "string"
        ? ((context as { chatId?: unknown }).chatId as string)
        : null;
    if (!chatId) return messages;
    let userId = resolveUserId(chatId);
    if (!userId) {
      const bootstrap = getBootstrapUserId();
      if (bootstrap) {
        const chat = await spindle.chats.get(chatId, bootstrap).catch(() => null);
        if (chat) {
          rememberChatUser(chatId, bootstrap);
          userId = bootstrap;
        }
      }
    }
    if (!userId) return messages;
    const settings = await loadSettings(userId);
    if (!settings.enabled) return messages;
    const result = await buildInjection(chatId, messages as LlmMessageDTO[], userId);
    if (!result) return messages;
    return { messages: result.messages, breakdown: result.breakdown };
  } catch (err) {
    warn(`interceptor failed: ${describeError(err)}`);
    return messages;
  }
}, 90);

spindle.on("MESSAGE_SENT", async (payload: unknown, hostUserId?: string) => {
  const p = payload as { chatId?: string };
  if (!p?.chatId) return;
  const userId = hostUserId ?? resolveUserId(p.chatId);
  if (!userId) return;
  rememberChatUser(p.chatId, userId);
});

spindle.on("GENERATION_ENDED", async (payload: unknown, hostUserId?: string) => {
  const p = payload as { chatId?: string; error?: string };
  if (!p?.chatId || p.error) return;
  const userId = hostUserId ?? resolveUserId(p.chatId);
  if (!userId) return;
  rememberChatUser(p.chatId, userId);
  await ensureUserFolders(userId).catch(() => {});
  const settings = await loadSettings(userId).catch(() => null);
  if (!settings?.enabled) return;
  const profile = settings.profiles.find((x) => x.id === settings.activeProfileId);
  if (!profile) return;
  await maybeRunPipeline(p.chatId, profile, settings, userId).catch((err) => {
    warn(`pipeline failed: ${describeError(err)}`);
  });
});

spindle.on("CHAT_SWITCHED", async (payload: unknown, hostUserId?: string) => {
  const p = payload as { chatId?: string | null };
  const userId = hostUserId ?? resolveUserId(p?.chatId ?? null);
  if (!userId) return;
  if (p?.chatId) rememberChatUser(p.chatId, userId);
  invalidateConnectionsCache(userId);
  await pushState(userId, p?.chatId ?? null);
});

spindle.on("MESSAGE_DELETED", async (payload: unknown, hostUserId?: string) => {
  const p = payload as { chatId?: string };
  if (!p?.chatId) return;
  const userId = hostUserId ?? resolveUserId(p.chatId);
  if (!userId) return;
  rememberChatUser(p.chatId, userId);
  invalidateBookCache(userId, p.chatId);
  await pushState(userId, p.chatId);
});

spindle.on("WORLD_BOOK_ENTRY_DELETED", async (payload: unknown, hostUserId?: string) => {
  if (!hostUserId) return;
  const p = payload as { worldBookId?: string };
  if (!p?.worldBookId) return;
  await handleExternalEntryDeletion(hostUserId, p.worldBookId, false);
});

spindle.on("WORLD_BOOK_DELETED", async (payload: unknown, hostUserId?: string) => {
  if (!hostUserId) return;
  const p = payload as { id?: string };
  if (!p?.id) return;
  await handleExternalEntryDeletion(hostUserId, p.id, true);
});

spindle.on("REGEX_SCRIPT_CHANGED", (_payload: unknown, hostUserId?: string) => {
  if (hostUserId) invalidateRegexCache(hostUserId);
});
spindle.on("REGEX_SCRIPT_DELETED", (_payload: unknown, hostUserId?: string) => {
  if (hostUserId) invalidateRegexCache(hostUserId);
});
spindle.on("CONNECTION_PROFILE_LOADED", (_payload: unknown, hostUserId?: string) => {
  if (hostUserId) invalidateConnectionsCache(hostUserId);
});
spindle.on("MAIN_API_CHANGED", (_payload: unknown, hostUserId?: string) => {
  if (hostUserId) invalidateConnectionsCache(hostUserId);
});

async function handleExternalEntryDeletion(userId: string, bookId: string, isBookDeletion: boolean): Promise<void> {
  const chatId = isBookDeletion
    ? findCachedChatIdForBook(userId, bookId)
    : await findChatIdForBook(userId, bookId).catch(() => null);
  if (!chatId) return;
  if (isBookDeletion) invalidateAllBookCacheEntriesForBook(userId, bookId);
  else invalidateBookCache(userId, chatId);
  try {
    const settings = await loadSettings(userId);
    const profile = settings.profiles.find((p) => p.id === settings.activeProfileId);
    const desiredHidden = profile ? profile.hideCoveredMessages : true;
    const { unhidden } = await resyncVisibility(chatId, userId, desiredHidden);
    if (unhidden > 0) {
      send({
        type: "toast",
        tone: "info",
        text: `Memoria unhid ${unhidden} message${unhidden === 1 ? "" : "s"} after an external lorebook change`,
      }, userId);
    }
  } catch (err) {
    warn(`external deletion resync failed: ${describeError(err)}`);
  }
  await pushState(userId, chatId);
}

async function collectActiveChapterIds(chatId: string, userId: string): Promise<string[]> {
  const entries = await listLmbEntries(chatId, userId);
  const coverage = await buildCoverage(chatId, userId, entries);
  return coverage.activeEntries
    .filter((e) => e.meta.tier === 1)
    .map((e) => e.raw.id);
}

async function retryLastFailure(
  chatId: string,
  userId: string,
  profile: Parameters<typeof createChapterAuto>[1],
  settings: Parameters<typeof createChapterAuto>[2],
): Promise<void> {
  const last = getLastFailure(userId, chatId);
  if (last?.kind === "arc") {
    const ids = await collectActiveChapterIds(chatId, userId);
    if (ids.length === 0) {
      clearLastFailure(userId, chatId);
      const msg = "Memoria has no active chapters left to retry the arc against.";
      hostToast(userId, "warn", msg);
      send({ type: "toast", tone: "warn", text: msg }, userId);
      return;
    }
    await createArcFromChapters(chatId, ids, profile, settings, userId);
    return;
  }
  await createChapterAuto(chatId, profile, settings, userId);
  await maybeRunArcCheck(chatId, profile, settings, userId);
}


spindle.onFrontendMessage(async (raw, userId) => {
  setLastFrontendUserId(userId);
  const msg = raw as FrontendToBackend;
  rememberChatUser(readChatIdFromMessage(msg), userId);

  try {
    await ensureUserFolders(userId);
    switch (msg.type) {
      case "ready":
      case "refresh":
        await pushState(userId, msg.chatId);
        break;

      case "save_settings":
        await patchSettings(userId, msg.patch);
        await pushState(userId, msg.chatId);
        break;

      case "save_profile": {
        const incoming = msg.profile;
        const id = typeof incoming?.id === "string" && incoming.id.trim() ? incoming.id : null;
        if (!id) {
          send({ type: "error", text: "Invalid profile payload." }, userId);
          break;
        }
        let prevHide: boolean | null = null;
        let nextHide: boolean | null = null;
        let activeBefore: string | null = null;
        let missing = false;
        await mutateSettings(userId, (cur) => {
          activeBefore = cur.activeProfileId;
          const existing = cur.profiles.find((p) => p.id === id);
          if (!existing) {
            missing = true;
            return cur;
          }
          const merged = normalizeProfile({ ...existing, ...incoming, id });
          if (!merged) return cur;
          prevHide = existing.hideCoveredMessages;
          nextHide = merged.hideCoveredMessages;
          return { ...cur, profiles: cur.profiles.map((p) => (p.id === id ? merged : p)) };
        });
        if (missing) {
          warn(`save_profile dropped: no profile with id "${id}"`);
          send({ type: "error", text: `Profile ${id} no longer exists.` }, userId);
          break;
        }
        if (
          prevHide !== null
          && nextHide !== null
          && prevHide !== nextHide
          && id === activeBefore
          && msg.chatId
        ) {
          try {
            const messages = await spindle.chat.getMessages(msg.chatId);
            const coverage = await buildCoverage(msg.chatId, userId);
            await syncHiddenForCoveredMessages(msg.chatId, messages, coverage, userId, nextHide);
          } catch (err) {
            warn(`hideCoveredMessages re-sync failed: ${describeError(err)}`);
          }
        }
        await pushState(userId, msg.chatId);
        break;
      }

      case "save_samplers": {
        await mutateSettings(userId, (cur) => {
          const idx = cur.profiles.findIndex((p) => p.id === msg.profileId);
          if (idx === -1) return cur;
          const current = cur.profiles[idx]!;
          const merged = { ...current.samplers, ...msg.samplers };
          const profiles = cur.profiles.slice();
          profiles[idx] = { ...current, samplers: merged };
          return { ...cur, profiles };
        });
        await pushState(userId, msg.chatId);
        break;
      }

      case "create_profile": {
        await mutateSettings(userId, (cur) => {
          const id = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
          const baseProfile = cur.profiles.find((p) => p.id === cur.activeProfileId) ?? cur.profiles[0]!;
          const next = { ...baseProfile, id, name: (msg.name || "New profile").slice(0, 60) };
          return { ...cur, profiles: [...cur.profiles, next], activeProfileId: id };
        });
        await pushState(userId, msg.chatId);
        break;
      }

      case "delete_profile": {
        let warned = false;
        await mutateSettings(userId, (cur) => {
          if (cur.profiles.length <= 1) {
            warned = true;
            return cur;
          }
          const profiles = cur.profiles.filter((p) => p.id !== msg.profileId);
          const activeProfileId = cur.activeProfileId === msg.profileId ? profiles[0]!.id : cur.activeProfileId;
          return { ...cur, profiles, activeProfileId };
        });
        if (warned) {
          send({ type: "toast", tone: "warn", text: "Memoria keeps at least one profile" }, userId);
        }
        await pushState(userId, msg.chatId);
        break;
      }

      case "set_active_profile": {
        await mutateSettings(userId, (cur) => {
          if (!cur.profiles.some((p) => p.id === msg.profileId)) return cur;
          return { ...cur, activeProfileId: msg.profileId };
        });
        await pushState(userId, msg.chatId);
        break;
      }

      case "create_chapter": {
        const cur = await loadSettings(userId);
        const profile = cur.profiles.find((p) => p.id === cur.activeProfileId);
        if (!profile) break;
        if (getBusy(userId).some((b) => b.kind === "chapter" && b.chatId === msg.chatId)) {
          send({ type: "toast", tone: "warn", text: "Memoria is already filing a chapter" }, userId);
          break;
        }
        await createChapterAuto(msg.chatId, profile, cur, userId);
        await maybeRunArcCheck(msg.chatId, profile, cur, userId);
        await pushState(userId, msg.chatId);
        break;
      }

      case "create_chapter_range": {
        const cur = await loadSettings(userId);
        const profile = cur.profiles.find((p) => p.id === cur.activeProfileId);
        if (!profile) break;
        if (getBusy(userId).some((b) => b.kind === "chapter" && b.chatId === msg.chatId)) {
          send({ type: "toast", tone: "warn", text: "Memoria is already filing a chapter" }, userId);
          break;
        }
        await createChapterFromRange(msg.chatId, msg.messageIds, profile, cur, userId);
        await maybeRunArcCheck(msg.chatId, profile, cur, userId);
        await pushState(userId, msg.chatId);
        break;
      }

      case "create_all_chapters": {
        const cur = await loadSettings(userId);
        const profile = cur.profiles.find((p) => p.id === cur.activeProfileId);
        if (!profile) break;
        if (getBusy(userId).some((b) => b.kind === "chapter" && b.chatId === msg.chatId)) {
          send({ type: "toast", tone: "warn", text: "Memoria is already filing a chapter" }, userId);
          break;
        }
        await drainChapterBacklog(msg.chatId, profile, cur, userId);
        await maybeRunArcCheck(msg.chatId, profile, cur, userId);
        await pushState(userId, msg.chatId);
        break;
      }

      case "create_arc": {
        const cur = await loadSettings(userId);
        const profile = cur.profiles.find((p) => p.id === cur.activeProfileId);
        if (!profile) break;
        if (getBusy(userId).some((b) => b.kind === "arc" && b.chatId === msg.chatId)) {
          send({ type: "toast", tone: "warn", text: "Memoria is already binding an arc" }, userId);
          break;
        }
        const ids = await collectActiveChapterIds(msg.chatId, userId);
        await createArcFromChapters(msg.chatId, ids, profile, cur, userId);
        await pushState(userId, msg.chatId);
        break;
      }

      case "create_arc_from": {
        const cur = await loadSettings(userId);
        const profile = cur.profiles.find((p) => p.id === cur.activeProfileId);
        if (!profile) break;
        if (getBusy(userId).some((b) => b.kind === "arc" && b.chatId === msg.chatId)) {
          send({ type: "toast", tone: "warn", text: "Memoria is already binding an arc" }, userId);
          break;
        }
        await createArcFromChapters(msg.chatId, msg.chapterEntryIds, profile, cur, userId);
        await pushState(userId, msg.chatId);
        break;
      }

      case "create_all_arcs": {
        const cur = await loadSettings(userId);
        const profile = cur.profiles.find((p) => p.id === cur.activeProfileId);
        if (!profile) break;
        if (getBusy(userId).some((b) => b.kind === "arc" && b.chatId === msg.chatId)) {
          send({ type: "toast", tone: "warn", text: "Memoria is already binding an arc" }, userId);
          break;
        }
        await drainArcBacklog(msg.chatId, profile, cur, userId);
        await pushState(userId, msg.chatId);
        break;
      }

      case "retry_last_failure": {
        const cur = await loadSettings(userId);
        const profile = cur.profiles.find((p) => p.id === cur.activeProfileId);
        if (!profile) break;
        await retryLastFailure(msg.chatId, userId, profile, cur);
        await pushState(userId, msg.chatId);
        break;
      }

      case "delete_entry": {
        const entries = await listLmbEntries(msg.chatId, userId);
        const entry = entries.find((e) => e.raw.id === msg.entryId);
        if (entry && entry.meta.tier === 2 && Array.isArray(entry.meta.sourceChapterEntryIds)) {
          const sourceIds = new Set(entry.meta.sourceChapterEntryIds);
          for (const ch of entries) {
            if (ch.meta.tier !== 1) continue;
            if (!sourceIds.has(ch.raw.id)) continue;
            if (ch.meta.supersededByEntryId !== msg.entryId) continue;
            try {
              await patchEntryMeta(ch, { supersededByEntryId: null }, userId);
            } catch (err) {
              warn(`failed to clear supersededByEntryId on chapter ${ch.raw.id}: ${describeError(err)}`);
            }
          }
        }
        await deleteEntry(msg.entryId, userId);
        invalidateBookCache(userId, msg.chatId);
        if (entry) {
          const remaining = entries.filter((e) => e.raw.id !== msg.entryId);
          const newCoverage = await buildCoverage(msg.chatId, userId, remaining);
          const toUnhide = entry.meta.msgIds.filter((id) => !newCoverage.coveredBy.has(id));
          if (toUnhide.length > 0) {
            await unhideCoveredMessages(msg.chatId, toUnhide, userId).catch(() => {});
          }
        }
        await pushState(userId, msg.chatId);
        break;
      }

      case "release_entry": {
        const entries = await listLmbEntries(msg.chatId, userId);
        const entry = entries.find((e) => e.raw.id === msg.entryId);
        if (!entry) {
          send({ type: "toast", tone: "warn", text: "Memoria can't find that entry to release" }, userId);
          break;
        }
        if (entry.meta.tier === 2 && Array.isArray(entry.meta.sourceChapterEntryIds)) {
          const sourceIds = new Set(entry.meta.sourceChapterEntryIds);
          for (const ch of entries) {
            if (ch.meta.tier !== 1) continue;
            if (!sourceIds.has(ch.raw.id)) continue;
            if (ch.meta.supersededByEntryId !== msg.entryId) continue;
            try {
              await patchEntryMeta(ch, { supersededByEntryId: null }, userId);
            } catch (err) {
              warn(`failed to clear supersededByEntryId on chapter ${ch.raw.id}: ${describeError(err)}`);
            }
          }
        }
        await releaseEntry(entry, userId);
        invalidateBookCache(userId, msg.chatId);
        const remaining = entries.filter((e) => e.raw.id !== msg.entryId);
        const newCoverage = await buildCoverage(msg.chatId, userId, remaining);
        const toUnhide = entry.meta.msgIds.filter((id) => !newCoverage.coveredBy.has(id));
        if (toUnhide.length > 0) {
          await unhideCoveredMessages(msg.chatId, toUnhide, userId).catch(() => {});
        }
        send({ type: "toast", tone: "success", text: "Memoria released the entry to your lorebook" }, userId);
        await pushState(userId, msg.chatId);
        break;
      }

      case "regenerate_entry": {
        const cur = await loadSettings(userId);
        const profile = cur.profiles.find((p) => p.id === cur.activeProfileId);
        if (!profile) break;
        const entries = await listLmbEntries(msg.chatId, userId);
        const entry = entries.find((e) => e.raw.id === msg.entryId);
        if (!entry) {
          send({ type: "toast", tone: "warn", text: "Memoria can't find that entry to regenerate" }, userId);
          break;
        }
        const busyKind = entry.meta.tier === 2 ? "arc" : "chapter";
        if (getBusy(userId).some((b) => b.kind === busyKind && b.chatId === msg.chatId)) {
          send({ type: "toast", tone: "warn", text: `Memoria is already busy with a ${busyKind}` }, userId);
          break;
        }
        const isArc = entry.meta.tier === 2;
        const msgIds = entry.meta.msgIds.slice();
        const chapterIds = Array.isArray(entry.meta.sourceChapterEntryIds)
          ? entry.meta.sourceChapterEntryIds.slice()
          : [];
        if (isArc && chapterIds.length === 0) {
          send({ type: "toast", tone: "warn", text: "Memoria has no chapter sources to regenerate this arc from" }, userId);
          break;
        }
        if (!isArc && msgIds.length === 0) {
          send({ type: "toast", tone: "warn", text: "Memoria has no messages to regenerate this chapter from" }, userId);
          break;
        }
        if (!isArc) {
          const otherEntries = entries.filter((e) => e.raw.id !== msg.entryId);
          const otherCoverage = await buildCoverage(msg.chatId, userId, otherEntries);
          const blockingIds = entry.meta.msgIds.filter((id) => otherCoverage.coveredBy.has(id));
          if (blockingIds.length > 0) {
            const blockerEntryId = otherCoverage.coveredBy.get(blockingIds[0]!);
            const blocker = otherEntries.find((e) => e.raw.id === blockerEntryId);
            const blockerLabel = blocker?.meta.tier === 2 ? "an arc" : "another entry";
            send({
              type: "toast",
              tone: "warn",
              text: `Memoria can't regenerate this chapter, its messages are bound into ${blockerLabel}. Release/delete the arc first.`,
            }, userId);
            break;
          }
        }
        // Generate a replacement. The commit step atomically deletes the original
        // once the new entry is filed (immediate mode), or — when "Preview before
        // saving" is on — stages a preview tagged with replacesEntryId and leaves
        // the original active until the user accepts. On failure, the original is
        // untouched. So there is nothing to clean up here.
        if (isArc) {
          await createArcFromChapters(msg.chatId, chapterIds, profile, cur, userId, { replacesEntryId: msg.entryId });
        } else {
          await createChapterFromRange(msg.chatId, msgIds, profile, cur, userId, { replacesEntryId: msg.entryId });
        }
        await pushState(userId, msg.chatId);
        break;
      }

      case "update_entry": {
        await updateEntry(msg.entryId, msg.patch, userId);
        invalidateBookCache(userId, msg.chatId);
        await pushState(userId, msg.chatId);
        break;
      }

      case "resync_hidden": {
        const messages = await spindle.chat.getMessages(msg.chatId);
        const coverage = await buildCoverage(msg.chatId, userId);
        await syncHiddenForCoveredMessages(msg.chatId, messages, coverage, userId, true);
        await pushState(userId, msg.chatId);
        break;
      }

      case "dry_run_chapter": {
        const cur = await loadSettings(userId);
        const profile = cur.profiles.find((p) => p.id === cur.activeProfileId);
        if (!profile) break;
        try {
          const result = await dryRunChapter(msg.chatId, profile, cur, userId);
          send({ type: "dry_run_result", kind: "chapter", messages: result.messages, diagnostics: result.diagnostics }, userId);
        } catch (err) {
          const text = describeError(err);
          warn(`dry_run_chapter failed: ${text}`);
          send({ type: "toast", tone: "error", text: `Dry run failed: ${text}` }, userId);
        }
        break;
      }

      case "dry_run_arc": {
        const cur = await loadSettings(userId);
        const profile = cur.profiles.find((p) => p.id === cur.activeProfileId);
        if (!profile) break;
        try {
          const result = await dryRunArc(msg.chatId, profile, cur, userId);
          send({ type: "dry_run_result", kind: "arc", messages: result.messages, diagnostics: result.diagnostics }, userId);
        } catch (err) {
          const text = describeError(err);
          warn(`dry_run_arc failed: ${text}`);
          send({ type: "toast", tone: "error", text: `Dry run failed: ${text}` }, userId);
        }
        break;
      }

      case "abort_busy": {
        const aborted = abortBusy(userId, msg.chatId, msg.kind);
        if (!aborted) {
          send({ type: "toast", tone: "warn", text: "Memoria is not in the middle of anything to abort" }, userId);
        }
        break;
      }

      case "set_force_constant": {
        await patchSettings(userId, { forceConstantEntries: msg.value });
        const updated = await applyConstantToAllLmbEntries(userId, msg.value).catch((err) => {
          warn(`applyConstantToAllLmbEntries failed: ${describeError(err)}`);
          return 0;
        });
        const text = updated === 0
          ? `Memoria set future entries to ${msg.value ? "constant" : "keyword-triggered"} (no existing entries needed updating)`
          : `Memoria flipped ${updated} entr${updated === 1 ? "y" : "ies"} to ${msg.value ? "constant" : "keyword-triggered"}`;
        send({ type: "toast", tone: "info", text }, userId);
        await pushState(userId, msg.chatId);
        break;
      }

      case "resync_visibility": {
        const settings = await loadSettings(userId);
        const profile = settings.profiles.find((p) => p.id === settings.activeProfileId);
        const desiredHidden = profile ? profile.hideCoveredMessages : true;
        const { unhidden, hidden } = await resyncVisibility(msg.chatId, userId, desiredHidden);
        const total = unhidden + hidden;
        const text = total === 0
          ? "Memoria's shelf is already aligned, nya"
          : `Memoria resynced ${total} message${total === 1 ? "" : "s"} (${hidden} hidden, ${unhidden} unhidden)`;
        send({ type: "toast", tone: "info", text }, userId);
        await pushState(userId, msg.chatId);
        break;
      }

      case "ensure_book": {
        await ensureBookForChat(msg.chatId, userId);
        await pushState(userId, msg.chatId);
        break;
      }

      case "import_preset": {
        const parsed = parseStmbPresetExport(msg.raw, msg.category);
        if (parsed.length === 0) {
          send({ type: "toast", tone: "warn", text: "Memoria found no usable presets in that file" }, userId);
          break;
        }
        await mutateSettings(userId, (cur) => {
          const merged = [...cur.customPresets];
          for (const p of parsed) {
            const existing = merged.findIndex((c) => c.key === p.key && c.category === msg.category);
            const record = { ...p, category: msg.category, createdAt: Date.now() };
            if (existing >= 0) merged[existing] = record;
            else merged.push(record);
          }
          return { ...cur, customPresets: merged };
        });
        send({ type: "toast", tone: "success", text: `Memoria imported ${parsed.length} preset${parsed.length === 1 ? "" : "s"}` }, userId);
        await pushState(userId, msg.chatId);
        break;
      }

      case "save_custom_preset": {
        const next = normalizeCustomPreset(msg.preset);
        if (!next) {
          send({ type: "error", text: "Invalid preset payload." }, userId);
          break;
        }
        await mutateSettings(userId, (cur) => {
          const idx = cur.customPresets.findIndex((p) => p.key === next.key && p.category === next.category);
          const list = cur.customPresets.slice();
          if (idx >= 0) list[idx] = next; else list.push(next);
          return { ...cur, customPresets: list };
        });
        await pushState(userId, msg.chatId);
        break;
      }

      case "delete_custom_preset": {
        const fallbackChapter = "summary";
        const fallbackArc = "arc_default";
        await mutateSettings(userId, (cur) => {
          const list = cur.customPresets.filter((p) => !(p.key === msg.key && p.category === msg.category));
          const profiles = cur.profiles.map((p) => {
            if (msg.category === "chapter" && p.chapterPresetKey === msg.key) {
              return { ...p, chapterPresetKey: fallbackChapter };
            }
            if (msg.category === "arc" && p.arcPresetKey === msg.key) {
              return { ...p, arcPresetKey: fallbackArc };
            }
            return p;
          });
          return { ...cur, customPresets: list, profiles };
        });
        await pushState(userId, msg.chatId);
        break;
      }

      case "accept_preview": {
        const cur = await loadSettings(userId);
        const profile = cur.profiles.find((p) => p.id === cur.activeProfileId);
        if (!profile) break;
        await acceptPreview(msg.chatId, msg.draftId, profile, userId);
        await pushState(userId, msg.chatId);
        break;
      }

      case "discard_preview": {
        dropPendingPreview(userId, msg.chatId, msg.draftId);
        await pushState(userId, msg.chatId);
        break;
      }

      case "edit_preview": {
        patchPendingPreview(userId, msg.chatId, msg.draftId, msg.patch);
        break;
      }

      default:
        debug(userId, `unknown frontend msg type`, (msg as { type?: string }).type);
    }
  } catch (err) {
    const description = describeError(err);
    error(`frontend handler failed: ${description}`);
    send({ type: "error", text: description }, userId);
  }
});

registerHookEndpoints();
info("LumiBooks loaded.");
