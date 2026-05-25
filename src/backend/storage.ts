declare const spindle: import("lumiverse-spindle-types").SpindleAPI;

import type { LMBSettings } from "../shared";
import { DEFAULT_SETTINGS, SETTINGS_PATH, STORAGE_VERSION, diskVersionFor, normalizeSettings } from "../shared";
import { warn } from "./runtime";

const warnedNewerForUser = new Set<string>();
const writeLocks = new Map<string, Promise<unknown>>();

function withSettingsLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const prev = writeLocks.get(userId) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  writeLocks.set(userId, next.catch(() => {}));
  return next;
}

export async function loadSettings(userId: string): Promise<LMBSettings> {
  const raw = await spindle.userStorage
    .getJson<Partial<LMBSettings>>(SETTINGS_PATH, { fallback: DEFAULT_SETTINGS, userId })
    .catch(() => DEFAULT_SETTINGS as Partial<LMBSettings>);
  const diskVersion = diskVersionFor(raw);
  if (diskVersion > STORAGE_VERSION && !warnedNewerForUser.has(userId)) {
    warnedNewerForUser.add(userId);
    warn(`settings on disk are v${diskVersion}, this build understands v${STORAGE_VERSION}`);
  }
  return normalizeSettings(raw);
}

export async function saveSettings(userId: string, next: LMBSettings): Promise<LMBSettings> {
  return withSettingsLock(userId, async () => {
    const normalized = normalizeSettings(next);
    await spindle.userStorage.setJson(SETTINGS_PATH, normalized, { indent: 2, userId });
    return normalized;
  });
}

export async function patchSettings(userId: string, patch: Partial<LMBSettings>): Promise<LMBSettings> {
  return withSettingsLock(userId, async () => {
    const current = await loadSettings(userId);
    const next = { ...current, ...patch };
    const normalized = normalizeSettings(next);
    await spindle.userStorage.setJson(SETTINGS_PATH, normalized, { indent: 2, userId });
    return normalized;
  });
}

export async function mutateSettings(
  userId: string,
  fn: (current: LMBSettings) => LMBSettings | Promise<LMBSettings>,
): Promise<LMBSettings> {
  return withSettingsLock(userId, async () => {
    const current = await loadSettings(userId);
    const next = await fn(current);
    const normalized = normalizeSettings(next);
    await spindle.userStorage.setJson(SETTINGS_PATH, normalized, { indent: 2, userId });
    return normalized;
  });
}
