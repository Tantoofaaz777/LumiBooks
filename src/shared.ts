export const EXTENSION_ID = "lumi_books" as const;
export const EXTENSION_KEY = "lumibooks" as const;
export const PROJECTION_KEY = "lumibooks_projection" as const;
export const WORLD_BOOK_NAME_PREFIX = "LumiBooks" as const;
export const STORAGE_VERSION = 4 as const;
export const SETTINGS_PATH = "settings.json" as const;
export const CHAT_STATE_DIR = "chats" as const;

export type MemoryInjectionMode = "chat_history" | "outlet";

export interface SamplerSet {
  temperature: number | null;
  top_p: number | null;
  top_k: number | null;
  max_tokens: number | null;
  max_input_tokens: number | null;
  frequency_penalty: number | null;
  presence_penalty: number | null;
}

export interface LMBProfile {
  id: string;
  name: string;
  chapterPresetKey: string;
  arcPresetKey: string;
  volumePresetKey: string;
  previousMemoriesCount: number;
  regexOutgoingScriptIds: string[];
  regexIncomingScriptIds: string[];
  connectionId: string | null;
  samplers: SamplerSet;
  hideCoveredMessages: boolean;
  showMemoryPreviews: boolean;
  retryCount: number;
  ttftTimeoutSecs: number;
}

export interface CustomPreset {
  key: string;
  displayName: string;
  prompt: string;
  category: "chapter" | "arc" | "volume";
  createdAt: number;
}

export interface LMBSettings {
  version: number;
  enabled: boolean;
  profiles: LMBProfile[];
  activeProfileId: string;
  customPresets: CustomPreset[];
  debugLog: boolean;
  forceConstantEntries: boolean;
  memoryInjectionMode: MemoryInjectionMode;
  memoryOutletName: string;
  bookNameTemplate: string;
  chapterNameTemplate: string;
  arcNameTemplate: string;
  volumeNameTemplate: string;
}

export interface LMBEntryMeta {
  /** 1 = chapter, 2 = arc, 3 = volume. */
  tier: 1 | 2 | 3;
  chatId: string;
  msgIds: string[];
  /** Ids of the tier below: chapter ids on an arc, arc ids on a volume. */
  sourceChapterEntryIds?: string[];
  firstMsgIdx?: number;
  lastMsgIdx?: number;
  tokenCountInput: number;
  tokenCountOutput: number;
  model: string;
  connectionId: string;
  createdAt: number;
  supersededByEntryId?: string | null;
  title?: string;
  shortComment?: string;
  presetKey?: string;
  sceneNumber?: number;
  storyOrder?: number;
  preserveComment?: boolean;
  rawOutput?: string;
  isRoot?: boolean;
  rootOrigin?: string;
}

export const DEFAULT_SAMPLERS: SamplerSet = {
  temperature: null,
  top_p: null,
  top_k: null,
  max_tokens: null,
  max_input_tokens: null,
  frequency_penalty: null,
  presence_penalty: null,
};

export const SAMPLER_DEFAULTS: Readonly<Record<keyof SamplerSet, number>> = {
  temperature: 0.4,
  top_p: 1,
  top_k: 0,
  max_tokens: 32000,
  max_input_tokens: 128000,
  frequency_penalty: 0,
  presence_penalty: 0,
};

export function makeDefaultProfile(id: string, name: string): LMBProfile {
  return {
    id,
    name,
    chapterPresetKey: "summary",
    arcPresetKey: "arc_default",
    volumePresetKey: "volume_default",
    previousMemoriesCount: 7,
    regexOutgoingScriptIds: [],
    regexIncomingScriptIds: [],
    connectionId: null,
    samplers: { ...DEFAULT_SAMPLERS },
    hideCoveredMessages: true,
    showMemoryPreviews: false,
    retryCount: 3,
    ttftTimeoutSecs: 60,
  };
}

export const DEFAULT_SETTINGS: LMBSettings = {
  version: STORAGE_VERSION,
  enabled: true,
  profiles: [makeDefaultProfile("default", "Default")],
  activeProfileId: "default",
  customPresets: [],
  debugLog: false,
  forceConstantEntries: true,
  memoryInjectionMode: "outlet",
  memoryOutletName: "lumibooks",
  bookNameTemplate: `${WORLD_BOOK_NAME_PREFIX} - {{chat}}`,
  chapterNameTemplate: "#{{storyOrder}} - {{title}} (msgs {{scene}})",
  arcNameTemplate: "{{rootPrefix}}Arc {{sceneNumberPadded}} - {{title}}",
  volumeNameTemplate: "{{rootPrefix}}Volume {{sceneNumberPadded}} - {{title}}",
};

const LEGACY_CHAPTER_NAME_TEMPLATE = "#{{sceneNumber}} - {{title}} (msgs {{scene}})";
const LEGACY_ARC_NAME_TEMPLATE = "{{rootPrefix}}Arc #{{sceneNumber}} - {{title}} (msgs {{scene}})";
const LEGACY_VOLUME_NAME_TEMPLATE = "{{rootPrefix}}Volume #{{sceneNumber}} - {{title}} (msgs {{scene}})";

export function diskVersionFor(raw: Partial<LMBSettings> | null | undefined): number {
  const v = raw && typeof raw === "object" ? raw : {};
  return typeof v.version === "number" ? v.version : 1;
}

export function normalizeSettings(raw: Partial<LMBSettings> | null | undefined): LMBSettings {
  const fallback = DEFAULT_SETTINGS;
  const v = raw && typeof raw === "object" ? raw : {};
  const profilesRaw = Array.isArray(v.profiles) ? v.profiles : fallback.profiles;
  const profiles = profilesRaw
    .map((p): LMBProfile | null => normalizeProfile(p))
    .filter((p): p is LMBProfile => !!p);
  if (profiles.length === 0) profiles.push(makeDefaultProfile("default", "Default"));
  const activeProfileId =
    typeof v.activeProfileId === "string" && profiles.some((p) => p.id === v.activeProfileId)
      ? v.activeProfileId
      : profiles[0]!.id;
  const customPresets = Array.isArray(v.customPresets)
    ? v.customPresets.map(normalizeCustomPreset).filter((p): p is CustomPreset => !!p)
    : [];
  return {
    version: STORAGE_VERSION,
    enabled: typeof v.enabled === "boolean" ? v.enabled : fallback.enabled,
    profiles,
    activeProfileId,
    customPresets,
    debugLog: typeof v.debugLog === "boolean" ? v.debugLog : fallback.debugLog,
    forceConstantEntries: typeof v.forceConstantEntries === "boolean" ? v.forceConstantEntries : fallback.forceConstantEntries,
    memoryInjectionMode: "outlet",
    memoryOutletName: normalizeOutletName(v.memoryOutletName, fallback.memoryOutletName),
    bookNameTemplate: normalizeTemplate(v.bookNameTemplate, fallback.bookNameTemplate),
    chapterNameTemplate: normalizeTemplate(v.chapterNameTemplate, fallback.chapterNameTemplate, LEGACY_CHAPTER_NAME_TEMPLATE),
    arcNameTemplate: normalizeTemplate(v.arcNameTemplate, fallback.arcNameTemplate, LEGACY_ARC_NAME_TEMPLATE),
    volumeNameTemplate: normalizeTemplate(v.volumeNameTemplate, fallback.volumeNameTemplate, LEGACY_VOLUME_NAME_TEMPLATE),
  };
}

export function normalizeTemplate(raw: unknown, fallback: string, legacyDefault?: string): string {
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (legacyDefault && trimmed === legacyDefault) return fallback;
  return trimmed || fallback;
}

export function normalizeProfile(raw: unknown): LMBProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Partial<LMBProfile>;
  const id = typeof v.id === "string" && v.id.trim() ? v.id : null;
  if (!id) return null;
  const base = makeDefaultProfile(id, typeof v.name === "string" && v.name.trim() ? v.name : "Untitled");
  return {
    ...base,
    chapterPresetKey: typeof v.chapterPresetKey === "string" && v.chapterPresetKey.trim() ? v.chapterPresetKey : base.chapterPresetKey,
    arcPresetKey: typeof v.arcPresetKey === "string" && v.arcPresetKey.trim() ? v.arcPresetKey : base.arcPresetKey,
    volumePresetKey: typeof v.volumePresetKey === "string" && v.volumePresetKey.trim() ? v.volumePresetKey : base.volumePresetKey,
    previousMemoriesCount: clampInt(v.previousMemoriesCount, 0, 20, base.previousMemoriesCount),
    regexOutgoingScriptIds: Array.isArray(v.regexOutgoingScriptIds)
      ? v.regexOutgoingScriptIds.filter((x): x is string => typeof x === "string")
      : base.regexOutgoingScriptIds,
    regexIncomingScriptIds: Array.isArray(v.regexIncomingScriptIds)
      ? v.regexIncomingScriptIds.filter((x): x is string => typeof x === "string")
      : base.regexIncomingScriptIds,
    connectionId: typeof v.connectionId === "string" && v.connectionId.trim() ? v.connectionId : null,
    samplers: normalizeSamplers(v.samplers),
    hideCoveredMessages: typeof v.hideCoveredMessages === "boolean" ? v.hideCoveredMessages : base.hideCoveredMessages,
    showMemoryPreviews: typeof v.showMemoryPreviews === "boolean" ? v.showMemoryPreviews : base.showMemoryPreviews,
    retryCount: clampInt(v.retryCount, 0, 10, base.retryCount),
    ttftTimeoutSecs: clampInt(v.ttftTimeoutSecs, 10, 600, base.ttftTimeoutSecs),
  };
}

export function normalizeSamplers(raw: unknown): SamplerSet {
  const v = raw && typeof raw === "object" ? (raw as Partial<SamplerSet>) : {};
  return {
    temperature: numOrNull(v.temperature, 0, 2),
    top_p: numOrNull(v.top_p, 0, 1),
    top_k: numOrNull(v.top_k, 0, 1000),
    max_tokens: numOrNull(v.max_tokens, 1, 1000000),
    max_input_tokens: numOrNull(v.max_input_tokens, 256, 4000000),
    frequency_penalty: numOrNull(v.frequency_penalty, -2, 2),
    presence_penalty: numOrNull(v.presence_penalty, -2, 2),
  };
}

export function normalizeCustomPreset(raw: unknown): CustomPreset | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Partial<CustomPreset>;
  if (typeof v.key !== "string" || !v.key.trim()) return null;
  if (typeof v.prompt !== "string" || !v.prompt.trim()) return null;
  const category = v.category === "arc" ? "arc" : v.category === "volume" ? "volume" : "chapter";
  return {
    key: v.key,
    displayName: typeof v.displayName === "string" && v.displayName.trim() ? v.displayName : v.key,
    prompt: v.prompt,
    category,
    createdAt: typeof v.createdAt === "number" ? v.createdAt : Date.now(),
  };
}

export function normalizeEntryMeta(raw: unknown): LMBEntryMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Partial<LMBEntryMeta>;
  const tier = v.tier === 3 ? 3 : v.tier === 2 ? 2 : v.tier === 1 ? 1 : null;
  if (!tier) return null;
  if (typeof v.chatId !== "string" || !v.chatId.trim()) return null;
  const msgIds = Array.isArray(v.msgIds) ? v.msgIds.filter((x): x is string => typeof x === "string") : [];
  return {
    tier,
    chatId: v.chatId,
    msgIds,
    sourceChapterEntryIds: Array.isArray(v.sourceChapterEntryIds)
      ? v.sourceChapterEntryIds.filter((x): x is string => typeof x === "string")
      : undefined,
    firstMsgIdx: typeof v.firstMsgIdx === "number" ? v.firstMsgIdx : undefined,
    lastMsgIdx: typeof v.lastMsgIdx === "number" ? v.lastMsgIdx : undefined,
    tokenCountInput: typeof v.tokenCountInput === "number" ? v.tokenCountInput : 0,
    tokenCountOutput: typeof v.tokenCountOutput === "number" ? v.tokenCountOutput : 0,
    model: typeof v.model === "string" ? v.model : "",
    connectionId: typeof v.connectionId === "string" ? v.connectionId : "",
    createdAt: typeof v.createdAt === "number" ? v.createdAt : Date.now(),
    supersededByEntryId:
      typeof v.supersededByEntryId === "string" && v.supersededByEntryId.trim() ? v.supersededByEntryId : null,
    title: typeof v.title === "string" ? v.title : undefined,
    shortComment: typeof v.shortComment === "string" ? v.shortComment : undefined,
    presetKey: typeof v.presetKey === "string" ? v.presetKey : undefined,
    sceneNumber:
      typeof v.sceneNumber === "number" && Number.isFinite(v.sceneNumber) && v.sceneNumber > 0
        ? Math.floor(v.sceneNumber)
        : undefined,
    storyOrder:
      typeof v.storyOrder === "number" && Number.isFinite(v.storyOrder) && v.storyOrder > 0
        ? Math.floor(v.storyOrder)
        : undefined,
    preserveComment: v.preserveComment === true ? true : undefined,
    rawOutput: typeof v.rawOutput === "string" ? v.rawOutput : undefined,
    isRoot: v.isRoot === true ? true : undefined,
    rootOrigin: typeof v.rootOrigin === "string" && v.rootOrigin.trim() ? v.rootOrigin : undefined,
  };
}

export function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  const n = Math.round(v);
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function numOrNull(v: unknown, min: number, max: number): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  if (v < min || v > max) return null;
  return v;
}

export function normalizeOutletName(raw: unknown, fallback = "lumibooks"): string {
  if (typeof raw !== "string") return fallback;
  const clean = raw.trim().replace(/\s+/g, "_").replace(/[{}]/g, "").slice(0, 80);
  return clean || fallback;
}

export function approximateTokensFromChars(chars: number): number {
  return Math.ceil(chars / 4);
}

export function bookNameFor(chatName: string | null | undefined, chatId: string): string {
  const cleanName = (chatName ?? "").trim();
  const suffix = cleanName ? cleanName.slice(0, 60) : chatId.slice(0, 8);
  return `${WORLD_BOOK_NAME_PREFIX} - ${suffix}`;
}
