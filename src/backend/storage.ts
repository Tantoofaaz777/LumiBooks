declare const spindle: import("lumiverse-spindle-types").SpindleAPI;

import type { LMBSettings } from "../shared";
import { DEFAULT_SETTINGS, SETTINGS_PATH, STORAGE_VERSION, diskVersionFor, normalizeSettings } from "../shared";
import { describeError, warn } from "./runtime";

const warnedNewerForUser = new Set<string>();
const writeLocks = new Map<string, Promise<unknown>>();
const SETTINGS_READ_RETRY_DELAYS_MS = [100, 250] as const;
const SETTINGS_READ_ERROR = "Could not read LumiBooks settings. Nothing was saved; try again.";

function withSettingsLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const prev = writeLocks.get(userId) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  writeLocks.set(userId, next.catch(() => {}));
  return next;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readSettingsRaw(userId: string): Promise<Partial<LMBSettings>> {
  let lastError: unknown;
  let observedExistingFile = false;

  for (let attempt = 0; attempt <= SETTINGS_READ_RETRY_DELAYS_MS.length; attempt++) {
    try {
      const status = await spindle.userStorage.stat(SETTINGS_PATH, userId);
      if (!status.exists) {
        if (observedExistingFile) {
          throw new Error("settings.json disappeared during a read attempt");
        }
        return DEFAULT_SETTINGS;
      }
      observedExistingFile = true;
      if (!status.isFile) throw new Error("settings.json is not a file");

      const parsed: unknown = JSON.parse(await spindle.userStorage.read(SETTINGS_PATH, userId));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("settings.json does not contain a JSON object");
      }
      return parsed as Partial<LMBSettings>;
    } catch (err) {
      lastError = err;
      const delay = SETTINGS_READ_RETRY_DELAYS_MS[attempt];
      if (delay !== undefined) await wait(delay);
    }
  }

  warn(`settings read failed after retries for user ${userId}: ${describeError(lastError)}`);
  throw new Error(SETTINGS_READ_ERROR);
}

export async function loadSettings(userId: string): Promise<LMBSettings> {
  const raw = await readSettingsRaw(userId);
  const diskVersion = diskVersionFor(raw);
  if (diskVersion > STORAGE_VERSION && !warnedNewerForUser.has(userId)) {
    warnedNewerForUser.add(userId);
    warn(`settings on disk are v${diskVersion}, this build understands v${STORAGE_VERSION}`);
  }
  return normalizeSettings(raw);
}

export async function saveSettings(userId: string, next: LMBSettings): Promise<LMBSettings> {
  return withSettingsLock(userId, async () => {
    await readSettingsRaw(userId);
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
