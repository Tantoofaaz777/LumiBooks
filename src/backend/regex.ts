declare const spindle: import("lumiverse-spindle-types").SpindleAPI;

import type { RegexScriptDTO } from "lumiverse-spindle-types";
import { describeError, warn } from "./runtime";

const TTL_MS = 5_000;
const cachedScripts = new Map<string, { at: number; data: RegexScriptDTO[] }>();

export async function listRegexScripts(userId: string): Promise<RegexScriptDTO[]> {
  const cached = cachedScripts.get(userId);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.data;
  try {
    const result = await spindle.regex_scripts.list({ userId });
    cachedScripts.set(userId, { at: Date.now(), data: result.data });
    return result.data;
  } catch (err) {
    warn(`regex_scripts.list failed: ${describeError(err)}`);
    cachedScripts.set(userId, { at: Date.now(), data: [] });
    return [];
  }
}

export function invalidateRegexCache(userId?: string): void {
  if (userId) cachedScripts.delete(userId);
  else cachedScripts.clear();
}

export async function applySelectedRegex(text: string, scriptIds: string[], userId: string): Promise<string> {
  if (!scriptIds.length) return text;
  const all = await listRegexScripts(userId);
  const byId = new Map(all.map((s) => [s.id, s]));
  let out = text;
  for (const id of scriptIds) {
    const script = byId.get(id);
    if (!script) continue;
    out = runScript(out, script);
  }
  return out;
}

const REGEX_INPUT_MAX_CHARS = 500_000;

function runScript(input: string, script: RegexScriptDTO): string {
  const pattern = script.find_regex;
  const replace = script.replace_string ?? "";
  if (!pattern) return input;
  if (input.length > REGEX_INPUT_MAX_CHARS) {
    warn(`regex script ${script.id} skipped: input too long (${input.length} chars)`);
    return input;
  }
  try {
    const flags = script.flags && script.flags.length > 0 ? script.flags : "g";
    const re = new RegExp(pattern, flags);
    return input.replace(re, replace);
  } catch (err) {
    warn(`regex script ${script.id} failed: ${describeError(err)}`);
    return input;
  }
}
