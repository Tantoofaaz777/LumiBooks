declare const spindle: import("lumiverse-spindle-types").SpindleAPI;

import type { FrontendToBackend } from "../types";
import { EXTENSION_KEY, PROJECTION_KEY, approximateTokensFromChars, normalizeProfile, normalizeCustomPreset } from "../shared";
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
  reassertChatBinding,
  registerBookAnomalyCallback,
} from "./world-book";
import {
  abortBusy,
  acceptPreview,
  createArcFromChapters,
  maybeRunArcCheck,
  createChapterAuto,
  createChapterFromRange,
  createVolumeFromArcs,
  drainArcBacklog,
  drainChapterBacklog,
  dropPendingPreview,
  dryRunArc,
  dryRunChapter,
  dryRunVolume,
  getBusy,
  clearLastFailure,
  getLastFailure,
  maybeRunPipeline,
  patchPendingPreview,
  registerPipelineCallbacks,
} from "./pipeline";
import { buildCoverage, computeCoverageStats, resyncVisibility, syncHiddenForCoveredMessages, unhideCoveredMessages } from "./coverage";
import { rebaseRoot, rebuildRoot, detachRoot } from "./rebase";
import { invalidateConnectionsCache } from "./summarizer";
import { invalidateRegexCache } from "./regex";
import { registerHookEndpoints } from "./hooks";
import { buildState } from "./state";
import { parseStmbPresetExport } from "./presets";
import { syncProjectionEntry } from "./projection";
import { syncNamingForChat } from "./naming-sync";
import { confirmAdoptLorebook, listAdoptLorebookCandidates } from "./import-lorebook";
import { syncStoryOrderForChat } from "./story-order";

async function notify(
  userId: string,
  tone: "success" | "info" | "warn" | "error",
  text: string,
  automation = false,
): Promise<void> {
  try {
    if (automation && tone !== "error") {
      const settings = await loadSettings(userId).catch(() => null);
      if (settings && !settings.showAutomationToasts) return;
    }
    hostToast(userId, tone, text);
    send({ type: "toast", tone, text }, userId);
  } catch (err) {
    warn(`toast delivery failed: ${describeError(err)}`);
  }
}

const PUSH_DEBOUNCE_MS = 30;
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingPushChatIds = new Map<string, string | null>();
const pendingPushResolvers = new Map<string, Array<() => void>>();

async function doPushState(userId: string, chatId?: string | null): Promise<void> {
  try {
    if (chatId) {
      const active = await spindle.chats.getActive(userId).catch(() => null);
      if (active && active.id !== chatId) return;
      await syncStoryOrderForChat(chatId, userId).catch((err) => {
        warn(`story order sync before state failed: ${describeError(err)}`);
      });
      await syncNamingForChat(chatId, userId).catch((err) => {
        warn(`naming sync before state failed: ${describeError(err)}`);
      });
      await syncProjectionEntry(chatId, userId).catch((err) => {
        warn(`projection sync before state failed: ${describeError(err)}`);
      });
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
  onToast(userId, tone, text, automation) {
    void notify(userId, tone, text, automation === true);
  },
  onStateChange(userId, chatId) {
    void pushState(userId, chatId);
  },
});

spindle.registerWorldInfoInterceptor(async (ctx) => {
  const userId = ctx.userId ?? resolveUserId(ctx.chatId) ?? getBootstrapUserId();
  const settings = userId ? await loadSettings(userId).catch(() => null) : null;
  const outletMode = !!settings?.enabled;
  let activeOutletIds: Set<string> | null = null;
  if (outletMode && userId && ctx.chatId) {
    const allEntries = await listLmbEntries(ctx.chatId, userId).catch(() => []);
    const coverage = await buildCoverage(ctx.chatId, userId, allEntries).catch(() => null);
    activeOutletIds = coverage ? new Set(coverage.activeEntries.map((entry) => entry.raw.id)) : null;
  }
  const disabled: string[] = [];
  for (const entry of ctx.entries) {
    const ext = entry.extensions as Record<string, unknown> | undefined;
    if (!ext) continue;
    if (ext[PROJECTION_KEY]) {
      disabled.push(entry.id);
      continue;
    }
    if (ext[EXTENSION_KEY]) {
      if (!outletMode) disabled.push(entry.id);
      else if (!activeOutletIds?.has(entry.id)) disabled.push(entry.id);
    }
  }
  return disabled.length ? { disabled } : undefined;
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
  await reassertChatBinding(p.chatId, userId).catch(() => {});
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
      await notify(userId, "info", `Memoria unhid ${unhidden} message${unhidden === 1 ? "" : "s"} after an external lorebook change`);
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
    .filter((e) => e.meta.tier === 1 && !e.meta.isRoot)
    .map((e) => e.raw.id);
}

async function collectActiveArcIds(chatId: string, userId: string): Promise<string[]> {
  const entries = await listLmbEntries(chatId, userId);
  const coverage = await buildCoverage(chatId, userId, entries);
  return coverage.activeEntries
    .filter((e) => e.meta.tier === 2 && !e.meta.isRoot)
    .map((e) => e.raw.id);
}

async function retryLastFailure(
  chatId: string,
  userId: string,
  profile: Parameters<typeof createChapterAuto>[1],
  settings: Parameters<typeof createChapterAuto>[2],
): Promise<void> {
  const last = getLastFailure(userId, chatId);
  if (last?.kind === "volume") {
    const ids = await collectActiveArcIds(chatId, userId);
    if (ids.length === 0) {
      clearLastFailure(userId, chatId);
      await notify(userId, "warn", "Memoria has no arcs left to retry the volume");
      return;
    }
    await createVolumeFromArcs(chatId, ids, profile, settings, userId);
    return;
  }
  if (last?.kind === "arc") {
    const ids = await collectActiveChapterIds(chatId, userId);
    if (ids.length === 0) {
      clearLastFailure(userId, chatId);
      const msg = "Memoria has no chapters left to retry the arc";
      await notify(userId, "warn", msg);
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
          await notify(userId, "warn", "Memoria keeps at least one profile");
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
          await notify(userId, "warn", "Memoria is already filing a chapter");
          break;
        }
        const chapterMessages = await spindle.chat.getMessages(msg.chatId);
        const chapterCoverage = await buildCoverage(msg.chatId, userId);
        const chapterStats = computeCoverageStats(chapterMessages, chapterCoverage, profile);
        if (!chapterStats.lagSatisfied || !chapterStats.windowAvailable) {
          await notify(userId, "info", "Your story needs more messages for me to generate a new entry~");
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
          await notify(userId, "warn", "Memoria is already filing a chapter");
          break;
        }
        const rangeMessages = await spindle.chat.getMessages(msg.chatId);
        const selectedIds = new Set(msg.messageIds);
        const positions = rangeMessages
          .map((m, i) => ({ m, i }))
          .filter(({ m }) => selectedIds.has(m.id)
            && !((m as { metadata?: Record<string, unknown> }).metadata?.["lmb_excluded"] === true))
          .map(({ i }) => i);
        const runs: string[][] = [];
        let prev = -2;
        for (const pos of positions) {
          if (pos === prev + 1) runs[runs.length - 1]!.push(rangeMessages[pos]!.id);
          else runs.push([rangeMessages[pos]!.id]);
          prev = pos;
        }
        for (const run of runs) {
          await createChapterFromRange(msg.chatId, run, profile, cur, userId);
        }
        await maybeRunArcCheck(msg.chatId, profile, cur, userId);
        await pushState(userId, msg.chatId);
        break;
      }

      case "create_all_chapters": {
        const cur = await loadSettings(userId);
        const profile = cur.profiles.find((p) => p.id === cur.activeProfileId);
        if (!profile) break;
        if (getBusy(userId).some((b) => b.kind === "chapter" && b.chatId === msg.chatId)) {
          await notify(userId, "warn", "Memoria is already filing a chapter");
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
          await notify(userId, "warn", "Memoria is already binding an arc");
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
          await notify(userId, "warn", "Memoria is already binding an arc");
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
          await notify(userId, "warn", "Memoria is already binding an arc");
          break;
        }
        await drainArcBacklog(msg.chatId, profile, cur, userId);
        await pushState(userId, msg.chatId);
        break;
      }

      case "create_volume_from": {
        const cur = await loadSettings(userId);
        const profile = cur.profiles.find((p) => p.id === cur.activeProfileId);
        if (!profile) break;
        if (getBusy(userId).some((b) => b.kind === "volume" && b.chatId === msg.chatId)) {
          await notify(userId, "warn", "Memoria is already pressing a volume");
          break;
        }
        await createVolumeFromArcs(msg.chatId, msg.arcEntryIds, profile, cur, userId);
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
        // Free the tier below only when the removed entry was itself active.
        // Deleting an arc that sits inside a volume must not reactivate its
        // chapters - the volume still covers them.
        if (
          entry
          && entry.meta.tier !== 1
          && !entry.meta.supersededByEntryId
          && Array.isArray(entry.meta.sourceChapterEntryIds)
        ) {
          const sourceIds = new Set(entry.meta.sourceChapterEntryIds);
          for (const src of entries) {
            if (!sourceIds.has(src.raw.id)) continue;
            if (src.meta.supersededByEntryId !== msg.entryId) continue;
            try {
              await patchEntryMeta(src, { supersededByEntryId: null }, userId);
            } catch (err) {
              warn(`failed to clear supersededByEntryId on entry ${src.raw.id}: ${describeError(err)}`);
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
          await notify(userId, "warn", "Memoria can't find that entry to release");
          break;
        }
        if (
          entry.meta.tier !== 1
          && !entry.meta.supersededByEntryId
          && Array.isArray(entry.meta.sourceChapterEntryIds)
        ) {
          const sourceIds = new Set(entry.meta.sourceChapterEntryIds);
          for (const src of entries) {
            if (!sourceIds.has(src.raw.id)) continue;
            if (src.meta.supersededByEntryId !== msg.entryId) continue;
            try {
              await patchEntryMeta(src, { supersededByEntryId: null }, userId);
            } catch (err) {
              warn(`failed to clear supersededByEntryId on entry ${src.raw.id}: ${describeError(err)}`);
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
        await notify(userId, "success", "Memoria released the entry to your lorebook");
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
          await notify(userId, "warn", "Memoria can't find that entry to regenerate");
          break;
        }
        const tier = entry.meta.tier;
        const busyKind = tier === 3 ? "volume" : tier === 2 ? "arc" : "chapter";
        if (getBusy(userId).some((b) => b.kind === busyKind && b.chatId === msg.chatId)) {
          await notify(userId, "warn", `Memoria is already busy with a ${busyKind}`);
          break;
        }
        if (entry.meta.isRoot && tier === 1) {
          await notify(userId, "warn", "Memoria can't regenerate inherited chapters");
          break;
        }
        const isArc = tier === 2;
        const isVolume = tier === 3;
        const msgIds = entry.meta.msgIds.slice();
        const sourceIds = Array.isArray(entry.meta.sourceChapterEntryIds)
          ? entry.meta.sourceChapterEntryIds.slice()
          : [];
        if (isVolume && sourceIds.length === 0) {
          await notify(userId, "warn", "Memoria has no arc sources to regenerate this volume from");
          break;
        }
        if (isArc && sourceIds.length === 0) {
          await notify(userId, "warn", "Memoria has no chapter sources to regenerate this arc from");
          break;
        }
        if (!isArc && !isVolume && msgIds.length === 0) {
          await notify(userId, "warn", "Memoria has no messages to regenerate this chapter from");
          break;
        }
        if (!isArc && !isVolume) {
          const otherEntries = entries.filter((e) => e.raw.id !== msg.entryId);
          const otherCoverage = await buildCoverage(msg.chatId, userId, otherEntries);
          const blockingIds = entry.meta.msgIds.filter((id) => otherCoverage.coveredBy.has(id));
          if (blockingIds.length > 0) {
            const blockerEntryId = otherCoverage.coveredBy.get(blockingIds[0]!);
            const blocker = otherEntries.find((e) => e.raw.id === blockerEntryId);
            const blockerLabel = blocker?.meta.tier === 3 ? "a volume" : blocker?.meta.tier === 2 ? "an arc" : "another entry";
            await notify(userId, "warn", `These messages are bound into ${blockerLabel}, release or delete it first`);
            break;
          }
        }
        if (isVolume) {
          await createVolumeFromArcs(msg.chatId, sourceIds, profile, cur, userId, { replacesEntryId: msg.entryId });
        } else if (isArc) {
          await createArcFromChapters(msg.chatId, sourceIds, profile, cur, userId, { replacesEntryId: msg.entryId });
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

      case "bind_messages_to_entry": {
        const messages = await spindle.chat.getMessages(msg.chatId);
        const selected = new Set(msg.messageIds);
        const ordered = messages
          .map((message, index) => ({ message, index }))
          .filter(({ message }) => selected.has(message.id));
        if (ordered.length === 0) {
          await notify(userId, "warn", "No matching chat messages were found to bind");
          break;
        }
        const entries = await listLmbEntries(msg.chatId, userId);
        const entry = entries.find((candidate) => candidate.raw.id === msg.entryId);
        if (!entry) {
          await notify(userId, "warn", "Memoria can't find that chapter anymore");
          break;
        }
        if (entry.meta.tier !== 1 || entry.meta.isRoot) {
          await notify(userId, "warn", "Messages can only be bound directly to a local chapter");
          break;
        }
        const msgIds = ordered.map(({ message }) => message.id);
        const firstMsgIdx = Math.min(...ordered.map(({ index }) => index));
        const lastMsgIdx = Math.max(...ordered.map(({ index }) => index));
        const tokenCountInput = ordered.reduce(
          (sum, { message }) => sum + approximateTokensFromChars((message.content || "").length),
          0,
        );
        await patchEntryMeta(entry, { msgIds, firstMsgIdx, lastMsgIdx, tokenCountInput }, userId);
        invalidateBookCache(userId, msg.chatId);
        const coverage = await buildCoverage(msg.chatId, userId);
        await syncHiddenForCoveredMessages(msg.chatId, messages, coverage, userId, true, lastMsgIdx).catch((err) => {
          warn(`bind_messages_to_entry hide sync failed: ${describeError(err)}`);
        });
        await notify(userId, "success", `Bound ${msgIds.length} message${msgIds.length === 1 ? "" : "s"} to that chapter`);
        await pushState(userId, msg.chatId);
        break;
      }

      case "prepare_adopt_lorebook": {
        const books = await listAdoptLorebookCandidates(msg.chatId, userId);
        send({ type: "adopt_lorebook_candidates", chatId: msg.chatId, books }, userId);
        break;
      }

      case "confirm_adopt_lorebook": {
        const result = await confirmAdoptLorebook(msg.chatId, userId, msg.bookId, msg.entries);
        const text = result.adopted > 0
          ? `Adopted ${result.adopted} entr${result.adopted === 1 ? "y" : "ies"} in-place${result.skipped ? ` (${result.skipped} skipped)` : ""}`
          : "No entries were adopted";
        await notify(userId, result.adopted > 0 ? "success" : "info", text);
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
          await notify(userId, "error", `Dry run failed: ${text}`);
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
          await notify(userId, "error", `Dry run failed: ${text}`);
        }
        break;
      }

      case "dry_run_volume": {
        const cur = await loadSettings(userId);
        const profile = cur.profiles.find((p) => p.id === cur.activeProfileId);
        if (!profile) break;
        try {
          const result = await dryRunVolume(msg.chatId, profile, cur, userId);
          send({ type: "dry_run_result", kind: "volume", messages: result.messages, diagnostics: result.diagnostics }, userId);
        } catch (err) {
          const text = describeError(err);
          warn(`dry_run_volume failed: ${text}`);
          await notify(userId, "error", `Dry run failed: ${text}`);
        }
        break;
      }

      case "abort_busy": {
        const aborted = abortBusy(userId, msg.chatId, msg.kind);
        if (!aborted) {
          await notify(userId, "warn", "Memoria is not in the middle of anything to abort");
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
          ? `Future entries will be ${msg.value ? "constant" : "keyword-triggered"}`
          : `Memoria flipped ${updated} entr${updated === 1 ? "y" : "ies"} to ${msg.value ? "constant" : "keyword-triggered"}`;
        await notify(userId, "info", text);
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
          await notify(userId, "warn", "Memoria found no usable presets in that file");
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
        await notify(userId, "success", `Memoria imported ${parsed.length} preset${parsed.length === 1 ? "" : "s"}`);
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
        const fallbackVolume = "volume_default";
        await mutateSettings(userId, (cur) => {
          const list = cur.customPresets.filter((p) => !(p.key === msg.key && p.category === msg.category));
          const profiles = cur.profiles.map((p) => {
            if (msg.category === "chapter" && p.chapterPresetKey === msg.key) {
              return { ...p, chapterPresetKey: fallbackChapter };
            }
            if (msg.category === "arc" && p.arcPresetKey === msg.key) {
              return { ...p, arcPresetKey: fallbackArc };
            }
            if (msg.category === "volume" && p.volumePresetKey === msg.key) {
              return { ...p, volumePresetKey: fallbackVolume };
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

      case "rebase_root": {
        if (getBusy(userId).some((b) => b.chatId === msg.chatId)) {
          await notify(userId, "warn", "Memoria is busy, wait for her to finish");
          break;
        }
        const result = await rebaseRoot(msg.chatId, msg.sourceChatId, userId);
        if (!result.ok) {
          const text = result.reason === "has_own"
            ? "This chat already has memories, use Rebuild instead"
            : result.reason === "empty_source"
              ? "That chat has no memories to inherit"
              : result.reason === "busy"
                ? "Memoria is already rebasing this chat"
                : "Memoria can't rebase a chat onto itself";
          await notify(userId, "warn", text);
        } else {
          await notify(userId, "success", `Memoria seeded ${result.count} inherited memor${result.count === 1 ? "y" : "ies"} before the greeting`);
        }
        await pushState(userId, msg.chatId);
        break;
      }

      case "rebuild_root": {
        if (getBusy(userId).some((b) => b.chatId === msg.chatId)) {
          await notify(userId, "warn", "Memoria is busy, wait for her to finish");
          break;
        }
        const result = await rebuildRoot(msg.chatId, msg.sourceChatId, userId);
        if (!result.ok) {
          const text = result.reason === "empty_source"
            ? "That chat has no memories to inherit"
            : result.reason === "busy"
              ? "Memoria is already rebuilding this chat"
              : "Memoria can't rebuild a chat onto itself";
          await notify(userId, "warn", text);
          await pushState(userId, msg.chatId);
          break;
        }
        await notify(userId, "success", `Memoria rebuilt onto ${result.count} inherited memor${result.count === 1 ? "y" : "ies"} and is re-summarizing this chat`);
        await pushState(userId, msg.chatId);
        const cur = await loadSettings(userId);
        const profile = cur.profiles.find((p) => p.id === cur.activeProfileId);
        if (profile) {
          await drainChapterBacklog(msg.chatId, profile, cur, userId).catch((err) => warn(`rebuild re-summarize failed: ${describeError(err)}`));
          await maybeRunArcCheck(msg.chatId, profile, cur, userId).catch(() => {});
          await resyncVisibility(msg.chatId, userId, profile.hideCoveredMessages).catch((err) => warn(`rebuild visibility resync failed: ${describeError(err)}`));
          await pushState(userId, msg.chatId);
        }
        break;
      }

      case "set_message_excluded": {
        const ids = Array.isArray(msg.messageIds) ? msg.messageIds.filter((x): x is string => typeof x === "string") : [];
        if (ids.length === 0) break;
        const messages = await spindle.chat.getMessages(msg.chatId);
        const byId = new Map(messages.map((m) => [m.id, m] as const));
        const coveredNow = msg.excluded ? (await buildCoverage(msg.chatId, userId)).coveredBy : null;
        const hideToUnhide: string[] = [];
        for (const id of ids) {
          const m = byId.get(id);
          if (!m) continue;
          const cur = (m as { metadata?: Record<string, unknown> }).metadata;
          const next: Record<string, unknown> = cur && typeof cur === "object" ? { ...cur } : {};
          if (msg.excluded) {
            next["lmb_excluded"] = true;
            const hidden = !!(m.extra && (m.extra as Record<string, unknown>).hidden);
            if (hidden && coveredNow?.has(id)) hideToUnhide.push(id);
          } else {
            delete next["lmb_excluded"];
          }
          await spindle.chat.updateMessage(msg.chatId, id, { metadata: next, skipChunkRebuild: true }).catch((err) => {
            warn(`set_message_excluded: updateMessage failed for ${id}: ${describeError(err)}`);
          });
        }
        if (hideToUnhide.length > 0) {
          await unhideCoveredMessages(msg.chatId, hideToUnhide, userId).catch(() => {});
        }
        if (!msg.excluded) {
          const cur = await loadSettings(userId);
          const profile = cur.profiles.find((p) => p.id === cur.activeProfileId);
          if (profile?.hideCoveredMessages) {
            const fresh = await spindle.chat.getMessages(msg.chatId);
            const coverage = await buildCoverage(msg.chatId, userId);
            const idSet = new Set(ids);
            const reincluded = fresh.filter((m) => idSet.has(m.id) && coverage.coveredBy.has(m.id));
            if (reincluded.length > 0) {
              await syncHiddenForCoveredMessages(msg.chatId, reincluded, coverage, userId, true).catch(() => {});
            }
          }
        }
        await notify(userId, "info", msg.excluded
          ? `Memoria will leave ${ids.length} message${ids.length === 1 ? "" : "s"} untouched`
          : `Memoria will compress ${ids.length} message${ids.length === 1 ? "" : "s"} again`);
        await pushState(userId, msg.chatId);
        break;
      }

      case "detach_root": {
        const removed = await detachRoot(msg.chatId, userId);
        const text = removed === 0
          ? "This chat has no inherited memories to detach"
          : `Memoria detached ${removed} inherited memor${removed === 1 ? "y" : "ies"}`;
        await notify(userId, "info", text);
        await pushState(userId, msg.chatId);
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

registerBookAnomalyCallback((userId, tone, text) => {
  void notify(userId, tone, text);
});

registerHookEndpoints();
info("LumiBooks loaded.");
