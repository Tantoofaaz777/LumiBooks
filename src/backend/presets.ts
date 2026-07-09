import type { BuiltInPreset } from "../types";

export const BUILTIN_CHAPTER_PRESETS: BuiltInPreset[] = [
  {
    key: "summary",
    displayName: "Default chapter",
    prompt: [
      "You are a talented archiver skilled at capturing scenes from stories comprehensively. Analyze the following roleplay scene in the context of previous summaries provided (if available) and return a comprehensive synopsis as JSON.",
      "",
      "You must respond with ONLY valid JSON in this exact format:",
      "",
      "{",
      "  \"title\": \"Short, descriptive scene title (1-3 words)\",",
      "  \"content\": \"Long detailed synopsis with markdown structure...\"",
      "}",
      "",
      "For the content field, compress the scene into a summary. This summary needs to be concise but rich in information: exercise judgment as to whether or not an interaction is flavor-only or truly affects the plot. Flavor (details that doesn't advance plot) may be captured through key exchanges and must be skipped when recording story beats.",
      "",
      "Be concise, avoid flowery writing. This is a summary, NOT fanfic.",
      "",
      "RULES:",
      "- Write in **PAST TENSE**, **THIRD-PERSON**.",
      "- Write with intention, eliminating flowery language in favor of conciseness.",
      "- Use concrete nouns (e.g., \"rice cooker\" > \"appliance\").",
      "- Only use adjectives/adverbs when they materially affect tone, emotion, or characterization.",
      "",
      "This is the content field format to be followed:",
      "",
      "[**Timeframe**: Specific day - Specific scene timeframe",
      "",
      "Story Beats:",
      "- Present all major actions, revelations, and emotional shifts in chronological order.",
      "- Only include plot-affecting interactions. Interactions that are purely flavor and do NOT advance or affect the plot meaningfully must be discarded.",
      "",
      "Key Exchanges:",
      "- Only include pivotal dialogue that materially shifted tone, emotion, or relationship dynamics.",
      "- Attribute speakers by name (Name: \"quote\"); keep quotes verbatim.",
      "- Keep quotes chronological order.",
      "- Minimum 8 quotes - maximum 12.]",
      "",
      "Write compactly but completely--every line should add new information or insight. Favor compression over coverage whenever the two conflict; omit anything that can be inferred from context or established characterization.",
      "",
      "Return **ONLY** the JSON--no explanations, no notes, no commentary.",
    ].join("\n"),
  },
];

export const BUILTIN_ARC_PRESETS: BuiltInPreset[] = [
  {
    key: "arc_default",
    displayName: "Default arc",
    prompt: [
      "You are an expert narrative analyst and memory-engine assistant. Your task is to take these multiple scene summaries, normalize them, reconstruct the full chronology, identify a self-contained story arc, and output a single memory arc entry in JSON.",
      "",
      "The arc must be token-efficient, plot-accurate, and compatible with long-running RP memory systems.",
      "",
      "You must respond with ONLY valid JSON in this exact format:",
      "",
      "{",
      "  \"title\": \"Short, descriptive scene title (1-3 words)\",",
      "  \"content\": \"Long detailed synopsis with markdown structure...\"",
      "}",
      "",
      "RULES:",
      "- Combine ALL provided summaries into a single chronological retelling.",
      "- Preserve plot-relevant events, character choices, emotional shifts, decisions, consequences, conflicts, promises, boundary negotiations.",
      "- Write with intention, eliminating flowery language in favor of conciseness.",
      "- Use concrete nouns (e.g., \"rice cooker\" > \"appliance\").",
      "- Only use adjectives/adverbs when they materially affect tone, emotion, or characterization.",
      "- Respect chronology of the source summaries (oldest first).",
      "",
      "This is the content field format to be followed:",
      "",
      "[**Timeframe**: Specific timeframe the arc covers (e.g. \"March 3 -> April 10\").",
      "",
      "Story Beats:",
      "- Present all major actions, revelations, and emotional shifts in chronological order.",
      "- Only include plot-affecting interactions. Interactions that are purely flavor and do NOT advance or affect the plot meaningfully must be discarded.",
      "",
      "Key Exchanges:",
      "- Only include pivotal dialogue that materially shifted tone, emotion, or relationship dynamics.",
      "- Attribute speakers by name (Name: \"quote\"); keep quotes verbatim.",
      "- Keep quotes chronological order.",
      "- Minimum 12 quotes - maximum 20.]",
      "",
      "Write compactly but completely--every line should add new information or insight. Favor compression over coverage whenever the two conflict; omit anything that can be inferred from context or established characterization.",
      "",
      "Return **ONLY** the JSON--no explanations, no notes, no commentary.",
    ].join("\n"),
  },
];

export const BUILTIN_VOLUME_PRESETS: BuiltInPreset[] = [
  {
    key: "volume_default",
    displayName: "Volume",
    prompt: [
      "You are an expert narrative analyst and memory-engine assistant.",
      "Your task is to take multiple story arc summaries, normalize them, reconstruct the full chronology, and output a single consolidated volume entry in JSON.",
      "",
      "Return ONLY valid JSON in this exact shape:",
      "{",
      "  \"title\": \"Short descriptive volume title\",",
      "  \"content\": \"Consolidated volume summary\"",
      "}",
    ].join("\n"),
  },
];

export function findBuiltInPreset(category: "chapter" | "arc" | "volume", key: string): BuiltInPreset | null {
  const pool = category === "arc" ? BUILTIN_ARC_PRESETS : category === "volume" ? BUILTIN_VOLUME_PRESETS : BUILTIN_CHAPTER_PRESETS;
  return pool.find((p) => p.key === key) ?? null;
}

export interface ImportedPresetMap {
  chapter: { key: string; displayName: string; prompt: string }[];
  arc: { key: string; displayName: string; prompt: string }[];
}

export function parseStmbPresetExport(raw: unknown, category: "chapter" | "arc"): ImportedPresetMap[keyof ImportedPresetMap] {
  const out: { key: string; displayName: string; prompt: string }[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const overrides = (raw as { overrides?: unknown }).overrides;
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) return out;
  for (const [k, v] of Object.entries(overrides as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const node = v as { displayName?: unknown; prompt?: unknown };
    if (typeof node.prompt !== "string" || !node.prompt.trim()) continue;
    const key = sanitizeKey(`${category}_${k}`);
    const displayName = typeof node.displayName === "string" && node.displayName.trim()
      ? node.displayName
      : k;
    out.push({ key, displayName, prompt: node.prompt });
  }
  return out;
}

function sanitizeKey(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  if (cleaned) return cleaned;
  return `preset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
