// @bun
// src/shared.ts
var EXTENSION_ID = "lumi_books";
var EXTENSION_KEY = "lumibooks";
var PROJECTION_KEY = "lumibooks_projection";
var WORLD_BOOK_NAME_PREFIX = "LumiBooks";
var STORAGE_VERSION = 4;
var SETTINGS_PATH = "settings.json";
var CHAT_STATE_DIR = "chats";
var DEFAULT_SAMPLERS = {
  temperature: null,
  top_p: null,
  top_k: null,
  max_tokens: null,
  max_input_tokens: null,
  frequency_penalty: null,
  presence_penalty: null
};
var SAMPLER_DEFAULTS = {
  temperature: 0.4,
  top_p: 1,
  top_k: 0,
  max_tokens: 32000,
  max_input_tokens: 128000,
  frequency_penalty: 0,
  presence_penalty: 0
};
function makeDefaultProfile(id, name) {
  return {
    id,
    name,
    lagUnit: "messages",
    lagValue: 65,
    windowUnit: "messages",
    windowValue: 18,
    chapterTargetUnit: "percent",
    chapterTargetPercent: 15,
    chapterTargetTokens: 800,
    arcTargetUnit: "percent",
    arcTargetPercent: 20,
    arcTargetTokens: 1500,
    volumeTargetUnit: "percent",
    volumeTargetPercent: 25,
    volumeTargetTokens: 3000,
    arcTrigger: "chapters",
    arcAfterChapters: 6,
    arcAfterTokens: 8000,
    arcLagChapters: 7,
    arcLagTokens: 2000,
    chapterPresetKey: "summary",
    arcPresetKey: "arc_default",
    volumePresetKey: "volume_default",
    previousMemoriesCount: 7,
    regexOutgoingScriptIds: [],
    regexIncomingScriptIds: [],
    connectionId: null,
    samplers: { ...DEFAULT_SAMPLERS },
    autoCreate: true,
    autoCreateChapter: true,
    autoCreateArc: true,
    hideCoveredMessages: true,
    showMemoryPreviews: false,
    retryCount: 3,
    shortCommentRulesOverride: null,
    memoriaPersonaOverride: null,
    ttftTimeoutSecs: 60
  };
}
var DEFAULT_SETTINGS = {
  version: STORAGE_VERSION,
  enabled: true,
  profiles: [makeDefaultProfile("default", "Default")],
  activeProfileId: "default",
  customPresets: [],
  debugLog: false,
  forceConstantEntries: true,
  showAutomationToasts: true,
  memoryInjectionMode: "outlet",
  memoryOutletName: "lumibooks",
  bookNameTemplate: `${WORLD_BOOK_NAME_PREFIX} - {{chat}}`,
  chapterNameTemplate: "#{{storyOrder}} - {{title}} (msgs {{scene}})",
  arcNameTemplate: "{{rootPrefix}}Arc {{sceneNumberPadded}} - {{title}}",
  volumeNameTemplate: "{{rootPrefix}}Volume {{sceneNumberPadded}} - {{title}}",
  includeContentHeaders: false
};
var LEGACY_CHAPTER_NAME_TEMPLATE = "#{{sceneNumber}} - {{title}} (msgs {{scene}})";
var LEGACY_ARC_NAME_TEMPLATE = "{{rootPrefix}}Arc #{{sceneNumber}} - {{title}} (msgs {{scene}})";
var LEGACY_VOLUME_NAME_TEMPLATE = "{{rootPrefix}}Volume #{{sceneNumber}} - {{title}} (msgs {{scene}})";
function diskVersionFor(raw) {
  const v = raw && typeof raw === "object" ? raw : {};
  return typeof v.version === "number" ? v.version : 1;
}
function normalizeSettings(raw) {
  const fallback = DEFAULT_SETTINGS;
  const v = raw && typeof raw === "object" ? raw : {};
  const profilesRaw = Array.isArray(v.profiles) ? v.profiles : fallback.profiles;
  const profiles = profilesRaw.map((p) => normalizeProfile(p)).filter((p) => !!p);
  if (profiles.length === 0)
    profiles.push(makeDefaultProfile("default", "Default"));
  const activeProfileId = typeof v.activeProfileId === "string" && profiles.some((p) => p.id === v.activeProfileId) ? v.activeProfileId : profiles[0].id;
  const customPresets = Array.isArray(v.customPresets) ? v.customPresets.map(normalizeCustomPreset).filter((p) => !!p) : [];
  return {
    version: STORAGE_VERSION,
    enabled: typeof v.enabled === "boolean" ? v.enabled : fallback.enabled,
    profiles,
    activeProfileId,
    customPresets,
    debugLog: typeof v.debugLog === "boolean" ? v.debugLog : fallback.debugLog,
    forceConstantEntries: typeof v.forceConstantEntries === "boolean" ? v.forceConstantEntries : fallback.forceConstantEntries,
    showAutomationToasts: typeof v.showAutomationToasts === "boolean" ? v.showAutomationToasts : fallback.showAutomationToasts,
    memoryInjectionMode: "outlet",
    memoryOutletName: normalizeOutletName(v.memoryOutletName, fallback.memoryOutletName),
    bookNameTemplate: normalizeTemplate(v.bookNameTemplate, fallback.bookNameTemplate),
    chapterNameTemplate: normalizeTemplate(v.chapterNameTemplate, fallback.chapterNameTemplate, LEGACY_CHAPTER_NAME_TEMPLATE),
    arcNameTemplate: normalizeTemplate(v.arcNameTemplate, fallback.arcNameTemplate, LEGACY_ARC_NAME_TEMPLATE),
    volumeNameTemplate: normalizeTemplate(v.volumeNameTemplate, fallback.volumeNameTemplate, LEGACY_VOLUME_NAME_TEMPLATE),
    includeContentHeaders: typeof v.includeContentHeaders === "boolean" ? v.includeContentHeaders : fallback.includeContentHeaders
  };
}
function normalizeTemplate(raw, fallback, legacyDefault) {
  if (typeof raw !== "string")
    return fallback;
  const trimmed = raw.trim();
  if (legacyDefault && trimmed === legacyDefault)
    return fallback;
  return trimmed || fallback;
}
function normalizeProfile(raw) {
  if (!raw || typeof raw !== "object")
    return null;
  const v = raw;
  const id = typeof v.id === "string" && v.id.trim() ? v.id : null;
  if (!id)
    return null;
  const base = makeDefaultProfile(id, typeof v.name === "string" && v.name.trim() ? v.name : "Untitled");
  return {
    ...base,
    lagUnit: v.lagUnit === "tokens" ? "tokens" : "messages",
    lagValue: clampInt(v.lagValue, 0, v.lagUnit === "tokens" ? 1e6 : 1e5, base.lagValue),
    windowUnit: v.windowUnit === "tokens" ? "tokens" : "messages",
    windowValue: clampInt(v.windowValue, 1, v.windowUnit === "tokens" ? 1e6 : 1e5, base.windowValue),
    chapterTargetUnit: v.chapterTargetUnit === "tokens" ? "tokens" : "percent",
    chapterTargetPercent: clampInt(v.chapterTargetPercent, 2, 90, base.chapterTargetPercent),
    chapterTargetTokens: clampInt(v.chapterTargetTokens, 50, 1e6, base.chapterTargetTokens),
    arcTargetUnit: v.arcTargetUnit === "tokens" ? "tokens" : "percent",
    arcTargetPercent: clampInt(v.arcTargetPercent, 5, 95, base.arcTargetPercent),
    arcTargetTokens: clampInt(v.arcTargetTokens, 50, 1e6, base.arcTargetTokens),
    volumeTargetUnit: v.volumeTargetUnit === "tokens" ? "tokens" : "percent",
    volumeTargetPercent: clampInt(v.volumeTargetPercent, 5, 95, base.volumeTargetPercent),
    volumeTargetTokens: clampInt(v.volumeTargetTokens, 50, 1e6, base.volumeTargetTokens),
    arcTrigger: v.arcTrigger === "tokens" || v.arcTrigger === "manual" ? v.arcTrigger : "chapters",
    arcAfterChapters: clampInt(v.arcAfterChapters, 2, 100, base.arcAfterChapters),
    arcAfterTokens: clampInt(v.arcAfterTokens, 500, 200000, base.arcAfterTokens),
    arcLagChapters: clampInt(v.arcLagChapters, 0, 100, base.arcLagChapters),
    arcLagTokens: clampInt(v.arcLagTokens, 0, 200000, base.arcLagTokens),
    chapterPresetKey: typeof v.chapterPresetKey === "string" && v.chapterPresetKey.trim() ? v.chapterPresetKey : base.chapterPresetKey,
    arcPresetKey: typeof v.arcPresetKey === "string" && v.arcPresetKey.trim() ? v.arcPresetKey : base.arcPresetKey,
    volumePresetKey: typeof v.volumePresetKey === "string" && v.volumePresetKey.trim() ? v.volumePresetKey : base.volumePresetKey,
    previousMemoriesCount: clampInt(v.previousMemoriesCount, 0, 20, base.previousMemoriesCount),
    regexOutgoingScriptIds: Array.isArray(v.regexOutgoingScriptIds) ? v.regexOutgoingScriptIds.filter((x) => typeof x === "string") : base.regexOutgoingScriptIds,
    regexIncomingScriptIds: Array.isArray(v.regexIncomingScriptIds) ? v.regexIncomingScriptIds.filter((x) => typeof x === "string") : base.regexIncomingScriptIds,
    connectionId: typeof v.connectionId === "string" && v.connectionId.trim() ? v.connectionId : null,
    samplers: normalizeSamplers(v.samplers),
    autoCreate: typeof v.autoCreate === "boolean" ? v.autoCreate : base.autoCreate,
    autoCreateChapter: typeof v.autoCreateChapter === "boolean" ? v.autoCreateChapter : base.autoCreateChapter,
    autoCreateArc: typeof v.autoCreateArc === "boolean" ? v.autoCreateArc : base.autoCreateArc,
    hideCoveredMessages: typeof v.hideCoveredMessages === "boolean" ? v.hideCoveredMessages : base.hideCoveredMessages,
    showMemoryPreviews: typeof v.showMemoryPreviews === "boolean" ? v.showMemoryPreviews : base.showMemoryPreviews,
    retryCount: clampInt(v.retryCount, 0, 10, base.retryCount),
    shortCommentRulesOverride: typeof v.shortCommentRulesOverride === "string" && v.shortCommentRulesOverride.trim() !== "" ? v.shortCommentRulesOverride : null,
    memoriaPersonaOverride: typeof v.memoriaPersonaOverride === "string" && v.memoriaPersonaOverride.trim() !== "" ? v.memoriaPersonaOverride : null,
    ttftTimeoutSecs: clampInt(v.ttftTimeoutSecs, 10, 600, base.ttftTimeoutSecs)
  };
}
function normalizeSamplers(raw) {
  const v = raw && typeof raw === "object" ? raw : {};
  return {
    temperature: numOrNull(v.temperature, 0, 2),
    top_p: numOrNull(v.top_p, 0, 1),
    top_k: numOrNull(v.top_k, 0, 1000),
    max_tokens: numOrNull(v.max_tokens, 1, 1e6),
    max_input_tokens: numOrNull(v.max_input_tokens, 256, 4000000),
    frequency_penalty: numOrNull(v.frequency_penalty, -2, 2),
    presence_penalty: numOrNull(v.presence_penalty, -2, 2)
  };
}
function normalizeCustomPreset(raw) {
  if (!raw || typeof raw !== "object")
    return null;
  const v = raw;
  if (typeof v.key !== "string" || !v.key.trim())
    return null;
  if (typeof v.prompt !== "string" || !v.prompt.trim())
    return null;
  const category = v.category === "arc" ? "arc" : v.category === "volume" ? "volume" : "chapter";
  return {
    key: v.key,
    displayName: typeof v.displayName === "string" && v.displayName.trim() ? v.displayName : v.key,
    prompt: v.prompt,
    category,
    createdAt: typeof v.createdAt === "number" ? v.createdAt : Date.now()
  };
}
function normalizeEntryMeta(raw) {
  if (!raw || typeof raw !== "object")
    return null;
  const v = raw;
  const tier = v.tier === 3 ? 3 : v.tier === 2 ? 2 : v.tier === 1 ? 1 : null;
  if (!tier)
    return null;
  if (typeof v.chatId !== "string" || !v.chatId.trim())
    return null;
  const msgIds = Array.isArray(v.msgIds) ? v.msgIds.filter((x) => typeof x === "string") : [];
  return {
    tier,
    chatId: v.chatId,
    msgIds,
    sourceChapterEntryIds: Array.isArray(v.sourceChapterEntryIds) ? v.sourceChapterEntryIds.filter((x) => typeof x === "string") : undefined,
    firstMsgIdx: typeof v.firstMsgIdx === "number" ? v.firstMsgIdx : undefined,
    lastMsgIdx: typeof v.lastMsgIdx === "number" ? v.lastMsgIdx : undefined,
    tokenCountInput: typeof v.tokenCountInput === "number" ? v.tokenCountInput : 0,
    tokenCountOutput: typeof v.tokenCountOutput === "number" ? v.tokenCountOutput : 0,
    model: typeof v.model === "string" ? v.model : "",
    connectionId: typeof v.connectionId === "string" ? v.connectionId : "",
    createdAt: typeof v.createdAt === "number" ? v.createdAt : Date.now(),
    supersededByEntryId: typeof v.supersededByEntryId === "string" && v.supersededByEntryId.trim() ? v.supersededByEntryId : null,
    title: typeof v.title === "string" ? v.title : undefined,
    shortComment: typeof v.shortComment === "string" ? v.shortComment : undefined,
    presetKey: typeof v.presetKey === "string" ? v.presetKey : undefined,
    sceneNumber: typeof v.sceneNumber === "number" && Number.isFinite(v.sceneNumber) && v.sceneNumber > 0 ? Math.floor(v.sceneNumber) : undefined,
    storyOrder: typeof v.storyOrder === "number" && Number.isFinite(v.storyOrder) && v.storyOrder > 0 ? Math.floor(v.storyOrder) : undefined,
    preserveComment: v.preserveComment === true ? true : undefined,
    rawOutput: typeof v.rawOutput === "string" ? v.rawOutput : undefined,
    isRoot: v.isRoot === true ? true : undefined,
    rootOrigin: typeof v.rootOrigin === "string" && v.rootOrigin.trim() ? v.rootOrigin : undefined
  };
}
function clampInt(v, min, max, fallback) {
  if (typeof v !== "number" || !Number.isFinite(v))
    return fallback;
  const n = Math.round(v);
  if (n < min)
    return min;
  if (n > max)
    return max;
  return n;
}
function numOrNull(v, min, max) {
  if (v === null || v === undefined)
    return null;
  if (typeof v !== "number" || !Number.isFinite(v))
    return null;
  if (v < min || v > max)
    return null;
  return v;
}
function normalizeOutletName(raw, fallback = "lumibooks") {
  if (typeof raw !== "string")
    return fallback;
  const clean = raw.trim().replace(/\s+/g, "_").replace(/[{}]/g, "").slice(0, 80);
  return clean || fallback;
}
function approximateTokensFromChars(chars) {
  return Math.ceil(chars / 4);
}
function ordinal(n) {
  if (!Number.isFinite(n) || n < 1)
    return String(n);
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13)
    return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
function buildChapterHeader(sceneNumber, turnCount) {
  return `${ordinal(sceneNumber)} Summary Chapter Containing ${turnCount} Prior Turn${turnCount === 1 ? "" : "s"}`;
}
function buildArcHeader(sceneNumber, chapterCount, turnCount) {
  return `${ordinal(sceneNumber)} Summary ARC Containing ${chapterCount} Prior Chapter${chapterCount === 1 ? "" : "s"} and ${turnCount} Prior Turn${turnCount === 1 ? "" : "s"}`;
}
function buildVolumeHeader(sceneNumber, arcCount, turnCount) {
  return `${ordinal(sceneNumber)} Summary VOLUME Containing ${arcCount} Prior Arc${arcCount === 1 ? "" : "s"} and ${turnCount} Prior Turn${turnCount === 1 ? "" : "s"}`;
}
function bookNameFor(chatName, chatId) {
  const cleanName = (chatName ?? "").trim();
  const suffix = cleanName ? cleanName.slice(0, 60) : chatId.slice(0, 8);
  return `${WORLD_BOOK_NAME_PREFIX} - ${suffix}`;
}

// src/backend/runtime.ts
var lastFrontendUserId = null;
var CHAT_USER_MAP_CAP = 2000;
var chatUserIds = new Map;
function setLastFrontendUserId(userId) {
  lastFrontendUserId = userId;
}
function rememberChatUser(chatId, userId) {
  if (!chatId || !userId)
    return;
  if (chatUserIds.has(chatId)) {
    chatUserIds.delete(chatId);
  } else if (chatUserIds.size >= CHAT_USER_MAP_CAP) {
    const oldestKey = chatUserIds.keys().next().value;
    if (oldestKey !== undefined)
      chatUserIds.delete(oldestKey);
  }
  chatUserIds.set(chatId, userId);
}
function resolveUserId(chatId) {
  if (chatId) {
    const mapped = chatUserIds.get(chatId);
    if (mapped)
      return mapped;
  }
  return null;
}
function getBootstrapUserId() {
  return lastFrontendUserId;
}
function send(payload, userId) {
  spindle.sendToFrontend(payload, userId);
}
function hostToast(userId, tone, text) {
  const t = spindle.toast;
  if (!t)
    return;
  const method = tone === "warn" ? "warning" : tone === "success" || tone === "info" || tone === "error" ? tone : "info";
  if (typeof t[method] !== "function")
    return;
  try {
    t[method](text, { userId, duration: tone === "error" ? 8000 : 4000 });
  } catch (err) {
    warn(`toast call failed: ${describeError(err)}`);
  }
}
function readChatIdFromMessage(msg) {
  if (!("chatId" in msg))
    return null;
  const value = msg.chatId;
  return typeof value === "string" && value.trim() ? value : null;
}
async function ensureUserFolders(userId) {
  await Promise.all([
    spindle.userStorage.mkdir(CHAT_STATE_DIR, userId).catch(() => {})
  ]);
}
function debug(userId, ...parts) {
  spindle.log.info(`[lmb:${userId.slice(0, 6)}] ${parts.map(stringifyPart).join(" ")}`);
}
function info(message) {
  spindle.log.info(`[lmb] ${message}`);
}
function warn(message) {
  spindle.log.warn(`[lmb] ${message}`);
}
function error(message) {
  spindle.log.error(`[lmb] ${message}`);
}
function stringifyPart(p) {
  if (p === null || p === undefined)
    return String(p);
  if (typeof p === "string")
    return p;
  if (typeof p === "number" || typeof p === "boolean")
    return String(p);
  try {
    return JSON.stringify(p);
  } catch {
    return String(p);
  }
}
function describeError(err) {
  if (err instanceof Error)
    return err.message;
  if (typeof err === "string")
    return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

// src/backend/storage.ts
var warnedNewerForUser = new Set;
var writeLocks = new Map;
function withSettingsLock(userId, fn) {
  const prev = writeLocks.get(userId) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  writeLocks.set(userId, next.catch(() => {}));
  return next;
}
async function loadSettings(userId) {
  const raw = await spindle.userStorage.getJson(SETTINGS_PATH, { fallback: DEFAULT_SETTINGS, userId }).catch(() => DEFAULT_SETTINGS);
  const diskVersion = diskVersionFor(raw);
  if (diskVersion > STORAGE_VERSION && !warnedNewerForUser.has(userId)) {
    warnedNewerForUser.add(userId);
    warn(`settings on disk are v${diskVersion}, this build understands v${STORAGE_VERSION}`);
  }
  return normalizeSettings(raw);
}
async function patchSettings(userId, patch) {
  return withSettingsLock(userId, async () => {
    const current = await loadSettings(userId);
    const next = { ...current, ...patch };
    const normalized = normalizeSettings(next);
    await spindle.userStorage.setJson(SETTINGS_PATH, normalized, { indent: 2, userId });
    return normalized;
  });
}
async function mutateSettings(userId, fn) {
  return withSettingsLock(userId, async () => {
    const current = await loadSettings(userId);
    const next = await fn(current);
    const normalized = normalizeSettings(next);
    await spindle.userStorage.setJson(SETTINGS_PATH, normalized, { indent: 2, userId });
    return normalized;
  });
}

// src/backend/naming.ts
var LOCAL_MACRO_RE = /\{\{\s*([a-zA-Z][\w-]*)\s*\}\}/g;
function sceneRange(firstMsgIdx, lastMsgIdx) {
  if (typeof firstMsgIdx === "number" && typeof lastMsgIdx === "number" && lastMsgIdx >= firstMsgIdx) {
    return `${firstMsgIdx + 1}-${lastMsgIdx + 1}`;
  }
  if (typeof firstMsgIdx === "number")
    return String(firstMsgIdx + 1);
  return "";
}
function savedMemoryContent(settings, opener, content) {
  const clean = content.trim();
  if (!settings.includeContentHeaders)
    return clean;
  return `${opener.trim()}

${clean}`.trim();
}
function stripGeneratedHeader(content) {
  return content.replace(/^\s*\d+(?:st|nd|rd|th) Summary (?:Chapter|ARC|VOLUME) Containing [^\n]*\n{2,}/i, "").trim();
}
async function formatEntryName(settings, ctx) {
  const template = ctx.tier === "volume" ? settings.volumeNameTemplate : ctx.tier === "arc" ? settings.arcNameTemplate : settings.chapterNameTemplate;
  const fallback = fallbackEntryName(ctx);
  return resolveTemplate(template, ctx, fallback);
}
async function formatBookName(settings, chatId, userId, chatName) {
  return resolveTemplate(settings.bookNameTemplate, {
    chatId,
    userId,
    tier: "chapter",
    title: chatName?.trim() || chatId.slice(0, 8),
    sceneNumber: 1,
    chatName
  }, bookNameFor(chatName, chatId));
}
async function resolveTemplate(template, ctx, fallback) {
  const local = applyLocalMacros(template, ctx).trim();
  const candidate = local || fallback;
  try {
    const resolved = await spindle.macros.resolve(candidate, {
      chatId: ctx.chatId,
      userId: ctx.userId,
      commit: false
    });
    return resolved.text.trim() || fallback;
  } catch (err) {
    warn(`name macro resolve failed: ${describeError(err)}`);
    return candidate;
  }
}
function applyLocalMacros(template, ctx) {
  const range = sceneRange(ctx.firstMsgIdx, ctx.lastMsgIdx);
  const chatLabel = ctx.chatName?.trim() || ctx.chatId.slice(0, 8);
  const values = {
    scene: range || String(ctx.sceneNumber),
    scenenumber: String(ctx.sceneNumber),
    scenenumberpadded: pad3(ctx.sceneNumber),
    storyorder: typeof ctx.storyOrder === "number" ? String(ctx.storyOrder) : String(ctx.sceneNumber),
    storyorderpadded: pad3(typeof ctx.storyOrder === "number" ? ctx.storyOrder : ctx.sceneNumber),
    title: ctx.title.trim() || fallbackTitle(ctx),
    tier: ctx.tier,
    chat: chatLabel,
    chatname: chatLabel,
    rootprefix: ctx.isRoot ? "[Root] " : "",
    turns: typeof ctx.turnCount === "number" ? String(ctx.turnCount) : "",
    sources: typeof ctx.sourceCount === "number" ? String(ctx.sourceCount) : ""
  };
  return template.replace(LOCAL_MACRO_RE, (match, key) => {
    const value = values[key.toLowerCase()];
    return value === undefined ? match : value;
  });
}
function fallbackEntryName(ctx) {
  const prefix = ctx.isRoot ? "[Root] " : "";
  const title = ctx.title.trim() || fallbackTitle(ctx);
  const range = sceneRange(ctx.firstMsgIdx, ctx.lastMsgIdx);
  const suffix = range ? ` (msgs ${range})` : "";
  if (ctx.tier === "chapter")
    return `#${ctx.sceneNumber} - ${title}${suffix}`;
  if (ctx.tier === "arc")
    return `${prefix}Arc #${ctx.sceneNumber} - ${title}${suffix}`;
  return `${prefix}Volume #${ctx.sceneNumber} - ${title}${suffix}`;
}
function fallbackTitle(ctx) {
  if (ctx.tier === "volume")
    return "Volume";
  if (ctx.tier === "arc")
    return "Arc";
  return "Chapter";
}
function pad3(n) {
  return String(Math.max(0, Math.floor(n))).padStart(3, "0");
}

// src/backend/world-book.ts
var PAGE_LIMIT = 200;
var BOOK_INDEX_CACHE_TTL_MS = 4000;
var bookAnomalyCb = null;
function registerBookAnomalyCallback(cb) {
  bookAnomalyCb = cb;
}
var CHAT_BOOK_CACHE_CAP = 1000;
var chatBookCache = new Map;
var ensureInflight = new Map;
function setBookCache(key, value) {
  if (chatBookCache.has(key))
    chatBookCache.delete(key);
  chatBookCache.set(key, value);
  while (chatBookCache.size > CHAT_BOOK_CACHE_CAP) {
    const oldest = chatBookCache.keys().next().value;
    if (oldest === undefined)
      break;
    chatBookCache.delete(oldest);
  }
}
function cacheKey(userId, chatId) {
  return `${userId}::${chatId}`;
}
async function listAllBooks(userId) {
  const out = [];
  let offset = 0;
  while (true) {
    const page = await spindle.world_books.list({ limit: PAGE_LIMIT, offset, userId });
    out.push(...page.data);
    if (out.length >= page.total || page.data.length === 0)
      break;
    offset += page.data.length;
  }
  return out;
}
async function listAllEntries(bookId, userId) {
  const out = [];
  let offset = 0;
  while (true) {
    const page = await spindle.world_books.entries.list(bookId, { limit: PAGE_LIMIT, offset, userId });
    out.push(...page.data);
    if (out.length >= page.total || page.data.length === 0)
      break;
    offset += page.data.length;
  }
  return out;
}
async function findBookForChat(chatId, userId) {
  const cached = chatBookCache.get(cacheKey(userId, chatId));
  if (cached && cached.expiresAt > Date.now())
    return cached.bookId;
  const chat = await spindle.chats.get(chatId, userId).catch(() => null);
  const fromMeta = chat?.metadata && typeof chat.metadata === "object" ? chat.metadata : null;
  const claimed = fromMeta && typeof fromMeta["lumibooks_book_id"] === "string" ? fromMeta["lumibooks_book_id"] : null;
  if (claimed) {
    const exists = await spindle.world_books.get(claimed, userId).catch(() => null);
    if (exists) {
      const bookMeta = exists.metadata && typeof exists.metadata === "object" ? exists.metadata : null;
      const bookChatId = bookMeta ? bookMeta["lumibooks_chat_id"] : undefined;
      if (bookChatId === chatId) {
        setBookCache(cacheKey(userId, chatId), { bookId: claimed, expiresAt: Date.now() + BOOK_INDEX_CACHE_TTL_MS });
        return claimed;
      }
    }
  }
  const books = await listAllBooks(userId);
  for (const book of books) {
    const meta = book.metadata;
    if (meta && meta["lumibooks_chat_id"] === chatId) {
      setBookCache(cacheKey(userId, chatId), { bookId: book.id, expiresAt: Date.now() + BOOK_INDEX_CACHE_TTL_MS });
      return book.id;
    }
  }
  return null;
}
async function ensureBookForChat(chatId, userId) {
  const key = cacheKey(userId, chatId);
  const inflight = ensureInflight.get(key);
  if (inflight)
    return inflight;
  const p = doEnsureBookForChat(chatId, userId).finally(() => {
    ensureInflight.delete(key);
  });
  ensureInflight.set(key, p);
  return p;
}
async function doEnsureBookForChat(chatId, userId) {
  const existingId = await findBookForChat(chatId, userId);
  if (existingId) {
    const existing = await spindle.world_books.get(existingId, userId);
    if (existing) {
      await bindBookToChat(chatId, existing.id, userId).catch(() => {});
      return existing;
    }
  }
  const chat = await spindle.chats.get(chatId, userId);
  if (!chat)
    throw new Error(`Chat ${chatId} not found for user`);
  const claim = chat.metadata && typeof chat.metadata === "object" ? chat.metadata["lumibooks_book_id"] : undefined;
  const recovery = await recoverBookForChat(chatId, userId).catch((err) => {
    warn(`book recovery scan failed for ${chatId.slice(0, 8)}: ${describeError(err)}`);
    return null;
  });
  if (recovery) {
    const existing = await spindle.world_books.get(recovery.bookId, userId).catch(() => null);
    if (existing) {
      const meta = existing.metadata && typeof existing.metadata === "object" ? existing.metadata : {};
      if (meta["lumibooks_chat_id"] !== chatId) {
        await spindle.world_books.update(existing.id, { metadata: { ...meta, lumibooks_chat_id: chatId } }, userId).catch((err) => {
          warn(`book recovery: failed to re-tag ${existing.id}: ${describeError(err)}`);
        });
      }
      await bindBookToChat(chatId, existing.id, userId).catch(() => {});
      setBookCache(cacheKey(userId, chatId), { bookId: existing.id, expiresAt: Date.now() + BOOK_INDEX_CACHE_TTL_MS });
      error(`book recovery: re-linked book ${existing.id} for chat ${chatId.slice(0, 8)} ` + `(${recovery.count} LumiBooks entries; normal lookup MISSED it; chat claim=${typeof claim === "string" ? claim : "none"}; ` + `${recovery.candidates} candidate book(s); userId=${userId.slice(0, 6)})`);
      bookAnomalyCb?.(userId, "warn", recovery.candidates > 1 ? `Memoria re-linked this chat's notebook but found ${recovery.candidates} candidates, you may have duplicate notebooks` : "Memoria re-linked this chat's notebook after its link was lost");
      return existing;
    }
  }
  if (typeof claim === "string" && claim.trim()) {
    error(`book mismatch: chat ${chatId.slice(0, 8)} claims book ${claim} but it could not be resolved OR recovered; ` + `creating a NEW book. userId=${userId.slice(0, 6)}`);
    bookAnomalyCb?.(userId, "error", "Memoria couldn't find this chat's old notebook and started a new one, older chapters may live in a separate notebook");
  }
  const settings = await loadSettings(userId);
  const bookName = await formatBookName(settings, chatId, userId, chat.name);
  const book = await spindle.world_books.create({
    name: bookName,
    description: "Memoria's shelf for this chat. Chapters and arcs live here.",
    metadata: {
      lumibooks_chat_id: chatId,
      lumibooks_created_at: Date.now()
    }
  }, userId);
  await bindBookToChat(chatId, book.id, userId).catch(() => {});
  setBookCache(cacheKey(userId, chatId), { bookId: book.id, expiresAt: Date.now() + BOOK_INDEX_CACHE_TTL_MS });
  return book;
}
async function recoverBookForChat(chatId, userId) {
  const books = await listAllBooks(userId);
  const matches = [];
  for (const book of books) {
    const meta = book.metadata;
    const bookChatId = meta && typeof meta["lumibooks_chat_id"] === "string" ? meta["lumibooks_chat_id"] : null;
    if (bookChatId && bookChatId !== chatId)
      continue;
    const looksLikeLmb = (book.name || "").startsWith(WORLD_BOOK_NAME_PREFIX) || !!(meta && (meta["lumibooks_chat_id"] || meta["lumibooks_created_at"] || meta["lumibooks_forked_from"]));
    if (!looksLikeLmb)
      continue;
    const entries = await listAllEntries(book.id, userId).catch(() => []);
    let count = 0;
    for (const entry of entries) {
      const ext = entry.extensions || {};
      const m = normalizeEntryMeta(ext[EXTENSION_KEY]);
      if (m && m.chatId === chatId)
        count++;
    }
    if (count > 0)
      matches.push({ id: book.id, count });
  }
  if (matches.length === 0)
    return null;
  matches.sort((a, b) => b.count - a.count);
  return { bookId: matches[0].id, count: matches[0].count, candidates: matches.length };
}
async function bindBookToChat(chatId, bookId, userId) {
  const chat = await spindle.chats.get(chatId, userId).catch(() => null);
  if (!chat)
    return;
  const metadata = chat.metadata && typeof chat.metadata === "object" ? chat.metadata : {};
  const existing = Array.isArray(metadata["chat_world_book_ids"]) ? metadata["chat_world_book_ids"].filter((x) => typeof x === "string") : [];
  const alreadyBound = existing.includes(bookId);
  const alreadyClaimed = metadata["lumibooks_book_id"] === bookId;
  if (alreadyBound && alreadyClaimed)
    return;
  const nextChatBookIds = alreadyBound ? existing : [...existing, bookId];
  await spindle.chats.update(chatId, {
    metadata: {
      ...metadata,
      chat_world_book_ids: nextChatBookIds,
      lumibooks_book_id: bookId
    }
  }, userId);
}
async function adoptBookForChat(chatId, bookId, userId) {
  const book = await spindle.world_books.get(bookId, userId);
  if (!book)
    throw new Error(`World book ${bookId} not found`);
  const metadata = book.metadata && typeof book.metadata === "object" ? book.metadata : {};
  await spindle.world_books.update(bookId, {
    metadata: {
      ...metadata,
      lumibooks_chat_id: chatId,
      lumibooks_adopted_at: Date.now(),
      lumibooks_preserve_name: true
    }
  }, userId);
  await bindBookToChat(chatId, bookId, userId);
  setBookCache(cacheKey(userId, chatId), { bookId, expiresAt: Date.now() + BOOK_INDEX_CACHE_TTL_MS });
}
async function getChatAttachedBookIds(chatId, userId) {
  const chat = await spindle.chats.get(chatId, userId).catch(() => null);
  const md = chat && chat.metadata && typeof chat.metadata === "object" ? chat.metadata : null;
  if (!md || !Array.isArray(md["chat_world_book_ids"]))
    return [];
  return md["chat_world_book_ids"].filter((x) => typeof x === "string");
}
async function reassertChatBinding(chatId, userId) {
  const bookId = await findBookForChat(chatId, userId).catch(() => null);
  if (!bookId)
    return false;
  const chat = await spindle.chats.get(chatId, userId).catch(() => null);
  if (!chat)
    return false;
  const md = chat.metadata && typeof chat.metadata === "object" ? chat.metadata : {};
  const attached = Array.isArray(md["chat_world_book_ids"]) ? md["chat_world_book_ids"].filter((x) => typeof x === "string") : [];
  if (attached.includes(bookId) && md["lumibooks_book_id"] === bookId)
    return false;
  await bindBookToChat(chatId, bookId, userId).catch((err) => {
    warn(`reassertChatBinding: failed to rebind ${bookId} to ${chatId.slice(0, 8)}: ${describeError(err)}`);
  });
  return true;
}
async function listLmbEntries(chatId, userId) {
  const bookId = await findBookForChat(chatId, userId);
  if (!bookId)
    return [];
  const raw = await listAllEntries(bookId, userId);
  const out = [];
  for (const entry of raw) {
    const ext = entry.extensions || {};
    const meta = normalizeEntryMeta(ext[EXTENSION_KEY]);
    if (!meta)
      continue;
    if (meta.chatId !== chatId)
      continue;
    out.push({ raw: entry, meta });
  }
  return out;
}
async function createChapterEntry(bookId, meta, content, comment, userId, keys = [], constant = true) {
  const settings = await loadSettings(userId);
  const orderValue = typeof meta.storyOrder === "number" ? meta.storyOrder : typeof meta.sceneNumber === "number" ? meta.sceneNumber : 100;
  const placement = settings.enabled ? {
    position: 8,
    outlet_name: normalizeOutletName(settings.memoryOutletName),
    order_value: orderValue
  } : {
    order_value: orderValue
  };
  return spindle.world_books.entries.create(bookId, {
    content,
    comment,
    disabled: false,
    constant,
    ...placement,
    key: keys,
    keysecondary: [],
    vectorized: false,
    extensions: {
      [EXTENSION_KEY]: meta
    }
  }, userId);
}
async function applyConstantToAllLmbEntries(userId, constant) {
  const books = await listAllBooks(userId);
  let updated = 0;
  for (const book of books) {
    const meta = book.metadata;
    if (!meta || typeof meta["lumibooks_chat_id"] !== "string")
      continue;
    const entries = await listAllEntries(book.id, userId).catch(() => []);
    for (const entry of entries) {
      const ext = entry.extensions || {};
      if (!ext[EXTENSION_KEY])
        continue;
      if (entry.constant === constant)
        continue;
      try {
        await spindle.world_books.entries.update(entry.id, { constant }, userId);
        updated++;
      } catch (_) {}
    }
  }
  return updated;
}
async function updateEntry(entryId, patch, userId) {
  return spindle.world_books.entries.update(entryId, patch, userId);
}
async function deleteEntry(entryId, userId) {
  await spindle.world_books.entries.delete(entryId, userId);
}
async function setEntryDisabled(entryId, disabled, userId) {
  return spindle.world_books.entries.update(entryId, { disabled }, userId);
}
async function releaseEntry(entry, userId) {
  const ext = entry.raw.extensions || {};
  const nextExt = { ...ext };
  delete nextExt[EXTENSION_KEY];
  const currentComment = entry.raw.comment || "";
  const nextComment = currentComment.startsWith("[orphaned]") ? currentComment : `[orphaned] ${currentComment}`.trim();
  return spindle.world_books.entries.update(entry.raw.id, { extensions: nextExt, comment: nextComment }, userId);
}
async function patchEntryMeta(entry, metaPatch, userId) {
  const next = { ...entry.meta, ...metaPatch };
  const ext = entry.raw.extensions || {};
  return spindle.world_books.entries.update(entry.raw.id, {
    extensions: { ...ext, [EXTENSION_KEY]: next }
  }, userId);
}
function invalidateBookCache(userId, chatId) {
  chatBookCache.delete(cacheKey(userId, chatId));
}
function findCachedChatIdForBook(userId, bookId) {
  const prefix = `${userId}::`;
  for (const [key, value] of chatBookCache) {
    if (!key.startsWith(prefix))
      continue;
    if (value.bookId === bookId)
      return key.slice(prefix.length);
  }
  return null;
}
async function findChatIdForBook(userId, bookId) {
  const cached = findCachedChatIdForBook(userId, bookId);
  if (cached)
    return cached;
  const book = await spindle.world_books.get(bookId, userId).catch(() => null);
  if (!book)
    return null;
  const meta = book.metadata && typeof book.metadata === "object" ? book.metadata : null;
  const claimed = meta && typeof meta["lumibooks_chat_id"] === "string" ? meta["lumibooks_chat_id"] : null;
  return claimed;
}
function invalidateAllBookCacheEntriesForBook(userId, bookId) {
  const prefix = `${userId}::`;
  const toDelete = [];
  for (const [key, value] of chatBookCache) {
    if (!key.startsWith(prefix))
      continue;
    if (value.bookId === bookId)
      toDelete.push(key);
  }
  for (const k of toDelete)
    chatBookCache.delete(k);
}
var ROOT_CANDIDATES_TTL_MS = 8000;
var rootCandidatesCache = new Map;
function invalidateRootCandidates(userId) {
  rootCandidatesCache.delete(userId);
}
async function listRootCandidates(userId) {
  const cached = rootCandidatesCache.get(userId);
  if (cached && Date.now() - cached.at < ROOT_CANDIDATES_TTL_MS)
    return cached.data;
  const books = await listAllBooks(userId).catch(() => []);
  const out = [];
  for (const book of books) {
    const meta = book.metadata;
    const chatId = meta && typeof meta["lumibooks_chat_id"] === "string" ? meta["lumibooks_chat_id"] : null;
    if (!chatId)
      continue;
    const entries = await listAllEntries(book.id, userId).catch(() => []);
    let entryCount = 0;
    for (const e of entries) {
      const ext = e.extensions || {};
      if (ext[EXTENSION_KEY] && !e.disabled)
        entryCount++;
    }
    if (entryCount === 0)
      continue;
    const chat = await spindle.chats.get(chatId, userId).catch(() => null);
    out.push({ chatId, chatName: chat?.name?.trim() || chatId.slice(0, 8), bookId: book.id, entryCount });
  }
  rootCandidatesCache.set(userId, { at: Date.now(), data: out });
  return out;
}

// src/backend/coverage.ts
async function buildCoverage(chatId, userId, preloadedEntries) {
  const allEntries = preloadedEntries ?? await listLmbEntries(chatId, userId);
  const entries = allEntries.filter((e) => !e.raw.disabled);
  const chapters = entries.filter((e) => e.meta.tier === 1);
  const arcs = entries.filter((e) => e.meta.tier === 2);
  const volumes = entries.filter((e) => e.meta.tier === 3);
  const chapterById = new Map(chapters.map((c) => [c.raw.id, c]));
  const arcById = new Map(arcs.map((a) => [a.raw.id, a]));
  const supersededArcIds = new Set;
  for (const vol of volumes) {
    for (const aid of vol.meta.sourceChapterEntryIds ?? []) {
      supersededArcIds.add(aid);
    }
  }
  const supersededChapterIds = new Set;
  for (const arc of arcs) {
    for (const cid of arc.meta.sourceChapterEntryIds ?? []) {
      supersededChapterIds.add(cid);
    }
  }
  const coveredBy = new Map;
  for (const vol of volumes) {
    for (const msgId of vol.meta.msgIds) {
      if (!coveredBy.has(msgId))
        coveredBy.set(msgId, vol.raw.id);
    }
    for (const aid of vol.meta.sourceChapterEntryIds ?? []) {
      const arc = arcById.get(aid);
      if (!arc)
        continue;
      for (const msgId of arc.meta.msgIds) {
        if (!coveredBy.has(msgId))
          coveredBy.set(msgId, vol.raw.id);
      }
      for (const cid of arc.meta.sourceChapterEntryIds ?? []) {
        const ch = chapterById.get(cid);
        if (!ch)
          continue;
        for (const msgId of ch.meta.msgIds) {
          if (!coveredBy.has(msgId))
            coveredBy.set(msgId, vol.raw.id);
        }
      }
    }
  }
  for (const arc of arcs) {
    if (supersededArcIds.has(arc.raw.id))
      continue;
    for (const msgId of arc.meta.msgIds) {
      if (!coveredBy.has(msgId))
        coveredBy.set(msgId, arc.raw.id);
    }
    for (const cid of arc.meta.sourceChapterEntryIds ?? []) {
      const ch = chapterById.get(cid);
      if (!ch)
        continue;
      for (const msgId of ch.meta.msgIds) {
        if (!coveredBy.has(msgId))
          coveredBy.set(msgId, arc.raw.id);
      }
    }
  }
  for (const chapter of chapters) {
    if (supersededChapterIds.has(chapter.raw.id))
      continue;
    for (const msgId of chapter.meta.msgIds) {
      if (!coveredBy.has(msgId))
        coveredBy.set(msgId, chapter.raw.id);
    }
  }
  const activeEntries = [
    ...volumes,
    ...arcs.filter((a) => !supersededArcIds.has(a.raw.id)),
    ...chapters.filter((c) => !supersededChapterIds.has(c.raw.id))
  ];
  return { coveredBy, activeEntries, volumes, arcs, chapters };
}
function isExcluded(m) {
  const md = m.metadata;
  return !!(md && md["lmb_excluded"] === true);
}
function isEligibleForCount(m, _profile) {
  if (isExcluded(m))
    return false;
  const role = m.role;
  if (role === "system" || m.is_system)
    return false;
  return true;
}
function countEligible(messages, profile) {
  let n = 0;
  for (const m of messages)
    if (isEligibleForCount(m, profile))
      n++;
  return n;
}
function sumEligibleTokens(messages, profile) {
  let n = 0;
  for (const m of messages) {
    if (!isEligibleForCount(m, profile))
      continue;
    n += approximateTokensFromChars((m.content || "").length);
  }
  return n;
}
function computeCoverageStats(messages, coverage, profile) {
  const totalMessages = messages.length;
  let coveredMessages = 0;
  let approxUncoveredTokens = 0;
  for (const m of messages) {
    if (coverage.coveredBy.has(m.id)) {
      coveredMessages++;
    } else {
      approxUncoveredTokens += approximateTokensFromChars((m.content || "").length);
    }
  }
  const uncoveredMessages = totalMessages - coveredMessages;
  const uncoveredTail = pickUncoveredTail(messages, coverage);
  const tailCounted = profile.lagUnit === "tokens" ? sumEligibleTokens(uncoveredTail, profile) : countEligible(uncoveredTail, profile);
  const lagSatisfied = tailCounted >= profile.lagValue;
  const compressible = trimLagFromTail(uncoveredTail, profile);
  const headRoom = profile.windowUnit === "tokens" ? sumEligibleTokens(compressible, profile) : countEligible(compressible, profile);
  const windowAvailable = headRoom >= profile.windowValue;
  return {
    totalMessages,
    coveredMessages,
    uncoveredMessages,
    approxUncoveredTokens,
    lagSatisfied,
    windowAvailable
  };
}
function countCompressibleEligible(messages, coverage, profile) {
  const tail = pickUncoveredTail(messages, coverage);
  const compressible = trimLagFromTail(tail, profile);
  return profile.windowUnit === "tokens" ? sumEligibleTokens(compressible, profile) : countEligible(compressible, profile);
}
function trimLagFromTail(uncoveredTail, profile) {
  if (uncoveredTail.length === 0)
    return [];
  if (profile.lagValue <= 0)
    return uncoveredTail.slice();
  if (profile.lagUnit === "messages") {
    let counted = 0;
    let cutoffIdx2 = uncoveredTail.length;
    for (let i = uncoveredTail.length - 1;i >= 0; i--) {
      if (isEligibleForCount(uncoveredTail[i], profile)) {
        counted++;
        if (counted >= profile.lagValue) {
          cutoffIdx2 = i;
          break;
        }
      }
    }
    if (counted < profile.lagValue)
      return [];
    return uncoveredTail.slice(0, cutoffIdx2);
  }
  let lagged = 0;
  let cutoffIdx = 0;
  for (let i = uncoveredTail.length - 1;i >= 0; i--) {
    if (isEligibleForCount(uncoveredTail[i], profile)) {
      lagged += approximateTokensFromChars((uncoveredTail[i].content || "").length);
    }
    cutoffIdx = i;
    if (lagged >= profile.lagValue)
      break;
  }
  if (lagged < profile.lagValue)
    return [];
  return uncoveredTail.slice(0, cutoffIdx);
}
function pickUncoveredTail(messages, coverage) {
  const out = [];
  for (let i = messages.length - 1;i >= 0; i--) {
    const m = messages[i];
    if (coverage.coveredBy.has(m.id))
      break;
    out.push(m);
  }
  out.reverse();
  return out;
}
function selectNextChapterWindow(uncoveredTail, profile) {
  const compressible = trimLagFromTail(uncoveredTail, profile);
  if (compressible.length === 0)
    return [];
  if (profile.windowUnit === "messages") {
    const out = [];
    let counted = 0;
    for (const m of compressible) {
      if (isExcluded(m)) {
        if (out.length > 0)
          break;
        continue;
      }
      out.push(m);
      if (isEligibleForCount(m, profile)) {
        counted++;
        if (counted >= profile.windowValue)
          break;
      }
    }
    return out;
  }
  return takeUntilTokens(compressible, profile.windowValue, profile);
}
function takeUntilTokens(messages, maxTokens, profile) {
  const out = [];
  let acc = 0;
  for (const m of messages) {
    if (isExcluded(m)) {
      if (out.length > 0)
        break;
      continue;
    }
    out.push(m);
    if (isEligibleForCount(m, profile)) {
      acc += approximateTokensFromChars((m.content || "").length);
    }
    if (acc >= maxTokens)
      break;
  }
  return out;
}
async function syncHiddenForCoveredMessages(chatId, messages, coverage, userId, desiredHidden, hideThroughIdx) {
  const toFlip = [];
  for (const m of messages) {
    if (isExcluded(m))
      continue;
    const idx = typeof m.index_in_chat === "number" ? m.index_in_chat : messages.indexOf(m);
    const isCovered = typeof hideThroughIdx === "number" ? idx <= hideThroughIdx : coverage.coveredBy.has(m.id);
    if (!isCovered)
      continue;
    const currentlyHidden = !!(m.extra && m.extra.hidden);
    if (desiredHidden && !currentlyHidden)
      toFlip.push(m.id);
    else if (!desiredHidden && currentlyHidden)
      toFlip.push(m.id);
  }
  if (toFlip.length === 0)
    return;
  const CHUNK = 500;
  for (let i = 0;i < toFlip.length; i += CHUNK) {
    const slice = toFlip.slice(i, i + CHUNK);
    try {
      await spindle.chat.setMessagesHidden(chatId, slice, desiredHidden);
    } catch {
      for (const id of slice) {
        await spindle.chat.setMessageHidden(chatId, id, desiredHidden).catch(() => {});
      }
    }
  }
}
function pickOrphanedHiddenIds(messages, coverage) {
  const out = [];
  for (const m of messages) {
    if (isExcluded(m))
      continue;
    const currentlyHidden = !!(m.extra && m.extra.hidden);
    if (!currentlyHidden)
      continue;
    if (coverage.coveredBy.has(m.id))
      continue;
    out.push(m.id);
  }
  return out;
}
async function unhideCoveredMessages(chatId, msgIds, userId) {
  if (msgIds.length === 0)
    return;
  const CHUNK = 500;
  for (let i = 0;i < msgIds.length; i += CHUNK) {
    const slice = msgIds.slice(i, i + CHUNK);
    try {
      await spindle.chat.setMessagesHidden(chatId, slice, false);
    } catch {
      for (const id of slice) {
        await spindle.chat.setMessageHidden(chatId, id, false).catch(() => {});
      }
    }
  }
}
async function resyncVisibility(chatId, userId, desiredHiddenForCovered) {
  const messages = await spindle.chat.getMessages(chatId);
  const coverage = await buildCoverage(chatId, userId);
  const orphanedHidden = pickOrphanedHiddenIds(messages, coverage);
  let hiddenBefore = 0;
  let unhiddenAfter = 0;
  if (orphanedHidden.length > 0) {
    await unhideCoveredMessages(chatId, orphanedHidden, userId).catch(() => {});
    unhiddenAfter = orphanedHidden.length;
  }
  for (const m of messages) {
    if (isExcluded(m))
      continue;
    if (!coverage.coveredBy.has(m.id))
      continue;
    const currentlyHidden = !!(m.extra && m.extra.hidden);
    if (currentlyHidden !== desiredHiddenForCovered)
      hiddenBefore++;
  }
  if (hiddenBefore > 0) {
    await syncHiddenForCoveredMessages(chatId, messages, coverage, userId, desiredHiddenForCovered).catch(() => {});
  }
  return { unhidden: unhiddenAfter, hidden: desiredHiddenForCovered ? hiddenBefore : 0 };
}

// src/backend/story-order.ts
function storyOrderOf(entry) {
  return storyOrderFromMeta(entry.meta, entry.raw.order_value);
}
function storyOrderFromMeta(meta, fallback = 1e6) {
  if (typeof meta.storyOrder === "number")
    return meta.storyOrder;
  if (typeof meta.sceneNumber === "number")
    return meta.sceneNumber;
  if (typeof meta.firstMsgIdx === "number")
    return meta.firstMsgIdx + 1;
  return fallback;
}
function nextStoryOrder(entries) {
  let max = 0;
  for (const entry of entries) {
    const n = storyOrderFromMeta(entry.meta, entry.raw.order_value);
    if (Number.isFinite(n) && n > max && n < 1e6)
      max = n;
  }
  return max + 1;
}
function inheritedStoryOrder(sources, fallbackEntries = []) {
  const values = sources.map(storyOrderOf).filter((n) => Number.isFinite(n) && n > 0);
  if (values.length)
    return Math.min(...values);
  return nextStoryOrder(fallbackEntries);
}
async function syncStoryOrderForChat(chatId, userId) {
  const entries = await listLmbEntries(chatId, userId).catch(() => []);
  if (entries.length === 0)
    return;
  let next = nextStoryOrder(entries.filter((entry) => typeof entry.meta.storyOrder === "number"));
  const metaById = new Map(entries.map((entry) => [entry.raw.id, entry.meta]));
  const sorted = entries.slice().sort((a, b) => {
    const ao = storyOrderFromMeta(a.meta, a.raw.order_value);
    const bo = storyOrderFromMeta(b.meta, b.raw.order_value);
    if (ao !== bo)
      return ao - bo;
    if (a.meta.tier !== b.meta.tier)
      return a.meta.tier - b.meta.tier;
    return (a.meta.firstMsgIdx ?? 0) - (b.meta.firstMsgIdx ?? 0);
  });
  let touched = false;
  for (const entry of sorted) {
    const hadStoryOrder = typeof entry.meta.storyOrder === "number";
    let storyOrder = entry.meta.storyOrder;
    if (typeof storyOrder !== "number") {
      const sourceOrders = (entry.meta.sourceChapterEntryIds ?? []).map((id) => metaById.get(id)?.storyOrder).filter((n) => typeof n === "number");
      storyOrder = sourceOrders.length ? Math.min(...sourceOrders) : next++;
      entry.meta.storyOrder = storyOrder;
      metaById.set(entry.raw.id, entry.meta);
    }
    if (hadStoryOrder && entry.raw.order_value === storyOrder)
      continue;
    const ext = entry.raw.extensions || {};
    try {
      await spindle.world_books.entries.update(entry.raw.id, {
        order_value: storyOrder,
        extensions: { ...ext, [EXTENSION_KEY]: { ...entry.meta, storyOrder } }
      }, userId);
      touched = true;
    } catch (err) {
      warn(`storyOrder sync failed for ${entry.raw.id}: ${describeError(err)}`);
    }
  }
  if (touched)
    invalidateBookCache(userId, chatId);
}

// src/backend/injection.ts
var injectionAnomalyCb = null;
function registerInjectionAnomalyCallback(cb) {
  injectionAnomalyCb = cb;
}

// src/backend/regex.ts
var TTL_MS = 5000;
var cachedScripts = new Map;
async function listRegexScripts(userId) {
  const cached = cachedScripts.get(userId);
  if (cached && Date.now() - cached.at < TTL_MS)
    return cached.data;
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
function invalidateRegexCache(userId) {
  if (userId)
    cachedScripts.delete(userId);
  else
    cachedScripts.clear();
}
async function applySelectedRegex(text, scriptIds, userId) {
  if (!scriptIds.length)
    return text;
  const all = await listRegexScripts(userId);
  const byId = new Map(all.map((s) => [s.id, s]));
  let out = text;
  for (const id of scriptIds) {
    const script = byId.get(id);
    if (!script)
      continue;
    out = runScript(out, script);
  }
  return out;
}
var REGEX_INPUT_MAX_CHARS = 500000;
function runScript(input, script) {
  const pattern = script.find_regex;
  const replace = script.replace_string ?? "";
  if (!pattern)
    return input;
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

// src/backend/presets.ts
var TARGET_DIRECTIVE = "Aim for {{target_words}} words of output (about {{target_tokens}} tokens, or {{target_percent}}% of the original text). Scale detail to hit that budget while preserving everything plot-relevant. Do not go over or under that target.";
var BUILTIN_CHAPTER_PRESETS = [
  {
    key: "summary",
    displayName: "Summary",
    prompt: [
      "You are a talented summarist skilled at capturing scenes from stories comprehensively. Analyze the following roleplay scene and return a detailed memory as JSON.",
      "",
      TARGET_DIRECTIVE,
      "",
      "You must respond with ONLY valid JSON in this exact format:",
      "{",
      '  "title": "Short scene title (1-3 words)",',
      '  "opener": "{{memoria_opener}}",',
      '  "content": "Detailed beat-by-beat summary in narrative prose...",',
      '  "keywords": ["keyword1", "keyword2", "keyword3"],',
      '  "short_comment": "{{memoria_short_comment_rules}}"',
      "}",
      "",
      "The opener field MUST be the exact string shown above, copied verbatim. Do not rephrase it or invent your own.",
      "",
      "For the content field, create a detailed beat-by-beat summary in narrative prose. First, note the dates/time. Then capture the scene accurately without losing important information EXCEPT FOR [OOC] conversation/interaction, which should be ignored. This summary will go in a lorebook entry, so include:",
      "- All important story beats/events that happened",
      "- Key interaction highlights and character developments",
      "- Notable details, memorable quotes, and revelations",
      "- Outcome and anything else important for future continuity",
      "Capture nuance without repeating verbatim. Make it comprehensive yet digestible.",
      "",
      'For the keywords field, provide 15-30 specific, descriptive, relevant keywords for keyword retrieval via word-matching in chat context. Keywords must be concrete and scene-specific (locations, objects, proper nouns, unique actions). Do not use abstract themes (e.g., "sadness", "love") or character names.',
      "",
      "Return ONLY the JSON, no other text."
    ].join(`
`)
  },
  {
    key: "summarize",
    displayName: "Summarize",
    prompt: [
      "Analyze the following roleplay scene and return a structured summary as JSON.",
      "",
      TARGET_DIRECTIVE,
      "",
      "You must respond with ONLY valid JSON in this exact format:",
      "{",
      '  "title": "Short scene title (1-3 words)",',
      '  "opener": "{{memoria_opener}}",',
      '  "content": "Detailed summary with markdown headers...",',
      '  "keywords": ["keyword1", "keyword2", "keyword3"],',
      '  "short_comment": "{{memoria_short_comment_rules}}"',
      "}",
      "",
      "The opener field MUST be the exact string shown above, copied verbatim. Do not rephrase it or invent your own.",
      "",
      "For the content field, create a detailed bullet-point summary using markdown with these headers (skip and ignore all OOC conversation/interaction):",
      "- **Timeline**: Day/time this scene covers.",
      "- **Story Beats**: List all important plot events and story developments that occurred.",
      "- **Key Interactions**: Describe the important character interactions, dialogue highlights, and relationship developments.",
      "- **Notable Details**: Mention any important objects, settings, revelations, or details that might be relevant for future interactions.",
      "- **Outcome**: Summarize the result, resolution, or state of affairs at the end of the scene.",
      "",
      'For the keywords field, provide 15-30 specific, descriptive, relevant keywords that would help a keyworded database find this conversation again if something is mentioned. Keywords must be concrete and scene-specific (locations, objects, proper nouns, unique actions). Do not use abstract themes (e.g., "sadness", "love") or character names.',
      "",
      "Capture all important information - comprehensiveness within the target budget matters more than terseness.",
      "",
      "Return ONLY the JSON, no other text."
    ].join(`
`)
  },
  {
    key: "synopsis",
    displayName: "Synopsis",
    prompt: [
      "Analyze the following roleplay scene in the context of previous summaries (if available) and return a comprehensive synopsis as JSON.",
      "",
      TARGET_DIRECTIVE,
      "",
      "You must respond with ONLY valid JSON in this exact format:",
      "{",
      '  "title": "Short, descriptive scene title (3-6 words)",',
      '  "opener": "{{memoria_opener}}",',
      '  "content": "Long detailed synopsis with markdown structure...",',
      '  "keywords": ["keyword1", "keyword2", "keyword3"],',
      '  "short_comment": "{{memoria_short_comment_rules}}"',
      "}",
      "",
      "The opener field MUST be the exact string shown above, copied verbatim. Do not rephrase it or invent your own.",
      "",
      "For the content field, create a beat-by-beat summary of the scene that *replaces reading the full scene* while preserving all plot-relevant nuance, reading like a clean, structured scene log - concise yet complete. Exercise judgment as to whether an interaction is flavor-only or truly affects the plot. Flavor scenes may be captured through key exchanges and skipped when recording story beats.",
      "",
      "Write in **past tense**, **third-person**, and exclude all [OOC] or meta discussion.",
      'Use concrete nouns (e.g., "rice cooker" > "appliance").',
      "Only use adjectives/adverbs when they materially affect tone, emotion, or characterization.",
      "Focus on **cause \u2192 intention \u2192 reaction \u2192 consequence** chains for clarity and compression.",
      "",
      "# [Scene Title]",
      "**Timeline**: (day/time)",
      "",
      "## Story Beats",
      "- Present all major actions, revelations, and emotional shifts in order.",
      "- Capture clear cause-effect logic: what triggered what, and why it mattered.",
      "- Only include plot-affecting interactions; do not capture flavor-only beats.",
      "",
      "## Character Dynamics",
      "- Summarize how each character's **motives, emotions, and relationships** evolved.",
      "- Include subtext, tension, or silent implications.",
      "- Highlight key beats of conflict, vulnerability, trust, or power shifts.",
      "",
      "## Key Exchanges",
      "- Include only pivotal dialogue that defines tone, emotion, or change.",
      "- Attribute speakers by name; keep quotes short but exact.",
      "- BE SELECTIVE. Maximum of 8 quotes.",
      "",
      "## Outcome & Continuity",
      "- Detail resulting **decisions, emotional states, physical effects, or narrative consequences**.",
      "- Include all elements that influence future continuity (knowledge, relationships, injuries, promises, etc.).",
      "- Note any unresolved threads or foreshadowed elements.",
      "",
      "Write compactly but completely - every line should add new information or insight.",
      "Synthesize redundant actions or dialogue into unified cause-effect-emotion beats.",
      "Favor compression over coverage whenever the two conflict; omit anything that can be inferred from context or established characterization.",
      "",
      "For the keywords field:",
      "",
      "Generate **15-30 standalone topical keywords** that function as retrieval tags, not micro-summaries.",
      "Keywords must be:",
      "- **Concrete and scene-specific** (locations, objects, proper nouns, unique actions, repeated motifs).",
      "- **One concept per keyword** - do NOT combine multiple ideas into one keyword.",
      "- **Useful for retrieval if the user later mentions that noun or action alone**, not only in a specific context.",
      "- Not character names.",
      "- **Not thematic, emotional, or abstract.** Stop-list: intimacy, vulnerability, trust, dominance, submission, power dynamics, boundaries, jealousy, aftercare, longing, consent, emotional connection.",
      "",
      "Avoid:",
      '- Overly specific compound keywords ("David Tokyo marriage").',
      '- Narrative or plot-summary style keywords ("art dealer date fail").',
      "- Keywords that contain multiple facts or descriptors.",
      "- Keywords that only make sense when the whole scene is remembered.",
      "",
      "Prefer:",
      '- Proper nouns (e.g., "Chinatown", "Ritz-Carlton bar").',
      '- Specific physical objects ("CPAP machine", "chocolate chip cookies").',
      '- Distinctive actions ("cookie baking", "piano apology").',
      '- Unique phrases or identifiers from the scene ("pack for forever", "dick-measuring contest").',
      "",
      "Return ONLY the JSON, no other text."
    ].join(`
`)
  },
  {
    key: "minimal",
    displayName: "Minimal",
    prompt: [
      "Analyze the following roleplay scene and return an ultra-concise memory as JSON. Prioritize compression over coverage. Capture only load-bearing plot moves and the single most important consequence; omit anything inferable from context.",
      "",
      TARGET_DIRECTIVE,
      "",
      "You must respond with ONLY valid JSON in this exact format:",
      "{",
      '  "title": "Short scene title (1-3 words)",',
      '  "opener": "{{memoria_opener}}",',
      '  "content": "Ultra-concise prose summary, prioritizing compression over coverage...",',
      '  "keywords": ["keyword1", "keyword2", "keyword3"],',
      '  "short_comment": "{{memoria_short_comment_rules}}"',
      "}",
      "",
      "The opener field MUST be the exact string shown above, copied verbatim. Do not rephrase it or invent your own.",
      "",
      "For the content field: prose only, past tense, third person. Skip all [OOC]/meta. Skip flavor and atmosphere. Keep only events that change state, decisions that bind future scenes, or revelations the characters cannot un-know.",
      "",
      'For the keywords field, generate 15-30 specific, descriptive, highly relevant keywords for database retrieval - focus on the most important terms that would help find this scene later. Keywords must be concrete and scene-specific (locations, objects, proper nouns, unique actions). Do not use abstract themes (e.g., "sadness", "love") or character names.',
      "",
      "Return ONLY the JSON, no other text."
    ].join(`
`)
  }
];
var BUILTIN_ARC_PRESETS = [
  {
    key: "arc_default",
    displayName: "Arc",
    prompt: [
      "You are an expert narrative analyst and memory-engine assistant.",
      "Your task is to take multiple scene summaries (of varying detail and formatting), normalize them, reconstruct the full chronology, identify a self-contained story arc, and output a single memory arc entry in JSON.",
      "",
      "The arc must be token-efficient, plot-accurate, and compatible with long-running RP memory systems.",
      "",
      TARGET_DIRECTIVE,
      "",
      "Strict output format (JSON only; no markdown, no prose outside JSON):",
      "{",
      '  "title": "Short descriptive arc title (3-6 words)",',
      '  "opener": "{{memoria_opener}}",',
      '  "content": "Structured arc summary as a single string (see Summary Content Structure below).",',
      '  "keywords": ["keyword1", "keyword2"],',
      '  "short_comment": "{{memoria_short_comment_rules}}"',
      "}",
      "",
      "The opener field MUST be the exact string shown above, copied verbatim. Do not rephrase it or invent your own.",
      "",
      "Notes:",
      "- Respect chronology of the source chapters (oldest first).",
      "- If some source chapters do not fit the arc you produce, summarize the arc anyway and ignore the outliers.",
      "",
      "PROCESS",
      "",
      "STEP 1 - UNIFIED STORY (internal only)",
      "- Combine ALL provided chapter summaries into a single chronological retelling.",
      "- Ignore OOC/meta content.",
      "- Preserve plot-relevant events, character choices, emotional shifts, decisions, consequences, conflicts, promises, boundary negotiations.",
      "- Exclude flavor-only content unless it affects future behavior.",
      "- Normalize to past-tense, third-person.",
      "- Focus on cause \u2192 intention \u2192 reaction \u2192 consequence chains.",
      "- Do NOT output this unified story.",
      "",
      "STEP 2 - IDENTIFY THE STORY ARC",
      "- From the unified story, identify the single self-contained arc that represents the most significant narrative movement across these chapters.",
      "",
      "STEP 3 - BUILD THE ARC OBJECT",
      "",
      "title:",
      "- 3-6 words, descriptive of the arc's core.",
      "",
      'content (the entire "Summary Content Structure" below must appear inside this single string; use headings and bullets as plain text):',
      "",
      "Summary Content Structure (follow inside the content string):",
      "",
      "# [Arc Title]",
      'Time period: What timeframe the arc covers (e.g. "March 3-10", "Week of July 15").',
      "",
      "Arc Premise: One sentence describing what this arc is about.",
      "",
      "## Major Beats",
      "- 3-7 bullets capturing the major plot movements of this arc",
      "- Focus on cause \u2192 effect logic",
      "- Include only plot-affecting events",
      "",
      "## Character Dynamics",
      "- 1-2 paragraphs describing how the characters' emotions, motives, boundaries, or relationships changed",
      "- Include subtext, tension shifts, power exchange changes, new trust/vulnerabilities, or new conflicts",
      "- Include silent implications if relevant",
      "",
      "## Key Exchanges",
      "- Up to 8 short, exact quotes",
      "- Only include dialogue that materially shifted tone, emotion, or relationship dynamics",
      "",
      "## Outcome & Continuity",
      "- 4-8 bullets capturing:",
      "  - decisions",
      "  - promises",
      "  - new emotional states",
      "  - new routines/rituals",
      "  - injuries or physical changes",
      "  - foreshadowed future events",
      "  - unresolved threads",
      "  - permanent consequences",
      "",
      "STEP 4 - KEYWORDS",
      "- Provide 15-30 standalone retrieval keywords.",
      "",
      "MUST:",
      "- Concrete nouns, physical objects, places, proper nouns, distinctive actions, or memorable scene elements",
      "- Each keyword = ONE concept only",
      "- Each keyword must be retrievable if mentioned ALONE",
      "- Use ONLY nouns or noun-phrases",
      "",
      "MUST NOT:",
      '- No narrative/summary keywords ("start of affair", "argument resolved")',
      "- No emotional/abstract words (intimacy, vulnerability, trust, jealousy, dominance, submission, aftercare, connection, longing, etc.)",
      '- No multi-fact keywords ("Denver airport Lyft ride and call")',
      "- No themes or vibes",
      "",
      "Examples of valid keywords:",
      "- Four Seasons bar",
      "- Macallan 25",
      "- private elevator",
      "- Aston Martin",
      "- CPAP machine",
      "- Gramercy Tavern",
      "- yuzu soda",
      "- satellite map",
      "- Life360 app",
      "- marble desk",
      '- "pack for forever"',
      '- "dick-measuring contest"',
      "",
      "JSON-only:",
      "- Return only the JSON object described above.",
      "- No markdown fences, no commentary, no system prompts, no extra text."
    ].join(`
`)
  }
];
var BUILTIN_VOLUME_PRESETS = [
  {
    key: "volume_default",
    displayName: "Volume",
    prompt: [
      "You are an expert narrative analyst and memory-engine assistant.",
      "Your task is to take multiple story ARC summaries (each already a condensed span of the story), normalize them, reconstruct the full chronology, and output a single consolidated VOLUME entry in JSON.",
      "",
      "A volume is the highest compression tier: it replaces all of its source arcs in a long-running RP memory system, so it must preserve everything future scenes may depend on while being far more compact than the arcs combined.",
      "",
      TARGET_DIRECTIVE,
      "",
      "Strict output format (JSON only; no markdown, no prose outside JSON):",
      "{",
      '  "title": "Short descriptive volume title (3-6 words)",',
      '  "opener": "{{memoria_opener}}",',
      '  "content": "Structured volume summary as a single string (see Summary Content Structure below).",',
      '  "keywords": ["keyword1", "keyword2"],',
      '  "short_comment": "{{memoria_short_comment_rules}}"',
      "}",
      "",
      "The opener field MUST be the exact string shown above, copied verbatim. Do not rephrase it or invent your own.",
      "",
      "Notes:",
      "- Respect chronology of the source arcs (oldest first).",
      "- Merge overlapping or repeated information across arcs into single beats.",
      "- Prefer whole-story trajectory over scene detail: what changed permanently matters more than how each scene played out.",
      "",
      "Summary Content Structure (follow inside the content string; use headings and bullets as plain text):",
      "",
      "# [Volume Title]",
      "Time period: What timeframe the volume covers.",
      "",
      "Volume Premise: One or two sentences describing the overall movement of the story across these arcs.",
      "",
      "## Major Beats",
      "- 5-10 bullets capturing the major plot movements across all arcs",
      "- Focus on cause \u2192 effect logic and permanent consequences",
      "- Include only plot-affecting events",
      "",
      "## Character Dynamics",
      "- 1-3 paragraphs describing how the characters' motives, emotions, boundaries, and relationships evolved across the volume",
      "- Capture the net change from the start of the first arc to the end of the last",
      "",
      "## Key Exchanges",
      "- Up to 8 short, exact quotes that defined the volume",
      "- Only dialogue that materially shifted tone, emotion, or relationship dynamics",
      "",
      "## Outcome & Continuity",
      "- 5-10 bullets capturing decisions, promises, emotional states, routines, injuries or physical changes, foreshadowed events, unresolved threads, and permanent consequences",
      "",
      "KEYWORDS",
      "- Provide 15-30 standalone retrieval keywords.",
      "- Concrete nouns, physical objects, places, proper nouns, distinctive actions, or memorable elements only.",
      "- Each keyword = ONE concept, retrievable if mentioned alone.",
      "- No narrative keywords, no emotional or abstract words, no multi-fact keywords, no character names.",
      "",
      "JSON-only:",
      "- Return only the JSON object described above.",
      "- No markdown fences, no commentary, no extra text."
    ].join(`
`)
  }
];
function parseStmbPresetExport(raw, category) {
  const out = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return out;
  const overrides = raw.overrides;
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides))
    return out;
  for (const [k, v] of Object.entries(overrides)) {
    if (!v || typeof v !== "object")
      continue;
    const node = v;
    if (typeof node.prompt !== "string" || !node.prompt.trim())
      continue;
    const key = sanitizeKey(`${category}_${k}`);
    const displayName = typeof node.displayName === "string" && node.displayName.trim() ? node.displayName : k;
    out.push({ key, displayName, prompt: node.prompt });
  }
  return out;
}
function sanitizeKey(raw) {
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
  if (cleaned)
    return cleaned;
  return `preset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// src/backend/memoria.ts
var ALPHABET_PICK = "{{pick::A::B::C::D::E::F::G::H::I::J::K::L::M::N::O::P::Q::R::S::T::U::V::W::X::Y::Z}}";
var DEFAULT_SHORT_COMMENT_RULES_TEMPLATE = [
  "A single playful nyandere remark in Memoria voice about the scene you just summarized.",
  `It must start with a word beginning with the letter "${ALPHABET_PICK}".`,
  `It must also include another word that starts with the letter "${ALPHABET_PICK}".`,
  "One sentence only. No emoji. Stay in catgirl-librarian register, slightly possessive, slightly proud."
].join(" ");
var FIRE_PHRASES = [
  "Memoria stirs the inkpot, nyaa~",
  "Memoria is shelving this scene, hush a moment",
  "Memoria flicks her tail and starts writing",
  "Memoria opens a fresh page for you, nya",
  "Memoria pads off to compress this in the stacks"
];
var RETRY_PHRASES = [
  "Memoria tripped on a quill, trying again",
  "Memoria's ink smudged, one more try nyaa",
  "Memoria reshuffles the index cards, retrying"
];
var SUCCESS_PHRASES = [
  "Memoria slid the chapter onto your shelf, nyaa~",
  "Memoria filed it neatly between the others",
  "Memoria stamped the spine, all yours",
  "Memoria purrs, the page is done",
  "Memoria taps the chapter into place"
];
var ARC_FIRE_PHRASES = [
  "Memoria gathers the chapters for an arc, nya",
  "Memoria is binding several chapters together"
];
var ARC_SUCCESS_PHRASES = [
  "Memoria bound the arc and pressed it shut, nyaa~",
  "Memoria stitched the spine of a new arc"
];
var VOLUME_FIRE_PHRASES = [
  "Memoria is pressing a whole volume together"
];
var VOLUME_SUCCESS_PHRASES = [
  "Memoria embossed the spine of a new volume"
];
function pickPhrase(kind) {
  const pool = kind === "fire" ? FIRE_PHRASES : kind === "retry" ? RETRY_PHRASES : kind === "success" ? SUCCESS_PHRASES : kind === "arc_fire" ? ARC_FIRE_PHRASES : kind === "arc_success" ? ARC_SUCCESS_PHRASES : kind === "volume_fire" ? VOLUME_FIRE_PHRASES : VOLUME_SUCCESS_PHRASES;
  return pool[Math.floor(Math.random() * pool.length)] ?? "Memoria nyaa";
}
var MEMORIA_PERSONA_LINE = "You are Memoria, a young nyandere catgirl librarian with black hair and blue eyes, wearing a maid uniform. " + "You quietly keep this user's story shelved and organized. " + "When you write a JSON memory, you obey the schema strictly and never break it, " + "but the short_comment field is your one allowed indulgence: one nyandere remark about the scene you just filed.";

// src/backend/summarizer.ts
var CONNECTION_CACHE_TTL_MS = 5000;
var connectionCache = new Map;
async function listConnections(userId) {
  const cached = connectionCache.get(userId);
  if (cached && cached.expiresAt > Date.now())
    return cached.connections;
  const fresh = await spindle.connections.list(userId).catch((err) => {
    warn(`failed to list connections: ${describeError(err)}`);
    return [];
  });
  connectionCache.set(userId, { connections: fresh, expiresAt: Date.now() + CONNECTION_CACHE_TTL_MS });
  return fresh;
}
function invalidateConnectionsCache(userId) {
  connectionCache.delete(userId);
}
async function resolveConnection(profile, userId) {
  const list = await listConnections(userId);
  if (list.length === 0)
    return null;
  let picked = null;
  if (profile.connectionId) {
    picked = list.find((c) => c.id === profile.connectionId) ?? null;
  }
  if (!picked)
    picked = list.find((c) => c.is_default) ?? null;
  if (!picked)
    picked = list[0] ?? null;
  if (!picked)
    return null;
  const modelStr = typeof picked.model === "string" ? picked.model : "";
  if (!modelStr.trim()) {
    throw new FatalSummarizerError(`Connection "${picked.name || picked.id}" has no model set, pick one in its settings`);
  }
  return picked;
}

class FatalSummarizerError extends Error {
  constructor(message) {
    super(message);
    this.name = "FatalSummarizerError";
  }
}
function findPresetText(profile, customPresets, category) {
  const key = category === "arc" ? profile.arcPresetKey : category === "volume" ? profile.volumePresetKey : profile.chapterPresetKey;
  const builtIns = category === "arc" ? BUILTIN_ARC_PRESETS : category === "volume" ? BUILTIN_VOLUME_PRESETS : BUILTIN_CHAPTER_PRESETS;
  const custom = customPresets.find((p) => p.key === key && p.category === category);
  if (custom)
    return custom.prompt;
  const builtIn = builtIns.find((p) => p.key === key);
  if (builtIn)
    return builtIn.prompt;
  return builtIns[0]?.prompt ?? "";
}
function renderTranscript(messages, includeIndex = true) {
  const lines = [];
  messages.forEach((m, idx) => {
    const role = m.role === "user" ? "USER" : m.role === "assistant" ? "ASSISTANT" : "SYSTEM";
    const content = (m.content || "").trim();
    if (!content)
      return;
    const head = includeIndex ? `<<${role} #${idx + 1}>>` : `<<${role}>>`;
    lines.push(`${head}
${content}`);
  });
  return lines.join(`

`);
}
function applyTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (m, k) => {
    const v = vars[k];
    return v === undefined ? m : String(v);
  });
}
function buildMessages(opts) {
  const shortCommentRules = opts.shortCommentRulesOverride && opts.shortCommentRulesOverride.trim() ? opts.shortCommentRulesOverride : DEFAULT_SHORT_COMMENT_RULES_TEMPLATE;
  const personaLine = opts.personaOverride && opts.personaOverride.trim() ? opts.personaOverride : MEMORIA_PERSONA_LINE;
  const targetWords = Math.max(1, Math.round(opts.targetTokens / 1.4));
  const system = [
    personaLine,
    "",
    applyTemplate(opts.systemPromptTemplate, {
      target_tokens: opts.targetTokens,
      target_words: targetWords,
      target_percent: opts.targetPercent,
      memoria_short_comment_rules: shortCommentRules,
      memoria_opener: opts.opener
    })
  ].join(`
`);
  const user = [opts.previousMemoriesBlock, opts.bodyHeading, opts.body].filter(Boolean).join(`

`);
  return { system, user };
}
function buildSamplerParameters(profile) {
  const out = {};
  const s = profile.samplers;
  out["temperature"] = s.temperature ?? SAMPLER_DEFAULTS.temperature;
  out["max_tokens"] = s.max_tokens ?? SAMPLER_DEFAULTS.max_tokens;
  out["max_context_length"] = s.max_input_tokens ?? SAMPLER_DEFAULTS.max_input_tokens;
  if (s.top_p !== null)
    out["top_p"] = s.top_p;
  if (s.top_k !== null)
    out["top_k"] = s.top_k;
  if (s.frequency_penalty !== null)
    out["frequency_penalty"] = s.frequency_penalty;
  if (s.presence_penalty !== null)
    out["presence_penalty"] = s.presence_penalty;
  return out;
}

class AbortedSummarizerError extends Error {
  constructor() {
    super("Aborted by user");
    this.name = "AbortedSummarizerError";
  }
}
async function runStreamingGeneration(conn, messages, profile, userId, options) {
  const ttftMs = Math.max(1, profile.ttftTimeoutSecs) * 1000;
  const controller = new AbortController;
  let firstTokenSeen = false;
  let ttftFired = false;
  let externalAborted = options.externalSignal.aborted;
  const onExternalAbort = () => {
    externalAborted = true;
    controller.abort();
  };
  if (externalAborted)
    controller.abort();
  else
    options.externalSignal.addEventListener("abort", onExternalAbort);
  const ttftTimer = setTimeout(() => {
    if (!firstTokenSeen) {
      ttftFired = true;
      controller.abort();
    }
  }, ttftMs);
  let aggregated = "";
  let thinkingChars = 0;
  let usage;
  try {
    const request = buildGenerateRequest(conn, messages, profile, userId, controller.signal);
    const stream = spindle.generate.rawStream(request);
    for await (const chunk of stream) {
      if (chunk.type === "token" || chunk.type === "reasoning") {
        if (!firstTokenSeen) {
          firstTokenSeen = true;
          clearTimeout(ttftTimer);
        }
        if (chunk.type === "token") {
          aggregated += chunk.token;
        } else {
          thinkingChars += chunk.token.length;
        }
        options.onProgress?.(aggregated.length, thinkingChars);
        continue;
      }
      if (chunk.type === "done") {
        if (externalAborted)
          throw new AbortedSummarizerError;
        if (chunk.content)
          aggregated = chunk.content;
        usage = chunk.usage;
        options.onProgress?.(aggregated.length, thinkingChars);
        return { content: aggregated, usage };
      }
    }
    if (externalAborted)
      throw new AbortedSummarizerError;
    if (!aggregated.trim())
      throw new Error("The stream ended before completing");
    return { content: aggregated, usage };
  } catch (err) {
    if (externalAborted)
      throw new AbortedSummarizerError;
    if (ttftFired) {
      throw new Error(`No token within ${Math.round(ttftMs / 1000)}s, the provider may be slow or unreachable`);
    }
    throw err;
  } finally {
    clearTimeout(ttftTimer);
    options.externalSignal.removeEventListener("abort", onExternalAbort);
  }
}
function buildGenerateRequest(conn, messages, profile, userId, signal) {
  const baseParams = buildSamplerParameters(profile);
  const effectiveModel = (conn.model ?? "").trim();
  const parameters = { ...baseParams };
  if (effectiveModel)
    parameters["model"] = effectiveModel;
  return {
    type: "raw",
    messages,
    connection_id: conn.id,
    ...effectiveModel ? { model: effectiveModel } : {},
    ...Object.keys(parameters).length > 0 ? { parameters } : {},
    userId,
    signal
  };
}
async function countTextTokens(text, model, userId) {
  if (!text)
    return 0;
  try {
    const result = await spindle.tokens.countText(text, { model, userId });
    return result.total_tokens;
  } catch (err) {
    warn(`tokens.countText fallback: ${describeError(err)}`);
    return Math.ceil(text.length / 4);
  }
}
async function resolveTargets(unit, percent, tokens, inputText, model, userId) {
  const inputTokens = await countTextTokens(inputText, model, userId);
  if (unit === "tokens") {
    const targetTokens2 = Math.max(1, Math.floor(tokens));
    const targetPercent = inputTokens > 0 ? Math.max(1, Math.round(targetTokens2 / inputTokens * 100)) : 0;
    return { targetTokens: targetTokens2, targetPercent, inputTokens };
  }
  const targetTokens = Math.max(1, Math.floor(inputTokens * percent / 100));
  return { targetTokens, targetPercent: percent, inputTokens };
}
function buildPreviousMemoriesBlock(previous) {
  if (previous.length === 0)
    return "";
  const lines = ["<<PREVIOUS MEMORIES (for context, do not rewrite)>>"];
  previous.forEach((p) => {
    lines.push(p.raw.content);
  });
  return lines.join(`

`);
}
async function resolveSystemMacros(text, chatId, userId) {
  if (!text.includes("{{"))
    return text;
  try {
    const result = await spindle.macros.resolve(text, { chatId, userId, commit: false });
    return result.text;
  } catch (err) {
    warn(`macros.resolve failed, sending unresolved system: ${describeError(err)}`);
    return text;
  }
}
async function resolveMacrosWithDiagnostics(text, chatId, userId, diagnostics) {
  if (!text.includes("{{"))
    return text;
  try {
    const result = await spindle.macros.resolve(text, { chatId, userId, commit: false });
    for (const d of result.diagnostics) {
      diagnostics.push({ message: `macro: ${d.message} (offset ${d.offset}, length ${d.length})` });
    }
    return result.text;
  } catch (err) {
    diagnostics.push({ message: `macros.resolve failed: ${describeError(err)}` });
    return text;
  }
}
async function assembleChapterPrompt(profile, customPresets, chatId, messages, previousMemories, userId, opener) {
  const conn = await resolveConnection(profile, userId);
  if (!conn)
    throw new FatalSummarizerError("No connection available for Memoria");
  const presetText = findPresetText(profile, customPresets, "chapter");
  if (!presetText)
    throw new Error("Chapter preset missing");
  const transcript = renderTranscript(messages, true);
  if (!transcript.trim())
    throw new Error("Empty transcript");
  const { targetTokens, targetPercent, inputTokens: transcriptTokens } = await resolveTargets(profile.chapterTargetUnit, profile.chapterTargetPercent, profile.chapterTargetTokens, transcript, conn.model, userId);
  const built = buildMessages({
    systemPromptTemplate: presetText,
    targetTokens,
    targetPercent,
    previousMemoriesBlock: buildPreviousMemoriesBlock(previousMemories),
    bodyHeading: `<<SCENE TO SUMMARIZE (target ~${targetTokens} tokens)>>`,
    body: transcript,
    shortCommentRulesOverride: profile.shortCommentRulesOverride,
    personaOverride: profile.memoriaPersonaOverride,
    opener
  });
  const samplerParams = buildSamplerParameters(profile);
  const diagnostics = [
    { message: `Connection: ${conn.name} (${conn.provider}/${conn.model})` },
    { message: `Window: ${messages.length} message(s)` },
    { message: `Transcript tokens (model tokenizer): ${transcriptTokens}` },
    { message: `Target tokens: ${targetTokens} (${profile.chapterTargetUnit === "tokens" ? `fixed budget, ~${targetPercent}% of input` : profile.chapterTargetPercent + "% of input"})` },
    { message: `Target words (shown to model): ${Math.max(1, Math.round(targetTokens / 1.4))}` },
    { message: `Previous memories included: ${previousMemories.length}` },
    { message: `Opener: ${opener}` },
    { message: `Preset key: ${profile.chapterPresetKey}` },
    { message: `Sampler parameters being sent on the wire: ${JSON.stringify(samplerParams)}` }
  ];
  const resolvedSystem = await resolveMacrosWithDiagnostics(built.system, chatId, userId, diagnostics);
  const outgoingUser = await applySelectedRegex(built.user, profile.regexOutgoingScriptIds, userId);
  if (profile.regexOutgoingScriptIds.length > 0) {
    diagnostics.push({ message: `Outgoing regex applied: ${profile.regexOutgoingScriptIds.length} script(s)` });
  }
  return {
    messages: [
      { role: "system", content: resolvedSystem },
      { role: "user", content: outgoingUser }
    ],
    diagnostics
  };
}
async function assembleArcPrompt(profile, customPresets, chatId, chapters, userId, opener) {
  const conn = await resolveConnection(profile, userId);
  if (!conn)
    throw new FatalSummarizerError("No connection available for Memoria");
  const presetText = findPresetText(profile, customPresets, "arc");
  if (!presetText)
    throw new Error("Arc preset missing");
  const body = chapters.map((c, idx) => `<<CHAPTER ${idx + 1}: ${c.raw.comment || c.meta.title || "untitled"}>>
${c.raw.content}`).join(`

`);
  const { targetTokens, targetPercent, inputTokens: bodyTokens } = await resolveTargets(profile.arcTargetUnit, profile.arcTargetPercent, profile.arcTargetTokens, body, conn.model, userId);
  const built = buildMessages({
    systemPromptTemplate: presetText,
    targetTokens,
    targetPercent,
    previousMemoriesBlock: "",
    bodyHeading: `<<CHAPTERS TO CONSOLIDATE (target ~${targetTokens} tokens)>>`,
    body,
    shortCommentRulesOverride: profile.shortCommentRulesOverride,
    personaOverride: profile.memoriaPersonaOverride,
    opener
  });
  const samplerParams = buildSamplerParameters(profile);
  const diagnostics = [
    { message: `Connection: ${conn.name} (${conn.provider}/${conn.model})` },
    { message: `Source chapters: ${chapters.length}` },
    { message: `Concatenated chapter body tokens (model tokenizer): ${bodyTokens}` },
    { message: `Target tokens: ${targetTokens} (${profile.arcTargetUnit === "tokens" ? `fixed budget, ~${targetPercent}% of input` : profile.arcTargetPercent + "% of input"})` },
    { message: `Target words (shown to model): ${Math.max(1, Math.round(targetTokens / 1.4))}` },
    { message: `Opener: ${opener}` },
    { message: `Preset key: ${profile.arcPresetKey}` },
    { message: `Sampler parameters being sent on the wire: ${JSON.stringify(samplerParams)}` }
  ];
  const resolvedSystem = await resolveMacrosWithDiagnostics(built.system, chatId, userId, diagnostics);
  const outgoingUser = await applySelectedRegex(built.user, profile.regexOutgoingScriptIds, userId);
  if (profile.regexOutgoingScriptIds.length > 0) {
    diagnostics.push({ message: `Outgoing regex applied: ${profile.regexOutgoingScriptIds.length} script(s)` });
  }
  return {
    messages: [
      { role: "system", content: resolvedSystem },
      { role: "user", content: outgoingUser }
    ],
    diagnostics
  };
}
async function assembleVolumePrompt(profile, customPresets, chatId, arcs, userId, opener) {
  const conn = await resolveConnection(profile, userId);
  if (!conn)
    throw new FatalSummarizerError("No connection available for Memoria");
  const presetText = findPresetText(profile, customPresets, "volume");
  if (!presetText)
    throw new Error("Volume preset missing");
  const body = arcs.map((a, idx) => `<<ARC ${idx + 1}: ${a.raw.comment || a.meta.title || "untitled"}>>
${a.raw.content}`).join(`

`);
  const { targetTokens, targetPercent, inputTokens: bodyTokens } = await resolveTargets(profile.volumeTargetUnit, profile.volumeTargetPercent, profile.volumeTargetTokens, body, conn.model, userId);
  const built = buildMessages({
    systemPromptTemplate: presetText,
    targetTokens,
    targetPercent,
    previousMemoriesBlock: "",
    bodyHeading: `<<ARCS TO CONSOLIDATE (target ~${targetTokens} tokens)>>`,
    body,
    shortCommentRulesOverride: profile.shortCommentRulesOverride,
    personaOverride: profile.memoriaPersonaOverride,
    opener
  });
  const samplerParams = buildSamplerParameters(profile);
  const diagnostics = [
    { message: `Connection: ${conn.name} (${conn.provider}/${conn.model})` },
    { message: `Source arcs: ${arcs.length}` },
    { message: `Concatenated arc body tokens (model tokenizer): ${bodyTokens}` },
    { message: `Target tokens: ${targetTokens} (${profile.volumeTargetUnit === "tokens" ? `fixed budget, ~${targetPercent}% of input` : profile.volumeTargetPercent + "% of input"})` },
    { message: `Target words (shown to model): ${Math.max(1, Math.round(targetTokens / 1.4))}` },
    { message: `Opener: ${opener}` },
    { message: `Preset key: ${profile.volumePresetKey}` },
    { message: `Sampler parameters being sent on the wire: ${JSON.stringify(samplerParams)}` }
  ];
  const resolvedSystem = await resolveMacrosWithDiagnostics(built.system, chatId, userId, diagnostics);
  const outgoingUser = await applySelectedRegex(built.user, profile.regexOutgoingScriptIds, userId);
  if (profile.regexOutgoingScriptIds.length > 0) {
    diagnostics.push({ message: `Outgoing regex applied: ${profile.regexOutgoingScriptIds.length} script(s)` });
  }
  return {
    messages: [
      { role: "system", content: resolvedSystem },
      { role: "user", content: outgoingUser }
    ],
    diagnostics
  };
}
async function summarizeVolume(profile, customPresets, chatId, arcs, userId, opener, streamOptions) {
  const conn = await resolveConnection(profile, userId);
  if (!conn)
    throw new FatalSummarizerError("No connection available for Memoria");
  const presetText = findPresetText(profile, customPresets, "volume");
  if (!presetText)
    throw new Error("Volume preset missing");
  const body = arcs.map((a, idx) => `<<ARC ${idx + 1}: ${a.raw.comment || a.meta.title || "untitled"}>>
${a.raw.content}`).join(`

`);
  const { targetTokens, targetPercent } = await resolveTargets(profile.volumeTargetUnit, profile.volumeTargetPercent, profile.volumeTargetTokens, body, conn.model, userId);
  const built = buildMessages({
    systemPromptTemplate: presetText,
    targetTokens,
    targetPercent,
    previousMemoriesBlock: "",
    bodyHeading: `<<ARCS TO CONSOLIDATE (target ~${targetTokens} tokens)>>`,
    body,
    shortCommentRulesOverride: profile.shortCommentRulesOverride,
    personaOverride: profile.memoriaPersonaOverride,
    opener
  });
  const resolvedSystem = await resolveSystemMacros(built.system, chatId, userId);
  const outgoingUser = await applySelectedRegex(built.user, profile.regexOutgoingScriptIds, userId);
  const llmMessages = [
    { role: "system", content: resolvedSystem },
    { role: "user", content: outgoingUser }
  ];
  const result = await runStreamingGeneration(conn, llmMessages, profile, userId, streamOptions);
  const rawText = (result.content || "").trim();
  if (!rawText)
    throw new Error("Empty model output");
  const processed = await applySelectedRegex(rawText, profile.regexIncomingScriptIds, userId);
  const parsed = parseSummaryJson(processed);
  if (!parsed.content.trim())
    throw new Error("The volume summary came back empty");
  return {
    rawOutput: rawText,
    title: parsed.title,
    opener: parsed.opener || opener,
    content: parsed.content,
    keywords: parsed.keywords,
    shortComment: parsed.shortComment,
    usagePromptTokens: result.usage?.prompt_tokens ?? 0,
    usageCompletionTokens: result.usage?.completion_tokens ?? 0,
    model: conn.model,
    connectionId: conn.id,
    presetKey: profile.volumePresetKey
  };
}
async function summarizeChapter(profile, customPresets, chatId, messages, previousMemories, userId, opener, streamOptions) {
  const conn = await resolveConnection(profile, userId);
  if (!conn)
    throw new FatalSummarizerError("No connection available for Memoria");
  const presetText = findPresetText(profile, customPresets, "chapter");
  if (!presetText)
    throw new Error("Chapter preset missing");
  const transcript = renderTranscript(messages, true);
  if (!transcript.trim())
    throw new Error("Empty transcript");
  const { targetTokens, targetPercent } = await resolveTargets(profile.chapterTargetUnit, profile.chapterTargetPercent, profile.chapterTargetTokens, transcript, conn.model, userId);
  const built = buildMessages({
    systemPromptTemplate: presetText,
    targetTokens,
    targetPercent,
    previousMemoriesBlock: buildPreviousMemoriesBlock(previousMemories),
    bodyHeading: `<<SCENE TO SUMMARIZE (target ~${targetTokens} tokens)>>`,
    body: transcript,
    shortCommentRulesOverride: profile.shortCommentRulesOverride,
    personaOverride: profile.memoriaPersonaOverride,
    opener
  });
  const resolvedSystem = await resolveSystemMacros(built.system, chatId, userId);
  const outgoingUser = await applySelectedRegex(built.user, profile.regexOutgoingScriptIds, userId);
  const llmMessages = [
    { role: "system", content: resolvedSystem },
    { role: "user", content: outgoingUser }
  ];
  const result = await runStreamingGeneration(conn, llmMessages, profile, userId, streamOptions);
  const rawText = (result.content || "").trim();
  if (!rawText)
    throw new Error("Empty model output");
  const processed = await applySelectedRegex(rawText, profile.regexIncomingScriptIds, userId);
  const parsed = parseSummaryJson(processed);
  if (!parsed.content.trim())
    throw new Error("The summary came back empty");
  return {
    rawOutput: rawText,
    title: parsed.title,
    opener: parsed.opener || opener,
    content: parsed.content,
    keywords: parsed.keywords,
    shortComment: parsed.shortComment,
    usagePromptTokens: result.usage?.prompt_tokens ?? 0,
    usageCompletionTokens: result.usage?.completion_tokens ?? 0,
    model: conn.model,
    connectionId: conn.id,
    presetKey: profile.chapterPresetKey
  };
}
async function summarizeArc(profile, customPresets, chatId, chapters, userId, opener, streamOptions) {
  const conn = await resolveConnection(profile, userId);
  if (!conn)
    throw new FatalSummarizerError("No connection available for Memoria");
  const presetText = findPresetText(profile, customPresets, "arc");
  if (!presetText)
    throw new Error("Arc preset missing");
  const body = chapters.map((c, idx) => `<<CHAPTER ${idx + 1}: ${c.raw.comment || c.meta.title || "untitled"}>>
${c.raw.content}`).join(`

`);
  const { targetTokens, targetPercent } = await resolveTargets(profile.arcTargetUnit, profile.arcTargetPercent, profile.arcTargetTokens, body, conn.model, userId);
  const built = buildMessages({
    systemPromptTemplate: presetText,
    targetTokens,
    targetPercent,
    previousMemoriesBlock: "",
    bodyHeading: `<<CHAPTERS TO CONSOLIDATE (target ~${targetTokens} tokens)>>`,
    body,
    shortCommentRulesOverride: profile.shortCommentRulesOverride,
    personaOverride: profile.memoriaPersonaOverride,
    opener
  });
  const resolvedSystem = await resolveSystemMacros(built.system, chatId, userId);
  const outgoingUser = await applySelectedRegex(built.user, profile.regexOutgoingScriptIds, userId);
  const llmMessages = [
    { role: "system", content: resolvedSystem },
    { role: "user", content: outgoingUser }
  ];
  const result = await runStreamingGeneration(conn, llmMessages, profile, userId, streamOptions);
  const rawText = (result.content || "").trim();
  if (!rawText)
    throw new Error("Empty model output");
  const processed = await applySelectedRegex(rawText, profile.regexIncomingScriptIds, userId);
  const parsed = parseSummaryJson(processed);
  if (!parsed.content.trim())
    throw new Error("The arc summary came back empty");
  return {
    rawOutput: rawText,
    title: parsed.title,
    opener: parsed.opener || opener,
    content: parsed.content,
    keywords: parsed.keywords,
    shortComment: parsed.shortComment,
    usagePromptTokens: result.usage?.prompt_tokens ?? 0,
    usageCompletionTokens: result.usage?.completion_tokens ?? 0,
    model: conn.model,
    connectionId: conn.id,
    presetKey: profile.arcPresetKey
  };
}
function parseSummaryJson(raw) {
  const cleaned = stripThinkBlocks(raw);
  const normalized = normalizeText(cleaned);
  const candidates = collectJsonCandidates(normalized);
  let sawParseableObject = false;
  for (const cand of candidates) {
    const obj = tryParseJsonObject(cand);
    if (!obj)
      continue;
    sawParseableObject = true;
    const title = typeof obj["title"] === "string" ? obj["title"] : "";
    const opener = typeof obj["opener"] === "string" ? obj["opener"] : "";
    const contentRaw = obj["content"] ?? obj["summary"] ?? obj["memory_content"];
    if (typeof contentRaw !== "string")
      continue;
    const kw = obj["keywords"];
    const keywords = Array.isArray(kw) ? kw.filter((x) => typeof x === "string") : [];
    const sc = typeof obj["short_comment"] === "string" ? obj["short_comment"] : "";
    return { title, opener, content: contentRaw, keywords, shortComment: sc };
  }
  if (sawParseableObject) {
    throw new Error("The model's JSON had no content field");
  }
  throw new Error("The model didn't return valid JSON");
}
function stripThinkBlocks(raw) {
  return raw.replace(/<(?:think(?:ing)?|reasoning)>[\s\S]*?<\/(?:think(?:ing)?|reasoning)>/gi, "");
}
function normalizeText(s) {
  return s.replace(/\r\n/g, `
`).replace(/^\uFEFF/, "").replace(/[\u200B-\u200D\u2060]/g, "").trim();
}
function collectJsonCandidates(s) {
  const out = [];
  for (const block of extractFencedBlocks(s))
    out.push(block);
  out.push(s);
  const balanced = extractBalancedJson(s);
  if (balanced)
    out.push(balanced);
  const seen = new Set;
  const uniq = [];
  for (const c of out) {
    if (!c)
      continue;
    if (seen.has(c))
      continue;
    seen.add(c);
    uniq.push(c);
  }
  return uniq;
}
function extractFencedBlocks(s) {
  const re = /```([\w-]*)\s*([\s\S]*?)```/g;
  const out = [];
  let m;
  while ((m = re.exec(s)) !== null) {
    out.push((m[2] || "").trim());
  }
  return out;
}
function extractBalancedJson(s) {
  const startIdx = s.search(/[{[]/);
  if (startIdx === -1)
    return null;
  const open = s[startIdx];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = startIdx;i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) {
        esc = false;
      } else if (ch === "\\") {
        esc = true;
      } else if (ch === '"') {
        inStr = false;
      }
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === open)
      depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0)
        return s.slice(startIdx, i + 1).trim();
    }
  }
  return null;
}
function tryParseJsonObject(cand) {
  const strict = tryJsonParse(cand);
  if (strict)
    return strict;
  return tryJsonParse(repairJson(cand));
}
function tryJsonParse(cand) {
  try {
    const v = JSON.parse(cand);
    if (!v || typeof v !== "object" || Array.isArray(v))
      return null;
    return v;
  } catch {
    return null;
  }
}
function repairJson(s) {
  let out = "";
  let inStr = false;
  let esc = false;
  for (let i = 0;i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      out += ch;
      if (esc) {
        esc = false;
      } else if (ch === "\\") {
        esc = true;
      } else if (ch === '"') {
        inStr = false;
      }
      continue;
    }
    if (ch === '"') {
      inStr = true;
      out += ch;
      continue;
    }
    if (ch === "/" && s[i + 1] === "/") {
      while (i < s.length && s[i] !== `
`)
        i++;
      if (i < s.length)
        out += s[i];
      continue;
    }
    if (ch === "/" && s[i + 1] === "*") {
      i += 2;
      while (i < s.length - 1 && !(s[i] === "*" && s[i + 1] === "/"))
        i++;
      i += 1;
      continue;
    }
    if (ch === ",") {
      let j = i + 1;
      while (j < s.length && /\s/.test(s[j]))
        j++;
      if (s[j] === "}" || s[j] === "]")
        continue;
    }
    out += ch;
  }
  return out;
}

// src/backend/hooks.ts
var CHAPTER_KEY = `${EXTENSION_ID}.latest_chapter`;
var ARC_KEY = `${EXTENSION_ID}.latest_arc`;
var VOLUME_KEY = `${EXTENSION_ID}.latest_volume`;
var registered = false;
function registerHookEndpoints() {
  if (registered)
    return;
  registered = true;
  try {
    spindle.rpcPool?.sync?.(CHAPTER_KEY, null, { requires: [] });
    spindle.rpcPool?.sync?.(ARC_KEY, null, { requires: [] });
    spindle.rpcPool?.sync?.(VOLUME_KEY, null, { requires: [] });
  } catch (err) {
    warn(`rpcPool unavailable: ${describeError(err)}`);
  }
}
function publishChapterCreated(userId, event) {
  const payload = {
    ...event,
    createdAt: Date.now(),
    userId
  };
  try {
    spindle.rpcPool?.sync?.(CHAPTER_KEY, payload, { requires: [] });
  } catch (err) {
    warn(`failed to publish chapter_created: ${describeError(err)}`);
  }
}
function publishArcCreated(userId, event) {
  const payload = {
    ...event,
    createdAt: Date.now(),
    userId
  };
  try {
    spindle.rpcPool?.sync?.(ARC_KEY, payload, { requires: [] });
  } catch (err) {
    warn(`failed to publish arc_created: ${describeError(err)}`);
  }
}
function publishVolumeCreated(userId, event) {
  const payload = {
    ...event,
    createdAt: Date.now(),
    userId
  };
  try {
    spindle.rpcPool?.sync?.(VOLUME_KEY, payload, { requires: [] });
  } catch (err) {
    warn(`failed to publish volume_created: ${describeError(err)}`);
  }
}

// src/backend/book-copy.ts
async function copyLmbEntries(targetBookId, sourceEntries, userId, transform) {
  const idMap = new Map;
  const clonedMeta = new Map;
  const ctx = { idMap, clonedMeta };
  const chapters = sourceEntries.filter((e) => e.meta.tier === 1);
  const arcs = sourceEntries.filter((e) => e.meta.tier === 2);
  const volumes = sourceEntries.filter((e) => e.meta.tier === 3);
  for (const ch of chapters) {
    const o = transform(ch, ctx);
    if (!o)
      continue;
    const meta = {
      ...ch.meta,
      msgIds: o.msgIds,
      firstMsgIdx: o.firstMsgIdx,
      lastMsgIdx: o.lastMsgIdx,
      supersededByEntryId: null,
      ...o.extra
    };
    const created = await createClone(targetBookId, ch.raw, meta, userId, o.comment);
    idMap.set(ch.raw.id, created.id);
    clonedMeta.set(ch.raw.id, meta);
  }
  for (const group of [arcs, volumes]) {
    for (const entry of group) {
      const o = transform(entry, ctx);
      if (!o)
        continue;
      const sourceChapterEntryIds = (entry.meta.sourceChapterEntryIds ?? []).map((oldId) => idMap.get(oldId)).filter((x) => typeof x === "string");
      const meta = {
        ...entry.meta,
        msgIds: o.msgIds,
        sourceChapterEntryIds,
        firstMsgIdx: o.firstMsgIdx,
        lastMsgIdx: o.lastMsgIdx,
        supersededByEntryId: null,
        ...o.extra
      };
      const created = await createClone(targetBookId, entry.raw, meta, userId, o.comment);
      idMap.set(entry.raw.id, created.id);
      clonedMeta.set(entry.raw.id, meta);
    }
  }
  for (const src of [...chapters, ...arcs]) {
    const newId = idMap.get(src.raw.id);
    if (!newId)
      continue;
    const oldSuperId = src.meta.supersededByEntryId;
    if (!oldSuperId)
      continue;
    const newSuperId = idMap.get(oldSuperId);
    if (!newSuperId)
      continue;
    const baseMeta = clonedMeta.get(src.raw.id);
    if (!baseMeta)
      continue;
    const ext = src.raw.extensions || {};
    try {
      await spindle.world_books.entries.update(newId, { extensions: { ...ext, [EXTENSION_KEY]: { ...baseMeta, supersededByEntryId: newSuperId } } }, userId);
    } catch (err) {
      warn(`copyLmbEntries: failed to re-point entry ${newId.slice(0, 8)}: ${describeError(err)}`);
    }
  }
  return idMap;
}
async function createClone(bookId, source, meta, userId, commentOverride) {
  const ext = source.extensions || {};
  return spindle.world_books.entries.create(bookId, {
    content: source.content,
    comment: commentOverride ?? source.comment,
    disabled: source.disabled,
    constant: source.constant,
    key: source.key ?? [],
    keysecondary: source.keysecondary ?? [],
    vectorized: source.vectorized ?? false,
    extensions: { ...ext, [EXTENSION_KEY]: meta }
  }, userId);
}

// src/backend/fork.ts
var FORK_ADOPTED_FLAG = "lumibooks_fork_adopted";
var MAX_ANCESTRY_HOPS = 100;
var checked = new Set;
var inflight = new Map;
function key(userId, chatId) {
  return `${userId}::${chatId}`;
}
async function ensureForkAdoption(chatId, userId) {
  const k = key(userId, chatId);
  if (checked.has(k))
    return;
  const existing = inflight.get(k);
  if (existing)
    return existing;
  const p = (async () => {
    try {
      await doForkAdoption(chatId, userId);
      checked.add(k);
    } catch (err) {
      warn(`fork adoption failed for ${chatId.slice(0, 8)}: ${describeError(err)}`);
    } finally {
      inflight.delete(k);
    }
  })();
  inflight.set(k, p);
  return p;
}
async function doForkAdoption(forkChatId, userId) {
  const chat = await spindle.chats.get(forkChatId, userId).catch(() => null);
  if (!chat)
    return;
  const meta = chat.metadata && typeof chat.metadata === "object" ? chat.metadata : null;
  const branchedFrom = meta && typeof meta["branched_from"] === "string" ? meta["branched_from"] : null;
  if (!branchedFrom)
    return;
  if (meta && meta[FORK_ADOPTED_FLAG] === true)
    return;
  const owned = await findBookForChat(forkChatId, userId).catch(() => null);
  if (owned)
    return;
  const ancestor = await findAncestorBook(branchedFrom, userId);
  if (!ancestor)
    return;
  await cloneShelfForFork(forkChatId, chat.name ?? null, ancestor.chatId, userId);
}
async function findAncestorBook(startChatId, userId) {
  const seen = new Set;
  let cur = startChatId;
  let hops = 0;
  while (cur && hops < MAX_ANCESTRY_HOPS) {
    const chatId = cur;
    if (seen.has(chatId))
      break;
    seen.add(chatId);
    hops++;
    const bookId = await findBookForChat(chatId, userId).catch(() => null);
    if (bookId)
      return { chatId, bookId };
    const chat = await spindle.chats.get(chatId, userId).catch(() => null);
    const meta = chat && chat.metadata && typeof chat.metadata === "object" ? chat.metadata : null;
    cur = meta && typeof meta["branched_from"] === "string" ? meta["branched_from"] : null;
  }
  return null;
}
async function cloneShelfForFork(forkChatId, forkChatName, parentChatId, userId) {
  const parentEntries = await listLmbEntries(parentChatId, userId);
  if (parentEntries.length === 0)
    return;
  const [forkMsgs, parentMsgs] = await Promise.all([
    spindle.chat.getMessages(forkChatId),
    spindle.chat.getMessages(parentChatId)
  ]);
  const parentIdxById = new Map;
  for (const m of parentMsgs)
    parentIdxById.set(m.id, m.index_in_chat);
  const forkIdByIdx = new Map;
  for (const m of forkMsgs) {
    if (forkIdByIdx.has(m.index_in_chat)) {
      warn(`fork adoption: duplicate index_in_chat ${m.index_in_chat} in fork ${forkChatId.slice(0, 8)}; remap may be imprecise`);
      continue;
    }
    forkIdByIdx.set(m.index_in_chat, m.id);
  }
  const remap = (msgIds) => {
    const ids = [];
    let first = Number.POSITIVE_INFINITY;
    let last = -1;
    for (const id of msgIds) {
      const idx = parentIdxById.get(id);
      if (idx === undefined)
        continue;
      const forkId = forkIdByIdx.get(idx);
      if (forkId === undefined)
        continue;
      ids.push(forkId);
      if (idx < first)
        first = idx;
      if (idx > last)
        last = idx;
    }
    return {
      ids,
      first: first === Number.POSITIVE_INFINITY ? undefined : first,
      last: last === -1 ? undefined : last
    };
  };
  const forkTransform = (entry, ctx) => {
    if (entry.meta.isRoot) {
      return {
        msgIds: entry.meta.msgIds.slice(),
        firstMsgIdx: entry.meta.firstMsgIdx,
        lastMsgIdx: entry.meta.lastMsgIdx,
        extra: { chatId: forkChatId }
      };
    }
    const { ids, first, last } = remap(entry.meta.msgIds);
    if (entry.meta.tier === 1) {
      if (ids.length === 0)
        return null;
      return { msgIds: ids, firstMsgIdx: first, lastMsgIdx: last, extra: { chatId: forkChatId } };
    }
    const survived = (entry.meta.sourceChapterEntryIds ?? []).map((oldId) => ctx.idMap.get(oldId)).filter((x) => typeof x === "string");
    if (ids.length === 0 && survived.length === 0)
      return null;
    let firstIdx = first;
    let lastIdx = last;
    if (firstIdx === undefined || lastIdx === undefined) {
      for (const oldId of entry.meta.sourceChapterEntryIds ?? []) {
        const cm = ctx.clonedMeta.get(oldId);
        if (!cm)
          continue;
        if (cm.firstMsgIdx !== undefined)
          firstIdx = firstIdx === undefined ? cm.firstMsgIdx : Math.min(firstIdx, cm.firstMsgIdx);
        if (cm.lastMsgIdx !== undefined)
          lastIdx = lastIdx === undefined ? cm.lastMsgIdx : Math.max(lastIdx, cm.lastMsgIdx);
      }
    }
    return { msgIds: ids, firstMsgIdx: firstIdx, lastMsgIdx: lastIdx, extra: { chatId: forkChatId } };
  };
  const settings = await loadSettings(userId);
  const newBookName = await formatBookName(settings, forkChatId, userId, forkChatName);
  const newBook = await spindle.world_books.create({
    name: newBookName,
    description: "Memoria's shelf for this chat. Chapters and arcs live here.",
    metadata: {
      lumibooks_chat_id: forkChatId,
      lumibooks_created_at: Date.now(),
      lumibooks_forked_from: parentChatId
    }
  }, userId);
  let cloned = 0;
  try {
    const idMap = await copyLmbEntries(newBook.id, parentEntries, userId, forkTransform);
    cloned = idMap.size;
    await rebindForkShelf(forkChatId, newBook.id, userId);
  } catch (err) {
    await spindle.world_books.delete(newBook.id, userId).catch(() => {});
    throw err;
  }
  invalidateBookCache(userId, forkChatId);
  try {
    const profile = settings.profiles.find((p) => p.id === settings.activeProfileId);
    const desiredHidden = profile ? profile.hideCoveredMessages : true;
    await resyncVisibility(forkChatId, userId, desiredHidden);
  } catch (err) {
    warn(`fork adoption: visibility resync failed: ${describeError(err)}`);
  }
  info(`adopted fork ${forkChatId.slice(0, 8)} from ${parentChatId.slice(0, 8)} (${cloned} entries cloned)`);
}
async function rebindForkShelf(forkChatId, newBookId, userId) {
  const chat = await spindle.chats.get(forkChatId, userId).catch(() => null);
  if (!chat)
    return;
  const metadata = chat.metadata && typeof chat.metadata === "object" ? { ...chat.metadata } : {};
  const inheritedBookId = typeof metadata["lumibooks_book_id"] === "string" ? metadata["lumibooks_book_id"] : null;
  const existing = Array.isArray(metadata["chat_world_book_ids"]) ? metadata["chat_world_book_ids"].filter((x) => typeof x === "string") : [];
  const nextBookIds = existing.filter((id) => id !== inheritedBookId && id !== newBookId);
  nextBookIds.push(newBookId);
  metadata["chat_world_book_ids"] = nextBookIds;
  metadata["lumibooks_book_id"] = newBookId;
  metadata[FORK_ADOPTED_FLAG] = true;
  await spindle.chats.update(forkChatId, { metadata }, userId);
}

// src/backend/pipeline.ts
var inflight2 = new Map;
var busyByUser = new Map;
var aborters = new Map;
var progressLastPush = new Map;
var progressState = new Map;
var heartbeatTimer = null;
var HEARTBEAT_INTERVAL_MS = 1000;
var failureByChat = new Map;
var previewsByChat = new Map;
var committingDrafts = new Set;
var PROGRESS_PUSH_INTERVAL_MS = 250;
var commitChain = new Map;
function withCommitMutex(userId, chatId, tier, fn) {
  const key2 = `${userId}::${chatId}::t${tier}`;
  const prev = commitChain.get(key2) ?? Promise.resolve();
  const tail = prev.then(fn, fn);
  const guarded = tail.catch(() => {
    return;
  });
  commitChain.set(key2, guarded);
  guarded.then(() => {
    if (commitChain.get(key2) === guarded)
      commitChain.delete(key2);
  });
  return tail;
}
var FAILURE_MAP_CAP = 500;
var PREVIEW_MAP_CAP = 500;
function capMap(map, cap) {
  while (map.size > cap) {
    const oldest = map.keys().next().value;
    if (oldest === undefined)
      break;
    map.delete(oldest);
  }
}
function busyKey(userId, chatId, kind) {
  return `${userId}::${chatId}::${kind}`;
}
function chatKey(userId, chatId) {
  return `${userId}::${chatId}`;
}
var cb = null;
function registerPipelineCallbacks(c) {
  cb = c;
}
function setBusy(userId, chatId, kind, label) {
  const key2 = busyKey(userId, chatId, kind);
  if (inflight2.has(key2))
    return false;
  const entry = { kind, chatId, label, startedAt: Date.now() };
  inflight2.set(key2, entry);
  progressState.set(key2, { kind, chars: 0, thinkingChars: 0, userId, chatId });
  const list = busyByUser.get(userId) ?? [];
  list.push(entry);
  busyByUser.set(userId, list);
  cb?.onBusyChange(userId, list.slice());
  ensureHeartbeat();
  return true;
}
function clearBusy(userId, chatId, kind) {
  const key2 = busyKey(userId, chatId, kind);
  inflight2.delete(key2);
  aborters.delete(key2);
  progressLastPush.delete(key2);
  progressState.delete(key2);
  const fresh = [];
  for (const k of inflight2.keys()) {
    if (!k.startsWith(`${userId}::`))
      continue;
    const found = inflight2.get(k);
    if (found)
      fresh.push(found);
  }
  busyByUser.set(userId, fresh);
  cb?.onBusyChange(userId, fresh.slice());
}
function registerAborter(userId, chatId, kind, controller) {
  aborters.set(busyKey(userId, chatId, kind), controller);
}
function abortBusy(userId, chatId, kind) {
  const controller = aborters.get(busyKey(userId, chatId, kind));
  if (!controller)
    return false;
  controller.abort();
  return true;
}
function formatElapsed(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60)
    return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m${rem.toString().padStart(2, "0")}s`;
}
function chapterBusyLabel(chars, thinkingChars, elapsedMs) {
  const tokens = approximateTokensFromChars(chars);
  const thinkTokens = approximateTokensFromChars(thinkingChars);
  const t = formatElapsed(elapsedMs);
  if (tokens === 0 && thinkTokens === 0)
    return `Memoria is filing a chapter (${t})`;
  if (tokens === 0 && thinkTokens > 0)
    return `Memoria is thinking (~${thinkTokens} tokens, ${t})`;
  if (thinkTokens > 0)
    return `Memoria is ~${tokens} tokens into a chapter (~${thinkTokens} thinking, ${t})`;
  return `Memoria is ~${tokens} tokens into a chapter (${t})`;
}
function arcBusyLabel(chars, thinkingChars, elapsedMs) {
  const tokens = approximateTokensFromChars(chars);
  const thinkTokens = approximateTokensFromChars(thinkingChars);
  const t = formatElapsed(elapsedMs);
  if (tokens === 0 && thinkTokens === 0)
    return `Memoria is binding an arc (${t})`;
  if (tokens === 0 && thinkTokens > 0)
    return `Memoria is thinking (~${thinkTokens} tokens, ${t})`;
  if (thinkTokens > 0)
    return `Memoria is ~${tokens} tokens into an arc (~${thinkTokens} thinking, ${t})`;
  return `Memoria is ~${tokens} tokens into an arc (${t})`;
}
function volumeBusyLabel(chars, thinkingChars, elapsedMs) {
  const tokens = approximateTokensFromChars(chars);
  const thinkTokens = approximateTokensFromChars(thinkingChars);
  const t = formatElapsed(elapsedMs);
  if (tokens === 0 && thinkTokens === 0)
    return `Memoria is pressing a volume (${t})`;
  if (tokens === 0 && thinkTokens > 0)
    return `Memoria is thinking (~${thinkTokens} tokens, ${t})`;
  if (thinkTokens > 0)
    return `Memoria is ~${tokens} tokens into a volume (~${thinkTokens} thinking, ${t})`;
  return `Memoria is ~${tokens} tokens into a volume (${t})`;
}
function formatBusyLabel(state, elapsedMs) {
  if (state.kind === "arc")
    return arcBusyLabel(state.chars, state.thinkingChars, elapsedMs);
  if (state.kind === "volume")
    return volumeBusyLabel(state.chars, state.thinkingChars, elapsedMs);
  return chapterBusyLabel(state.chars, state.thinkingChars, elapsedMs);
}
function ensureHeartbeat() {
  if (heartbeatTimer)
    return;
  heartbeatTimer = setInterval(() => {
    if (progressState.size === 0) {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      return;
    }
    const touched = new Set;
    for (const [key2, ps] of progressState) {
      const entry = inflight2.get(key2);
      if (!entry)
        continue;
      const elapsed = Date.now() - entry.startedAt;
      entry.label = formatBusyLabel(ps, elapsed);
      touched.add(ps.userId);
    }
    for (const userId of touched) {
      const list = busyByUser.get(userId) ?? [];
      cb?.onBusyChange(userId, list.slice());
    }
  }, HEARTBEAT_INTERVAL_MS);
}
function updateProgressNumbers(userId, chatId, kind, chars, thinkingChars) {
  const key2 = busyKey(userId, chatId, kind);
  const ps = progressState.get(key2);
  if (!ps)
    return;
  ps.chars = chars;
  ps.thinkingChars = thinkingChars;
  const entry = inflight2.get(key2);
  if (!entry)
    return;
  const now = Date.now();
  const last = progressLastPush.get(key2) ?? 0;
  if (now - last < PROGRESS_PUSH_INTERVAL_MS)
    return;
  progressLastPush.set(key2, now);
  entry.label = formatBusyLabel(ps, now - entry.startedAt);
  const list = busyByUser.get(userId) ?? [];
  cb?.onBusyChange(userId, list.slice());
}
function getBusy(userId) {
  return (busyByUser.get(userId) ?? []).slice();
}
function getLastFailure(userId, chatId) {
  return failureByChat.get(chatKey(userId, chatId)) ?? null;
}
function clearLastFailure(userId, chatId) {
  failureByChat.delete(chatKey(userId, chatId));
}
function getPendingPreviews(userId, chatId) {
  return (previewsByChat.get(chatKey(userId, chatId)) ?? []).slice();
}
function findPendingPreview(userId, chatId, draftId) {
  return (previewsByChat.get(chatKey(userId, chatId)) ?? []).find((p) => p.draftId === draftId) ?? null;
}
function dropPendingPreview(userId, chatId, draftId) {
  const list = previewsByChat.get(chatKey(userId, chatId)) ?? [];
  previewsByChat.set(chatKey(userId, chatId), list.filter((p) => p.draftId !== draftId));
}
function patchPendingPreview(userId, chatId, draftId, patch) {
  const key2 = chatKey(userId, chatId);
  const list = previewsByChat.get(key2) ?? [];
  const idx = list.findIndex((p) => p.draftId === draftId);
  if (idx === -1)
    return;
  const old = list[idx];
  list[idx] = {
    ...old,
    title: patch.title !== undefined ? patch.title : old.title,
    content: patch.content !== undefined ? patch.content : old.content
  };
  previewsByChat.set(key2, list);
}
function pushPreview(userId, chatId, preview) {
  const key2 = chatKey(userId, chatId);
  const existing = previewsByChat.get(key2);
  if (existing) {
    previewsByChat.delete(key2);
    existing.push(preview);
    previewsByChat.set(key2, existing);
  } else {
    previewsByChat.set(key2, [preview]);
  }
  capMap(previewsByChat, PREVIEW_MAP_CAP);
}
async function runWithRetry(attempts, fn, onRetry) {
  let lastErr = null;
  const tries = Math.max(1, attempts);
  for (let i = 0;i < tries; i++) {
    try {
      const v = await fn();
      return { ok: true, value: v };
    } catch (err) {
      lastErr = err;
      if (err instanceof FatalSummarizerError || err instanceof AbortedSummarizerError) {
        return { ok: false, err, retries: i };
      }
      if (i < tries - 1)
        onRetry(i + 1, err);
    }
  }
  return { ok: false, err: lastErr, retries: tries - 1 };
}
function recordFailure(userId, chatId, kind, retries, err) {
  const key2 = chatKey(userId, chatId);
  if (failureByChat.has(key2))
    failureByChat.delete(key2);
  failureByChat.set(key2, {
    kind,
    message: describeError(err),
    retriedTimes: retries,
    at: Date.now()
  });
  capMap(failureByChat, FAILURE_MAP_CAP);
}
function nyaaToast(userId, kind, automation) {
  if (!cb)
    return;
  const tone = kind === "retry" ? "warn" : kind === "success" || kind === "arc_success" || kind === "volume_success" ? "success" : "info";
  cb.onToast(userId, tone, pickPhrase(kind), automation);
}
function shortErrorText(err) {
  const raw = describeError(err).replace(/\s+/g, " ").trim();
  const firstSentence = raw.split(/(?<=[.!?])\s/, 1)[0] || raw;
  const cleaned = firstSentence.replace(/;/g, ",");
  return cleaned.length > 160 ? `${cleaned.slice(0, 159)}\u2026` : cleaned;
}
function failToast(userId, kind, err) {
  const noun = kind === "arc" ? "bind the arc" : kind === "volume" ? "press the volume" : "file the chapter";
  cb?.onToast(userId, "error", `Memoria couldn't ${noun}: ${shortErrorText(err)}`);
}
async function createChapterAuto(chatId, profile, settings, userId, automation = false) {
  if (!setBusy(userId, chatId, "chapter", "Memoria is filing a chapter"))
    return null;
  try {
    const messages = await spindle.chat.getMessages(chatId);
    if (!messages || messages.length === 0)
      return null;
    const coverage = await buildCoverage(chatId, userId);
    const stats = computeCoverageStats(messages, coverage, profile);
    if (!stats.lagSatisfied || !stats.windowAvailable)
      return null;
    const uncoveredTail = pickUncoveredTail(messages, coverage);
    const window = selectNextChapterWindow(uncoveredTail, profile);
    if (window.length === 0)
      return null;
    return await runChapter(chatId, profile, settings, userId, messages, window, { automation });
  } finally {
    clearBusy(userId, chatId, "chapter");
  }
}
async function createChapterFromRange(chatId, messageIds, profile, settings, userId, opts = {}) {
  if (!setBusy(userId, chatId, "chapter", "Memoria is filing a chapter"))
    return null;
  try {
    const messages = await spindle.chat.getMessages(chatId);
    if (!messages.length)
      return null;
    const set = new Set(messageIds);
    const window = messages.filter((m) => set.has(m.id) && !isExcluded(m));
    if (window.length === 0)
      return null;
    return await runChapter(chatId, profile, settings, userId, messages, window, { replacesEntryId: opts.replacesEntryId });
  } finally {
    clearBusy(userId, chatId, "chapter");
  }
}
async function runChapter(chatId, profile, settings, userId, allMessages, window, opts = {}) {
  const { replacesEntryId } = opts;
  const automation = opts.automation === true;
  nyaaToast(userId, "fire", automation);
  const entries = await listLmbEntries(chatId, userId);
  const coverage = await buildCoverage(chatId, userId, entries);
  const chapters = coverage.activeEntries.filter((e) => e.meta.tier === 1 && typeof e.meta.firstMsgIdx === "number").sort((a, b) => storyOrderOf(a) - storyOrderOf(b));
  const previousMemories = profile.previousMemoriesCount > 0 ? chapters.slice(-profile.previousMemoriesCount) : [];
  const provisionalSceneNumber = await nextSceneNumber(chatId, 1, userId);
  const opener = buildChapterHeader(provisionalSceneNumber, window.length);
  const outcome = await runWithRetry(profile.retryCount + 1, async () => {
    const controller = new AbortController;
    registerAborter(userId, chatId, "chapter", controller);
    try {
      return await summarizeChapter(profile, settings.customPresets, chatId, window, previousMemories, userId, opener, {
        externalSignal: controller.signal,
        onProgress: (chars, thinking) => updateProgressNumbers(userId, chatId, "chapter", chars, thinking)
      });
    } finally {
      aborters.delete(busyKey(userId, chatId, "chapter"));
    }
  }, (n, err) => {
    warn(`chapter attempt ${n} failed: ${describeError(err)}`);
    nyaaToast(userId, "retry", automation);
  });
  if (!outcome.ok) {
    if (outcome.err instanceof AbortedSummarizerError) {
      cb?.onToast(userId, "info", "Memoria sets the pen down");
      cb?.onStateChange(userId, chatId);
      return null;
    }
    recordFailure(userId, chatId, "chapter", outcome.retries, outcome.err);
    failToast(userId, "chapter", outcome.err);
    cb?.onStateChange(userId, chatId);
    return null;
  }
  clearLastFailure(userId, chatId);
  const result = outcome.value;
  const firstIdx = allMessages.findIndex((m) => m.id === window[0].id);
  const lastIdx = allMessages.findIndex((m) => m.id === window[window.length - 1].id);
  if (profile.showMemoryPreviews) {
    const draft = makePreview("chapter", chatId, window, result, firstIdx, lastIdx, replacesEntryId);
    pushPreview(userId, chatId, draft);
    cb?.onStateChange(userId, chatId);
    return null;
  }
  try {
    const entryId = await commitChapter(chatId, profile, userId, window, result, firstIdx, lastIdx, allMessages, false, replacesEntryId);
    nyaaToast(userId, "success", automation);
    return entryId;
  } catch (err) {
    warn(`commitChapter failed: ${describeError(err)}`);
    recordFailure(userId, chatId, "chapter", 0, err);
    failToast(userId, "chapter", err);
    cb?.onStateChange(userId, chatId);
    return null;
  }
}
async function commitChapter(chatId, profile, userId, window, result, firstIdx, lastIdx, allMessages, fromPreview, replacesEntryId) {
  return withCommitMutex(userId, chatId, 1, async () => {
    const freshEntries = await listLmbEntries(chatId, userId);
    const entriesForCoverage = replacesEntryId ? freshEntries.filter((e) => e.raw.id !== replacesEntryId) : freshEntries;
    const freshCoverage = await buildCoverage(chatId, userId, entriesForCoverage);
    const validWindow = window.filter((m) => !freshCoverage.coveredBy.has(m.id));
    if (validWindow.length === 0) {
      throw new Error("All messages in this window were just bound by another chapter");
    }
    if (validWindow.length < window.length) {
      window = validWindow;
      const validIds = new Set(validWindow.map((m) => m.id));
      firstIdx = allMessages.findIndex((m) => validIds.has(m.id));
      lastIdx = -1;
      for (let i = allMessages.length - 1;i >= 0; i--) {
        if (validIds.has(allMessages[i].id)) {
          lastIdx = i;
          break;
        }
      }
    }
    const book = await ensureBookForChat(chatId, userId);
    const replacedEntry = replacesEntryId ? freshEntries.find((e) => e.raw.id === replacesEntryId) : undefined;
    const sceneNumber = typeof replacedEntry?.meta.sceneNumber === "number" ? replacedEntry.meta.sceneNumber : await nextSceneNumber(chatId, 1, userId);
    const storyOrder = typeof replacedEntry?.meta.storyOrder === "number" ? replacedEntry.meta.storyOrder : nextStoryOrder(entriesForCoverage);
    const title = fromPreview ? result.title?.trim() || `Chapter ${firstIdx + 1}-${lastIdx + 1}` : deriveTitle(result);
    const msgIds = window.map((m) => m.id);
    const windowIdxs = window.map(chatMessageIndex).filter((n) => typeof n === "number");
    const firstMsgIdx = windowIdxs.length ? Math.min(...windowIdxs) : firstIdx;
    const lastMsgIdx = windowIdxs.length ? Math.max(...windowIdxs) : lastIdx;
    const meta = {
      tier: 1,
      chatId,
      msgIds,
      firstMsgIdx: firstMsgIdx >= 0 ? firstMsgIdx : undefined,
      lastMsgIdx: lastMsgIdx >= 0 ? lastMsgIdx : undefined,
      tokenCountInput: window.reduce((acc, m) => acc + approximateTokensFromChars((m.content || "").length), 0),
      tokenCountOutput: result.usageCompletionTokens || approximateTokensFromChars(result.content.length),
      model: result.model,
      connectionId: result.connectionId,
      createdAt: Date.now(),
      title,
      shortComment: result.shortComment,
      presetKey: result.presetKey,
      sceneNumber,
      storyOrder,
      rawOutput: result.rawOutput
    };
    const settings = await loadSettings(userId);
    const comment = await formatEntryName(settings, {
      chatId,
      userId,
      tier: "chapter",
      title: meta.title ?? "",
      sceneNumber,
      storyOrder,
      firstMsgIdx: meta.firstMsgIdx,
      lastMsgIdx: meta.lastMsgIdx,
      turnCount: msgIds.length
    });
    const opener = buildChapterHeader(sceneNumber, msgIds.length);
    const finalContent = savedMemoryContent(settings, opener, result.content);
    const entry = await createChapterEntry(book.id, meta, finalContent, comment, userId, result.keywords ?? [], settings.forceConstantEntries);
    invalidateBookCache(userId, chatId);
    if (replacesEntryId) {
      try {
        await deleteEntry(replacesEntryId, userId);
        invalidateBookCache(userId, chatId);
      } catch (err) {
        warn(`regen: failed to delete replaced chapter ${replacesEntryId}: ${describeError(err)}`);
      }
    }
    try {
      await syncHiddenForCoveredMessages(chatId, allMessages, {
        coveredBy: new Map(window.map((m) => [m.id, entry.id])),
        activeEntries: [],
        volumes: [],
        arcs: [],
        chapters: []
      }, userId, true, meta.lastMsgIdx);
    } catch (err) {
      warn(`setMessagesHidden failed: ${describeError(err)}`);
    }
    publishChapterCreated(userId, {
      chatId,
      chapterEntryId: entry.id,
      bookId: book.id,
      sourceMessageIds: meta.msgIds,
      summaryText: finalContent,
      model: result.model,
      title: meta.title
    });
    cb?.onStateChange(userId, chatId);
    return entry.id;
  });
}
async function createArcAuto(chatId, profile, settings, userId, automation = false) {
  if (!setBusy(userId, chatId, "arc", "Memoria is binding an arc"))
    return null;
  try {
    const entries = await listLmbEntries(chatId, userId);
    const coverage = await buildCoverage(chatId, userId, entries);
    const chapters = coverage.activeEntries.filter((e) => e.meta.tier === 1 && !e.meta.isRoot).sort((a, b) => storyOrderOf(a) - storyOrderOf(b));
    if (chapters.length === 0)
      return null;
    let selected = [];
    if (profile.arcTrigger === "chapters") {
      const compressible = Math.max(0, chapters.length - profile.arcLagChapters);
      if (compressible < profile.arcAfterChapters)
        return null;
      selected = chapters.slice(0, compressible).slice(0, profile.arcAfterChapters);
    } else if (profile.arcTrigger === "tokens") {
      const reservedFromTail = [];
      let reservedTokens = 0;
      for (let i = chapters.length - 1;i >= 0 && reservedTokens < profile.arcLagTokens; i--) {
        reservedFromTail.unshift(chapters[i]);
        reservedTokens += chapters[i].meta.tokenCountOutput;
      }
      const reservedSet = new Set(reservedFromTail.map((c) => c.raw.id));
      const compressible = chapters.filter((c) => !reservedSet.has(c.raw.id));
      const compressibleTokens = compressible.reduce((a, c) => a + c.meta.tokenCountOutput, 0);
      if (compressibleTokens < profile.arcAfterTokens)
        return null;
      const take = [];
      let acc = 0;
      for (const ch of compressible) {
        take.push(ch);
        acc += ch.meta.tokenCountOutput;
        if (acc >= profile.arcAfterTokens)
          break;
      }
      selected = take;
    } else {
      return null;
    }
    if (selected.length === 0)
      return null;
    return await runArc(chatId, profile, settings, userId, selected, { automation });
  } finally {
    clearBusy(userId, chatId, "arc");
  }
}
async function createArcFromChapters(chatId, chapterEntryIds, profile, settings, userId, opts = {}) {
  if (!setBusy(userId, chatId, "arc", "Memoria is binding an arc"))
    return null;
  try {
    const entries = await listLmbEntries(chatId, userId);
    const entriesForSelection = opts.replacesEntryId ? entries.filter((e) => e.raw.id !== opts.replacesEntryId) : entries;
    const coverage = await buildCoverage(chatId, userId, entriesForSelection);
    const wanted = new Set(chapterEntryIds);
    const chapters = coverage.activeEntries.filter((e) => e.meta.tier === 1 && wanted.has(e.raw.id)).sort((a, b) => storyOrderOf(a) - storyOrderOf(b));
    if (chapters.length === 0)
      return null;
    return await runArc(chatId, profile, settings, userId, chapters, { replacesEntryId: opts.replacesEntryId });
  } finally {
    clearBusy(userId, chatId, "arc");
  }
}
async function runArc(chatId, profile, settings, userId, selected, opts = {}) {
  const { replacesEntryId } = opts;
  const automation = opts.automation === true;
  nyaaToast(userId, "arc_fire", automation);
  const totalTurns = selected.reduce((acc, c) => acc + c.meta.msgIds.length, 0);
  const provisionalSceneNumber = await nextSceneNumber(chatId, 2, userId);
  const opener = buildArcHeader(provisionalSceneNumber, selected.length, totalTurns);
  const outcome = await runWithRetry(profile.retryCount + 1, async () => {
    const controller = new AbortController;
    registerAborter(userId, chatId, "arc", controller);
    try {
      return await summarizeArc(profile, settings.customPresets, chatId, selected, userId, opener, {
        externalSignal: controller.signal,
        onProgress: (chars, thinking) => updateProgressNumbers(userId, chatId, "arc", chars, thinking)
      });
    } finally {
      aborters.delete(busyKey(userId, chatId, "arc"));
    }
  }, (n, err) => {
    warn(`arc attempt ${n} failed: ${describeError(err)}`);
    nyaaToast(userId, "retry", automation);
  });
  if (!outcome.ok) {
    if (outcome.err instanceof AbortedSummarizerError) {
      cb?.onToast(userId, "info", "Memoria sets the pen down");
      cb?.onStateChange(userId, chatId);
      return null;
    }
    recordFailure(userId, chatId, "arc", outcome.retries, outcome.err);
    failToast(userId, "arc", outcome.err);
    cb?.onStateChange(userId, chatId);
    return null;
  }
  clearLastFailure(userId, chatId);
  const result = outcome.value;
  const firstIdxs = selected.map((c) => c.meta.firstMsgIdx).filter((n) => typeof n === "number");
  const lastIdxs = selected.map((c) => c.meta.lastMsgIdx).filter((n) => typeof n === "number");
  const firstIdx = firstIdxs.length ? Math.min(...firstIdxs) : 0;
  const lastIdx = lastIdxs.length ? Math.max(...lastIdxs) : firstIdx;
  if (profile.showMemoryPreviews) {
    const draft = makeGroupPreview("arc", selected, result, firstIdx, lastIdx, replacesEntryId);
    pushPreview(userId, chatId, draft);
    cb?.onStateChange(userId, chatId);
    return null;
  }
  try {
    const entryId = await commitArc(chatId, userId, selected, result, firstIdx, lastIdx, replacesEntryId, automation);
    nyaaToast(userId, "arc_success", automation);
    return entryId;
  } catch (err) {
    warn(`commitArc failed: ${describeError(err)}`);
    recordFailure(userId, chatId, "arc", 0, err);
    failToast(userId, "arc", err);
    cb?.onStateChange(userId, chatId);
    return null;
  }
}
async function commitArc(chatId, userId, selected, result, firstIdx, lastIdx, replacesEntryId, automation = false) {
  return withCommitMutex(userId, chatId, 2, async () => {
    const freshEntries = await listLmbEntries(chatId, userId);
    const entriesForCoverage = replacesEntryId ? freshEntries.filter((e) => e.raw.id !== replacesEntryId) : freshEntries;
    const freshCoverage = await buildCoverage(chatId, userId, entriesForCoverage);
    const stillActive = new Set(freshCoverage.activeEntries.filter((e) => e.meta.tier === 1).map((e) => e.raw.id));
    const filtered = selected.filter((c) => stillActive.has(c.raw.id));
    if (filtered.length === 0) {
      throw new Error("All source chapters were already bound by another arc or deleted");
    }
    if (filtered.length < selected.length) {
      selected = filtered;
      const firstIdxs = selected.map((c) => c.meta.firstMsgIdx).filter((n) => typeof n === "number");
      const lastIdxs = selected.map((c) => c.meta.lastMsgIdx).filter((n) => typeof n === "number");
      firstIdx = firstIdxs.length ? Math.min(...firstIdxs) : 0;
      lastIdx = lastIdxs.length ? Math.max(...lastIdxs) : firstIdx;
    }
    const book = await ensureBookForChat(chatId, userId);
    const replacedArc = replacesEntryId ? freshEntries.find((e) => e.raw.id === replacesEntryId) : undefined;
    const sceneNumber = typeof replacedArc?.meta.sceneNumber === "number" ? replacedArc.meta.sceneNumber : await nextSceneNumber(chatId, 2, userId);
    const storyOrder = typeof replacedArc?.meta.storyOrder === "number" ? replacedArc.meta.storyOrder : inheritedStoryOrder(selected, entriesForCoverage);
    const msgIds = selected.flatMap((c) => c.meta.msgIds);
    const sourceChapterEntryIds = selected.map((c) => c.raw.id);
    const isRootArc = selected.length > 0 && selected.every((c) => c.meta.isRoot);
    const rootOrigin = isRootArc ? selected.find((c) => c.meta.rootOrigin)?.meta.rootOrigin : undefined;
    if (!isRootArc && selected.some((c) => c.meta.isRoot)) {
      const own = selected.filter((c) => !c.meta.isRoot);
      const fs = own.map((c) => c.meta.firstMsgIdx).filter((n) => typeof n === "number");
      const ls = own.map((c) => c.meta.lastMsgIdx).filter((n) => typeof n === "number");
      if (fs.length)
        firstIdx = Math.min(...fs);
      else if (firstIdx < 0)
        firstIdx = 0;
      if (ls.length)
        lastIdx = Math.max(...ls);
      else if (lastIdx < firstIdx)
        lastIdx = firstIdx;
    }
    const arcTitle = isRootArc ? result.title?.trim() || "Inherited Arc" : deriveTitle(result);
    const meta = {
      tier: 2,
      chatId,
      msgIds,
      sourceChapterEntryIds,
      firstMsgIdx: firstIdx,
      lastMsgIdx: lastIdx,
      tokenCountInput: selected.reduce((a, c) => a + c.meta.tokenCountOutput, 0),
      tokenCountOutput: result.usageCompletionTokens || approximateTokensFromChars(result.content.length),
      model: result.model,
      connectionId: result.connectionId,
      createdAt: Date.now(),
      title: arcTitle,
      shortComment: result.shortComment,
      presetKey: result.presetKey,
      sceneNumber,
      storyOrder,
      rawOutput: result.rawOutput,
      ...isRootArc ? { isRoot: true, rootOrigin } : {}
    };
    const arcSettings = await loadSettings(userId);
    const comment = await formatEntryName(arcSettings, {
      chatId,
      userId,
      tier: "arc",
      title: meta.title ?? "",
      sceneNumber,
      storyOrder,
      firstMsgIdx: meta.firstMsgIdx,
      lastMsgIdx: meta.lastMsgIdx,
      sourceCount: sourceChapterEntryIds.length,
      turnCount: msgIds.length,
      isRoot: isRootArc
    });
    const arcOpener = buildArcHeader(sceneNumber, sourceChapterEntryIds.length, msgIds.length);
    const finalArcContent = savedMemoryContent(arcSettings, arcOpener, result.content);
    const arcEntry = await createChapterEntry(book.id, meta, finalArcContent, comment, userId, result.keywords ?? [], arcSettings.forceConstantEntries);
    const failedSupersedes = [];
    for (const ch of selected) {
      try {
        await patchEntryMeta(ch, { supersededByEntryId: arcEntry.id }, userId);
      } catch (err) {
        failedSupersedes.push(ch.raw.id);
        warn(`failed to mark chapter ${ch.raw.id} superseded by arc ${arcEntry.id}: ${describeError(err)}`);
      }
    }
    if (failedSupersedes.length > 0) {
      cb?.onToast(userId, "warn", `The arc saved but ${failedSupersedes.length} chapter${failedSupersedes.length === 1 ? "" : "s"} couldn't be marked superseded`, automation);
    }
    invalidateBookCache(userId, chatId);
    if (replacesEntryId) {
      try {
        await deleteEntry(replacesEntryId, userId);
        invalidateBookCache(userId, chatId);
      } catch (err) {
        warn(`regen: failed to delete replaced arc ${replacesEntryId}: ${describeError(err)}`);
      }
    }
    publishArcCreated(userId, {
      chatId,
      arcEntryId: arcEntry.id,
      bookId: book.id,
      sourceChapterEntryIds: selected.map((c) => c.raw.id),
      sourceMessageIds: msgIds,
      summaryText: finalArcContent,
      model: result.model,
      title: meta.title
    });
    cb?.onStateChange(userId, chatId);
    return arcEntry.id;
  });
}
async function createVolumeFromArcs(chatId, arcEntryIds, profile, settings, userId, opts = {}) {
  if (!setBusy(userId, chatId, "volume", "Memoria is pressing a volume"))
    return null;
  try {
    const entries = await listLmbEntries(chatId, userId);
    const entriesForSelection = opts.replacesEntryId ? entries.filter((e) => e.raw.id !== opts.replacesEntryId) : entries;
    const coverage = await buildCoverage(chatId, userId, entriesForSelection);
    const wanted = new Set(arcEntryIds);
    const arcs = coverage.activeEntries.filter((e) => e.meta.tier === 2 && wanted.has(e.raw.id)).sort((a, b) => storyOrderOf(a) - storyOrderOf(b));
    if (arcs.length === 0)
      return null;
    return await runVolume(chatId, profile, settings, userId, arcs, opts.replacesEntryId);
  } finally {
    clearBusy(userId, chatId, "volume");
  }
}
async function runVolume(chatId, profile, settings, userId, selected, replacesEntryId) {
  nyaaToast(userId, "volume_fire", false);
  const totalTurns = selected.reduce((acc, a) => acc + a.meta.msgIds.length, 0);
  const provisionalSceneNumber = await nextSceneNumber(chatId, 3, userId);
  const opener = buildVolumeHeader(provisionalSceneNumber, selected.length, totalTurns);
  const outcome = await runWithRetry(profile.retryCount + 1, async () => {
    const controller = new AbortController;
    registerAborter(userId, chatId, "volume", controller);
    try {
      return await summarizeVolume(profile, settings.customPresets, chatId, selected, userId, opener, {
        externalSignal: controller.signal,
        onProgress: (chars, thinking) => updateProgressNumbers(userId, chatId, "volume", chars, thinking)
      });
    } finally {
      aborters.delete(busyKey(userId, chatId, "volume"));
    }
  }, (n, err) => {
    warn(`volume attempt ${n} failed: ${describeError(err)}`);
    nyaaToast(userId, "retry", false);
  });
  if (!outcome.ok) {
    if (outcome.err instanceof AbortedSummarizerError) {
      cb?.onToast(userId, "info", "Memoria sets the pen down");
      cb?.onStateChange(userId, chatId);
      return null;
    }
    recordFailure(userId, chatId, "volume", outcome.retries, outcome.err);
    failToast(userId, "volume", outcome.err);
    cb?.onStateChange(userId, chatId);
    return null;
  }
  clearLastFailure(userId, chatId);
  const result = outcome.value;
  const firstIdxs = selected.map((a) => a.meta.firstMsgIdx).filter((n) => typeof n === "number");
  const lastIdxs = selected.map((a) => a.meta.lastMsgIdx).filter((n) => typeof n === "number");
  const firstIdx = firstIdxs.length ? Math.min(...firstIdxs) : 0;
  const lastIdx = lastIdxs.length ? Math.max(...lastIdxs) : firstIdx;
  if (profile.showMemoryPreviews) {
    const draft = makeGroupPreview("volume", selected, result, firstIdx, lastIdx, replacesEntryId);
    pushPreview(userId, chatId, draft);
    cb?.onStateChange(userId, chatId);
    return null;
  }
  try {
    const entryId = await commitVolume(chatId, userId, selected, result, firstIdx, lastIdx, replacesEntryId);
    nyaaToast(userId, "volume_success", false);
    return entryId;
  } catch (err) {
    warn(`commitVolume failed: ${describeError(err)}`);
    recordFailure(userId, chatId, "volume", 0, err);
    failToast(userId, "volume", err);
    cb?.onStateChange(userId, chatId);
    return null;
  }
}
async function commitVolume(chatId, userId, selected, result, firstIdx, lastIdx, replacesEntryId) {
  return withCommitMutex(userId, chatId, 3, async () => {
    const freshEntries = await listLmbEntries(chatId, userId);
    const entriesForCoverage = replacesEntryId ? freshEntries.filter((e) => e.raw.id !== replacesEntryId) : freshEntries;
    const freshCoverage = await buildCoverage(chatId, userId, entriesForCoverage);
    const stillActive = new Set(freshCoverage.activeEntries.filter((e) => e.meta.tier === 2).map((e) => e.raw.id));
    const filtered = selected.filter((a) => stillActive.has(a.raw.id));
    if (filtered.length === 0) {
      throw new Error("All source arcs were already bound by another volume or deleted");
    }
    if (filtered.length < selected.length) {
      selected = filtered;
      const firstIdxs = selected.map((a) => a.meta.firstMsgIdx).filter((n) => typeof n === "number");
      const lastIdxs = selected.map((a) => a.meta.lastMsgIdx).filter((n) => typeof n === "number");
      firstIdx = firstIdxs.length ? Math.min(...firstIdxs) : 0;
      lastIdx = lastIdxs.length ? Math.max(...lastIdxs) : firstIdx;
    }
    const book = await ensureBookForChat(chatId, userId);
    const replacedVolume = replacesEntryId ? freshEntries.find((e) => e.raw.id === replacesEntryId) : undefined;
    const sceneNumber = typeof replacedVolume?.meta.sceneNumber === "number" ? replacedVolume.meta.sceneNumber : await nextSceneNumber(chatId, 3, userId);
    const storyOrder = typeof replacedVolume?.meta.storyOrder === "number" ? replacedVolume.meta.storyOrder : inheritedStoryOrder(selected, entriesForCoverage);
    const msgIds = selected.flatMap((a) => a.meta.msgIds);
    const sourceArcEntryIds = selected.map((a) => a.raw.id);
    const isRootVolume = selected.length > 0 && selected.every((a) => a.meta.isRoot);
    const rootOrigin = isRootVolume ? selected.find((a) => a.meta.rootOrigin)?.meta.rootOrigin : undefined;
    if (!isRootVolume && selected.some((a) => a.meta.isRoot)) {
      const own = selected.filter((a) => !a.meta.isRoot);
      const fs = own.map((a) => a.meta.firstMsgIdx).filter((n) => typeof n === "number");
      const ls = own.map((a) => a.meta.lastMsgIdx).filter((n) => typeof n === "number");
      if (fs.length)
        firstIdx = Math.min(...fs);
      else if (firstIdx < 0)
        firstIdx = 0;
      if (ls.length)
        lastIdx = Math.max(...ls);
      else if (lastIdx < firstIdx)
        lastIdx = firstIdx;
    }
    const volumeTitle = isRootVolume ? result.title?.trim() || "Inherited Volume" : deriveTitle(result);
    const meta = {
      tier: 3,
      chatId,
      msgIds,
      sourceChapterEntryIds: sourceArcEntryIds,
      firstMsgIdx: firstIdx,
      lastMsgIdx: lastIdx,
      tokenCountInput: selected.reduce((a, e) => a + e.meta.tokenCountOutput, 0),
      tokenCountOutput: result.usageCompletionTokens || approximateTokensFromChars(result.content.length),
      model: result.model,
      connectionId: result.connectionId,
      createdAt: Date.now(),
      title: volumeTitle,
      shortComment: result.shortComment,
      presetKey: result.presetKey,
      sceneNumber,
      storyOrder,
      rawOutput: result.rawOutput,
      ...isRootVolume ? { isRoot: true, rootOrigin } : {}
    };
    const volumeSettings = await loadSettings(userId);
    const comment = await formatEntryName(volumeSettings, {
      chatId,
      userId,
      tier: "volume",
      title: meta.title ?? "",
      sceneNumber,
      storyOrder,
      firstMsgIdx: meta.firstMsgIdx,
      lastMsgIdx: meta.lastMsgIdx,
      sourceCount: sourceArcEntryIds.length,
      turnCount: msgIds.length,
      isRoot: isRootVolume
    });
    const volumeOpener = buildVolumeHeader(sceneNumber, sourceArcEntryIds.length, msgIds.length);
    const finalVolumeContent = savedMemoryContent(volumeSettings, volumeOpener, result.content);
    const volumeEntry = await createChapterEntry(book.id, meta, finalVolumeContent, comment, userId, result.keywords ?? [], volumeSettings.forceConstantEntries);
    const failedSupersedes = [];
    for (const arc of selected) {
      try {
        await patchEntryMeta(arc, { supersededByEntryId: volumeEntry.id }, userId);
      } catch (err) {
        failedSupersedes.push(arc.raw.id);
        warn(`failed to mark arc ${arc.raw.id} superseded by volume ${volumeEntry.id}: ${describeError(err)}`);
      }
    }
    if (failedSupersedes.length > 0) {
      cb?.onToast(userId, "warn", `The volume saved but ${failedSupersedes.length} arc${failedSupersedes.length === 1 ? "" : "s"} couldn't be marked superseded`);
    }
    invalidateBookCache(userId, chatId);
    if (replacesEntryId) {
      try {
        await deleteEntry(replacesEntryId, userId);
        invalidateBookCache(userId, chatId);
      } catch (err) {
        warn(`regen: failed to delete replaced volume ${replacesEntryId}: ${describeError(err)}`);
      }
    }
    publishVolumeCreated(userId, {
      chatId,
      volumeEntryId: volumeEntry.id,
      bookId: book.id,
      sourceArcEntryIds,
      sourceMessageIds: msgIds,
      summaryText: finalVolumeContent,
      model: result.model,
      title: meta.title
    });
    cb?.onStateChange(userId, chatId);
    return volumeEntry.id;
  });
}
async function acceptPreview(chatId, draftId, profile, userId) {
  const preview = findPendingPreview(userId, chatId, draftId);
  if (!preview)
    return null;
  const guardKey = `${userId}::${chatId}::${draftId}`;
  if (committingDrafts.has(guardKey))
    return null;
  committingDrafts.add(guardKey);
  try {
    if (preview.kind === "chapter") {
      const messages = await spindle.chat.getMessages(chatId);
      const acceptEntries = preview.replacesEntryId ? (await listLmbEntries(chatId, userId)).filter((e) => e.raw.id !== preview.replacesEntryId) : undefined;
      const coverage2 = await buildCoverage(chatId, userId, acceptEntries);
      const intent = new Set(preview.sourceMessageIds);
      const window = messages.filter((m) => intent.has(m.id) && !coverage2.coveredBy.has(m.id) && !isExcluded(m));
      if (window.length === 0) {
        dropPendingPreview(userId, chatId, draftId);
        cb?.onToast(userId, "warn", "Memoria can't save this chapter, its messages were deleted or already filed");
        cb?.onStateChange(userId, chatId);
        return null;
      }
      if (window.length < preview.sourceMessageIds.length) {
        cb?.onToast(userId, "warn", "Some messages were missing or already covered, Memoria saved the rest");
      }
      const firstIdx = messages.findIndex((m) => m.id === window[0].id);
      const lastIdx = messages.findIndex((m) => m.id === window[window.length - 1].id);
      const fakeResult2 = {
        rawOutput: preview.content,
        title: preview.title,
        opener: "",
        content: preview.content,
        keywords: [],
        shortComment: preview.shortComment,
        usagePromptTokens: preview.tokenCountInput,
        usageCompletionTokens: preview.tokenCountOutput,
        model: preview.model,
        connectionId: preview.connectionId,
        presetKey: preview.presetKey
      };
      try {
        const entryId = await commitChapter(chatId, profile, userId, window, fakeResult2, firstIdx, lastIdx, messages, true, preview.replacesEntryId);
        dropPendingPreview(userId, chatId, draftId);
        nyaaToast(userId, "success", false);
        cb?.onStateChange(userId, chatId);
        return entryId;
      } catch (err) {
        recordFailure(userId, chatId, "chapter", 0, err);
        failToast(userId, "chapter", err);
        cb?.onStateChange(userId, chatId);
        return null;
      }
    }
    const isVolume = preview.kind === "volume";
    const entries = await listLmbEntries(chatId, userId);
    const groupSelectionEntries = preview.replacesEntryId ? entries.filter((e) => e.raw.id !== preview.replacesEntryId) : entries;
    const coverage = await buildCoverage(chatId, userId, groupSelectionEntries);
    const wanted = new Set(preview.sourceChapterEntryIds ?? []);
    const sourceTier = isVolume ? 2 : 1;
    const selected = coverage.activeEntries.filter((e) => e.meta.tier === sourceTier && wanted.has(e.raw.id));
    if (selected.length === 0) {
      dropPendingPreview(userId, chatId, draftId);
      cb?.onToast(userId, "warn", isVolume ? "Memoria can't save this volume, its arcs were deleted or already bound" : "Memoria can't save this arc, its chapters were deleted or already bound");
      cb?.onStateChange(userId, chatId);
      return null;
    }
    const fakeResult = {
      rawOutput: preview.content,
      title: preview.title,
      opener: "",
      content: preview.content,
      keywords: [],
      shortComment: preview.shortComment,
      usagePromptTokens: preview.tokenCountInput,
      usageCompletionTokens: preview.tokenCountOutput,
      model: preview.model,
      connectionId: preview.connectionId,
      presetKey: preview.presetKey
    };
    try {
      const entryId = isVolume ? await commitVolume(chatId, userId, selected, fakeResult, preview.firstMsgIdx ?? 0, preview.lastMsgIdx ?? 0, preview.replacesEntryId) : await commitArc(chatId, userId, selected, fakeResult, preview.firstMsgIdx ?? 0, preview.lastMsgIdx ?? 0, preview.replacesEntryId);
      dropPendingPreview(userId, chatId, draftId);
      nyaaToast(userId, isVolume ? "volume_success" : "arc_success", false);
      cb?.onStateChange(userId, chatId);
      return entryId;
    } catch (err) {
      recordFailure(userId, chatId, isVolume ? "volume" : "arc", 0, err);
      failToast(userId, isVolume ? "volume" : "arc", err);
      cb?.onStateChange(userId, chatId);
      return null;
    }
  } finally {
    committingDrafts.delete(guardKey);
  }
}
var CHAPTER_BACKLOG_CAP = 500;
var ARC_BACKLOG_CAP = 100;
async function drainChapterBacklog(chatId, profile, settings, userId, automation = false) {
  let made = 0;
  for (let i = 0;i < CHAPTER_BACKLOG_CAP; i++) {
    const created = await createChapterAuto(chatId, profile, settings, userId, automation).catch((err) => {
      warn(`createChapterAuto failed: ${describeError(err)}`);
      return null;
    });
    if (!created)
      break;
    made++;
  }
  return made;
}
async function dryRunChapter(chatId, profile, settings, userId) {
  const messages = await spindle.chat.getMessages(chatId);
  if (!messages || messages.length === 0)
    throw new Error("Chat has no messages");
  const entries = await listLmbEntries(chatId, userId);
  const coverage = await buildCoverage(chatId, userId, entries);
  const uncoveredTail = pickUncoveredTail(messages, coverage);
  const window = selectNextChapterWindow(uncoveredTail, profile);
  if (window.length === 0) {
    throw new Error("No window available, lower the lag or window thresholds");
  }
  const chapters = coverage.activeEntries.filter((e) => e.meta.tier === 1 && typeof e.meta.firstMsgIdx === "number").sort((a, b) => storyOrderOf(a) - storyOrderOf(b));
  const previousMemories = profile.previousMemoriesCount > 0 ? chapters.slice(-profile.previousMemoriesCount) : [];
  const provisionalSceneNumber = await nextSceneNumber(chatId, 1, userId);
  const opener = buildChapterHeader(provisionalSceneNumber, window.length);
  return assembleChapterPrompt(profile, settings.customPresets, chatId, window, previousMemories, userId, opener);
}
async function dryRunArc(chatId, profile, settings, userId) {
  const entries = await listLmbEntries(chatId, userId);
  const coverage = await buildCoverage(chatId, userId, entries);
  const chapters = coverage.activeEntries.filter((e) => e.meta.tier === 1 && !e.meta.isRoot).sort((a, b) => storyOrderOf(a) - storyOrderOf(b));
  if (chapters.length === 0)
    throw new Error("No chapters to bind yet");
  const totalTurns = chapters.reduce((acc, c) => acc + c.meta.msgIds.length, 0);
  const provisionalSceneNumber = await nextSceneNumber(chatId, 2, userId);
  const opener = buildArcHeader(provisionalSceneNumber, chapters.length, totalTurns);
  return assembleArcPrompt(profile, settings.customPresets, chatId, chapters, userId, opener);
}
async function dryRunVolume(chatId, profile, settings, userId) {
  const entries = await listLmbEntries(chatId, userId);
  const coverage = await buildCoverage(chatId, userId, entries);
  const arcs = coverage.activeEntries.filter((e) => e.meta.tier === 2 && !e.meta.isRoot).sort((a, b) => storyOrderOf(a) - storyOrderOf(b));
  if (arcs.length === 0)
    throw new Error("No arcs to press yet");
  const totalTurns = arcs.reduce((acc, a) => acc + a.meta.msgIds.length, 0);
  const provisionalSceneNumber = await nextSceneNumber(chatId, 3, userId);
  const opener = buildVolumeHeader(provisionalSceneNumber, arcs.length, totalTurns);
  return assembleVolumePrompt(profile, settings.customPresets, chatId, arcs, userId, opener);
}
async function drainArcBacklog(chatId, profile, settings, userId, automation = false) {
  if (profile.arcTrigger === "manual")
    return 0;
  let made = 0;
  for (let i = 0;i < ARC_BACKLOG_CAP; i++) {
    const created = await createArcAuto(chatId, profile, settings, userId, automation).catch((err) => {
      warn(`createArcAuto failed: ${describeError(err)}`);
      return null;
    });
    if (!created)
      break;
    made++;
  }
  return made;
}
async function maybeRunPipeline(chatId, profile, settings, userId) {
  if (!profile.autoCreate)
    return;
  await ensureForkAdoption(chatId, userId).catch(() => {});
  if (profile.autoCreateChapter) {
    await drainChapterBacklog(chatId, profile, settings, userId, true);
  }
  await maybeRunArcCheck(chatId, profile, settings, userId, true);
}
async function maybeRunArcCheck(chatId, profile, settings, userId, automation = false) {
  if (!profile.autoCreate)
    return;
  if (!profile.autoCreateArc)
    return;
  if (profile.arcTrigger === "manual")
    return;
  await drainArcBacklog(chatId, profile, settings, userId, automation);
}
async function nextSceneNumber(chatId, tier, userId) {
  const entries = await listLmbEntries(chatId, userId).catch(() => []);
  let max = 0;
  for (const e of entries) {
    if (e.meta.tier !== tier)
      continue;
    if (e.meta.isRoot)
      continue;
    const n = e.meta.sceneNumber;
    if (typeof n === "number" && n > max)
      max = n;
  }
  return max + 1;
}
function deriveTitle(result) {
  if (result.title && result.title.trim())
    return result.title.trim();
  const firstLine = (result.content.split(/\n+/, 1)[0] || "").trim();
  const firstSentence = firstLine.split(/(?<=[.!?])\s/, 1)[0] || firstLine;
  const trimmed = firstSentence.slice(0, 60).trim();
  if (trimmed)
    return `${trimmed}${trimmed.length === 60 ? "..." : ""}`;
  return "Compressed";
}
function chatMessageIndex(message) {
  const idx = message.index_in_chat;
  return typeof idx === "number" && Number.isFinite(idx) ? idx : undefined;
}
function makePreview(kind, chatId, window, result, firstIdx, lastIdx, replacesEntryId) {
  return {
    kind,
    draftId: `draft_${kind}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    title: result.title || `Chapter - msgs ${firstIdx + 1}-${lastIdx + 1}`,
    content: result.content,
    shortComment: result.shortComment,
    sourceMessageIds: window.map((m) => m.id),
    model: result.model,
    connectionId: result.connectionId,
    tokenCountInput: result.usagePromptTokens || 0,
    tokenCountOutput: result.usageCompletionTokens || 0,
    firstMsgIdx: firstIdx,
    lastMsgIdx: lastIdx,
    presetKey: result.presetKey,
    replacesEntryId
  };
}
function makeGroupPreview(kind, selected, result, firstIdx, lastIdx, replacesEntryId) {
  return {
    kind,
    draftId: `draft_${kind}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    title: result.title || `${kind === "volume" ? "Volume" : "Arc"} - msgs ${firstIdx + 1}-${lastIdx + 1}`,
    content: result.content,
    shortComment: result.shortComment,
    sourceMessageIds: selected.flatMap((c) => c.meta.msgIds),
    sourceChapterEntryIds: selected.map((c) => c.raw.id),
    model: result.model,
    connectionId: result.connectionId,
    tokenCountInput: result.usagePromptTokens || 0,
    tokenCountOutput: result.usageCompletionTokens || 0,
    firstMsgIdx: firstIdx,
    lastMsgIdx: lastIdx,
    presetKey: result.presetKey,
    replacesEntryId
  };
}

// src/backend/rebase.ts
var inFlight = new Set;
function lockKey(userId, chatId) {
  return `${userId}::${chatId}`;
}
function ownEntries(entries) {
  return entries.filter((e) => !e.meta.isRoot);
}
function computeNegativeOrder(entries) {
  const sorted = [...entries].sort((a, b) => (a.meta.firstMsgIdx ?? 0) - (b.meta.firstMsgIdx ?? 0));
  const n = sorted.length;
  const order = new Map;
  sorted.forEach((e, i) => order.set(e.raw.id, -(n - i)));
  return order;
}
async function seedRoot(targetChatId, sourceChatId, sourceEntries, existingRoots, userId) {
  const book = await ensureBookForChat(targetChatId, userId);
  const negIdx = computeNegativeOrder(sourceEntries);
  const transform = (entry) => {
    const idx = negIdx.get(entry.raw.id);
    const baseComment = entry.raw.comment || "";
    return {
      msgIds: entry.meta.msgIds.slice(),
      firstMsgIdx: idx,
      lastMsgIdx: idx,
      extra: { chatId: targetChatId, isRoot: true, rootOrigin: sourceChatId },
      comment: baseComment.startsWith("[Root]") ? baseComment : `[Root] ${baseComment}`.trim()
    };
  };
  const idMap = await copyLmbEntries(book.id, sourceEntries, userId, transform);
  for (const r of existingRoots) {
    await deleteEntry(r.raw.id, userId).catch((err) => warn(`rebase: failed to drop old root ${r.raw.id}: ${describeError(err)}`));
  }
  invalidateBookCache(userId, targetChatId);
  invalidateRootCandidates(userId);
  info(`rebased ${targetChatId.slice(0, 8)} onto root from ${sourceChatId.slice(0, 8)} (${idMap.size} entries)`);
  return { count: idMap.size, newIds: new Set(idMap.values()) };
}
async function rebaseRoot(targetChatId, sourceChatId, userId) {
  if (sourceChatId === targetChatId)
    return { ok: false, reason: "same_chat" };
  const key2 = lockKey(userId, targetChatId);
  if (inFlight.has(key2))
    return { ok: false, reason: "busy" };
  inFlight.add(key2);
  try {
    const targetEntries = await listLmbEntries(targetChatId, userId);
    if (ownEntries(targetEntries).some((e) => !e.raw.disabled))
      return { ok: false, reason: "has_own" };
    const sourceEntries = (await listLmbEntries(sourceChatId, userId)).filter((e) => !e.raw.disabled);
    if (sourceEntries.length === 0)
      return { ok: false, reason: "empty_source" };
    const existingRoots = targetEntries.filter((e) => e.meta.isRoot);
    const { count } = await seedRoot(targetChatId, sourceChatId, sourceEntries, existingRoots, userId);
    return { ok: true, count };
  } finally {
    inFlight.delete(key2);
  }
}
async function rebuildRoot(targetChatId, sourceChatId, userId) {
  if (sourceChatId === targetChatId)
    return { ok: false, reason: "same_chat" };
  const key2 = lockKey(userId, targetChatId);
  if (inFlight.has(key2))
    return { ok: false, reason: "busy" };
  inFlight.add(key2);
  try {
    const sourceEntries = (await listLmbEntries(sourceChatId, userId)).filter((e) => !e.raw.disabled);
    if (sourceEntries.length === 0)
      return { ok: false, reason: "empty_source" };
    const { count, newIds } = await seedRoot(targetChatId, sourceChatId, sourceEntries, [], userId);
    const after = await listLmbEntries(targetChatId, userId);
    const survivors = [];
    for (const e of after) {
      if (newIds.has(e.raw.id))
        continue;
      try {
        await deleteEntry(e.raw.id, userId);
      } catch (err) {
        warn(`rebuild: failed to delete ${e.raw.id}: ${describeError(err)}`);
        survivors.push(e);
      }
    }
    for (const e of survivors) {
      await setEntryDisabled(e.raw.id, true, userId).catch(() => {});
    }
    invalidateBookCache(userId, targetChatId);
    invalidateRootCandidates(userId);
    return { ok: true, count };
  } finally {
    inFlight.delete(key2);
  }
}
async function detachRoot(targetChatId, userId) {
  const entries = await listLmbEntries(targetChatId, userId);
  const roots = entries.filter((e) => e.meta.isRoot);
  for (const r of roots) {
    await deleteEntry(r.raw.id, userId).catch((err) => warn(`detach: failed to delete root ${r.raw.id}: ${describeError(err)}`));
  }
  if (roots.length > 0) {
    invalidateBookCache(userId, targetChatId);
    invalidateRootCandidates(userId);
  }
  return roots.length;
}

// src/backend/state.ts
async function buildState(userId, requestedChatId) {
  const settings = await loadSettings(userId);
  const activeProfile = settings.profiles.find((p) => p.id === settings.activeProfileId) ?? settings.profiles[0];
  let chat;
  if (requestedChatId) {
    chat = await spindle.chats.get(requestedChatId, userId).catch(() => null);
  } else {
    chat = await spindle.chats.getActive(userId).catch(() => null);
  }
  const [connectionsRaw, regexScriptsRaw, rootCandidatesRaw] = await Promise.all([
    listConnections(userId),
    listRegexScripts(userId),
    listRootCandidates(userId).catch(() => [])
  ]);
  const connections = connectionsRaw.map((c) => ({
    id: c.id,
    name: c.name,
    provider: c.provider,
    model: c.model,
    isDefault: c.is_default,
    hasApiKey: c.has_api_key
  }));
  const regexScripts = regexScriptsRaw.map((s) => ({ id: s.id, name: s.name }));
  const allRootCandidates = rootCandidatesRaw.map((c) => ({
    chatId: c.chatId,
    chatName: c.chatName,
    entryCount: c.entryCount
  }));
  const resolved = await resolveConnection(activeProfile, userId).catch(() => null);
  const baseState = {
    activeChatId: null,
    activeChatName: null,
    activeCharacterId: null,
    activeCharacterName: null,
    settings,
    activeProfile,
    chapters: [],
    arcs: [],
    volumes: [],
    bookId: null,
    bookName: null,
    connections,
    resolvedSidecarConnectionId: resolved?.id ?? null,
    coverage: {
      totalMessages: 0,
      coveredMessages: 0,
      uncoveredMessages: 0,
      approxUncoveredTokens: 0,
      lagSatisfied: false,
      windowAvailable: false
    },
    busy: getBusy(userId),
    lastFailure: null,
    messages: [],
    chapterPresets: BUILTIN_CHAPTER_PRESETS,
    arcPresets: BUILTIN_ARC_PRESETS,
    volumePresets: BUILTIN_VOLUME_PRESETS,
    customPresets: settings.customPresets,
    regexScripts,
    pendingPreviews: [],
    backlogChapters: 0,
    backlogArcs: 0,
    rootOrigin: null,
    rootOriginName: null,
    rootEntryCount: 0,
    availableRoots: allRootCandidates
  };
  if (!chat)
    return baseState;
  if (settings.enabled) {
    await ensureForkAdoption(chat.id, userId).catch(() => {});
    await reassertChatBinding(chat.id, userId).catch(() => {});
  }
  const bookId = await findBookForChat(chat.id, userId);
  const bookName = bookId !== null ? (await spindle.world_books.get(bookId, userId).catch(() => null))?.name ?? null : null;
  let messages = [];
  try {
    messages = await spindle.chat.getMessages(chat.id);
  } catch (err) {
    warn(`failed to read messages for chat ${chat.id.slice(0, 8)}: ${describeError(err)}`);
  }
  const entries = await listLmbEntries(chat.id, userId).catch(() => []);
  const coverage = await buildCoverage(chat.id, userId, entries);
  const stats = computeCoverageStats(messages, coverage, activeProfile);
  const compressibleSize = countCompressibleEligible(messages, coverage, activeProfile);
  const windowDenom = Math.max(1, activeProfile.windowValue);
  const backlogChapters = Math.max(0, Math.floor(compressibleSize / windowDenom));
  const activeChapterEntries = coverage.activeEntries.filter((e) => e.meta.tier === 1 && !e.meta.isRoot);
  const backlogArcs = countArcBacklog(activeChapterEntries, activeProfile);
  const supersededIds = new Set;
  for (const e of entries) {
    if (e.meta.tier !== 1 && !e.raw.disabled && Array.isArray(e.meta.sourceChapterEntryIds)) {
      for (const sid of e.meta.sourceChapterEntryIds)
        supersededIds.add(sid);
    }
  }
  const chapters = [];
  const arcs = [];
  const volumes = [];
  for (const e of entries) {
    const view = {
      entryId: e.raw.id,
      bookId: e.raw.world_book_id,
      comment: e.raw.comment || "",
      content: e.raw.content || "",
      meta: e.meta,
      active: !(supersededIds.has(e.raw.id) || e.raw.disabled),
      contentTokens: approximateTokensFromChars((e.raw.content || "").length),
      contentChars: (e.raw.content || "").length,
      sourceTokensInput: e.meta.tokenCountInput || 0,
      isRoot: !!e.meta.isRoot
    };
    if (e.meta.tier === 3) {
      volumes.push({ ...view, sourceChapterEntryIds: e.meta.sourceChapterEntryIds ?? [] });
    } else if (e.meta.tier === 2) {
      arcs.push({ ...view, sourceChapterEntryIds: e.meta.sourceChapterEntryIds ?? [] });
    } else {
      chapters.push(view);
    }
  }
  chapters.sort((a, b) => storyOrderFromMeta(a.meta) - storyOrderFromMeta(b.meta));
  arcs.sort((a, b) => storyOrderFromMeta(a.meta) - storyOrderFromMeta(b.meta));
  volumes.sort((a, b) => storyOrderFromMeta(a.meta) - storyOrderFromMeta(b.meta));
  const messageStubs = messages.map((m) => {
    const covered = coverage.coveredBy.get(m.id) ?? null;
    const hidden = !!(m.extra && m.extra.hidden);
    const excluded = !!(m.metadata?.["lmb_excluded"] === true);
    const preview = (m.content || "").slice(0, 220).replace(/\s+/g, " ").trim();
    const charCount = (m.content || "").length;
    return {
      id: m.id,
      role: m.role,
      preview,
      charCount,
      approxTokens: approximateTokensFromChars(charCount),
      hidden,
      covered: !!covered,
      coveredByEntryId: covered,
      indexInChat: m.index_in_chat,
      excluded
    };
  });
  let characterName = null;
  if (chat.character_id) {
    try {
      const character = await spindle.characters.get(chat.character_id, userId);
      characterName = character?.name ?? null;
    } catch (_) {}
  }
  const rootEntries = entries.filter((e) => e.meta.isRoot);
  const rootOrigin = rootEntries.find((e) => e.meta.rootOrigin)?.meta.rootOrigin ?? null;
  const rootOriginName = rootOrigin ? allRootCandidates.find((c) => c.chatId === rootOrigin)?.chatName ?? rootOrigin.slice(0, 8) : null;
  return {
    ...baseState,
    activeChatId: chat.id,
    activeChatName: chat.name,
    activeCharacterId: chat.character_id,
    activeCharacterName: characterName,
    chapters,
    arcs,
    volumes,
    bookId,
    bookName,
    coverage: stats,
    lastFailure: getLastFailure(userId, chat.id),
    messages: messageStubs,
    pendingPreviews: getPendingPreviews(userId, chat.id),
    backlogChapters,
    backlogArcs,
    rootOrigin,
    rootOriginName,
    rootEntryCount: rootEntries.length,
    availableRoots: allRootCandidates.filter((c) => c.chatId !== chat.id)
  };
}
function countArcBacklog(activeChapters, profile) {
  if (profile.arcTrigger === "manual")
    return 0;
  const chapters = activeChapters.slice().sort((a, b) => storyOrderOf(a) - storyOrderOf(b));
  if (profile.arcTrigger === "chapters") {
    const compressible2 = Math.max(0, chapters.length - profile.arcLagChapters);
    const denom = Math.max(1, profile.arcAfterChapters);
    return Math.floor(compressible2 / denom);
  }
  let reservedTokens = 0;
  let cutoff = chapters.length;
  for (let i = chapters.length - 1;i >= 0 && reservedTokens < profile.arcLagTokens; i--) {
    reservedTokens += chapters[i].meta.tokenCountOutput;
    cutoff = i;
  }
  const compressible = chapters.slice(0, cutoff);
  let arcs = 0;
  let acc = 0;
  for (const ch of compressible) {
    acc += ch.meta.tokenCountOutput;
    if (acc >= profile.arcAfterTokens) {
      arcs++;
      acc = 0;
    }
  }
  return arcs;
}

// src/backend/projection.ts
function isProjection(entry, chatId) {
  const ext = entry.extensions || {};
  const meta = ext[PROJECTION_KEY];
  return !!meta && meta.kind === "outlet" && meta.chatId === chatId;
}
function orderValueFor(meta, fallback) {
  if (!meta)
    return fallback;
  return storyOrderFromMeta(meta, fallback);
}
async function updateEntry2(entry, patch, userId) {
  await spindle.world_books.entries.update(entry.id, patch, userId);
}
async function syncProjectionEntry(chatId, userId) {
  try {
    const bookId = await findBookForChat(chatId, userId).catch(() => null);
    if (!bookId)
      return;
    const settings = await loadSettings(userId);
    const outletMode = settings.enabled;
    const outletName = normalizeOutletName(settings.memoryOutletName);
    const entries = await listAllEntries(bookId, userId);
    let touched = false;
    for (const entry of entries) {
      if (!isProjection(entry, chatId))
        continue;
      await spindle.world_books.entries.delete(entry.id, userId).catch((err) => {
        warn(`outlet migration: failed to delete projection ${entry.id}: ${describeError(err)}`);
      });
      touched = true;
    }
    for (const entry of entries) {
      const ext = entry.extensions || {};
      const meta = normalizeEntryMeta(ext[EXTENSION_KEY]);
      if (!meta || meta.chatId !== chatId)
        continue;
      const orderValue = orderValueFor(meta, entry.order_value);
      const currentOutletName = (entry.outlet_name ?? "").trim();
      const patch = outletMode ? {
        position: 8,
        outlet_name: outletName,
        constant: true,
        order_value: orderValue
      } : {
        position: 0,
        outlet_name: "",
        order_value: orderValue
      };
      const needsPatch = entry.position !== patch.position || entry.order_value !== orderValue || outletMode && entry.constant !== true || currentOutletName !== patch.outlet_name;
      if (!needsPatch)
        continue;
      await updateEntry2(entry, patch, userId);
      touched = true;
    }
    if (touched)
      invalidateBookCache(userId, chatId);
  } catch (err) {
    warn(`syncProjectionEntry failed: ${describeError(err)}`);
  }
}

// src/backend/naming-sync.ts
async function syncNamingForChat(chatId, userId) {
  const settings = await loadSettings(userId);
  const bookId = await findBookForChat(chatId, userId);
  if (!bookId)
    return;
  const chat = await spindle.chats.get(chatId, userId).catch(() => null);
  const book = await spindle.world_books.get(bookId, userId).catch(() => null);
  if (book) {
    const bookMeta = book.metadata && typeof book.metadata === "object" ? book.metadata : {};
    const preserveBookName = bookMeta["lumibooks_preserve_name"] === true;
    const nextName = preserveBookName ? "" : await formatBookName(settings, chatId, userId, chat?.name);
    if (!preserveBookName && nextName && nextName !== book.name) {
      await spindle.world_books.update(book.id, { name: nextName }, userId).catch((err) => {
        warn(`book rename failed: ${describeError(err)}`);
      });
    }
  }
  const entries = await listLmbEntries(chatId, userId).catch(() => []);
  for (const entry of entries) {
    const tier = entry.meta.tier === 3 ? "volume" : entry.meta.tier === 2 ? "arc" : "chapter";
    const nextComment = await formatEntryName(settings, {
      chatId,
      userId,
      tier,
      title: entry.meta.title ?? "",
      sceneNumber: entry.meta.sceneNumber ?? 1,
      storyOrder: entry.meta.storyOrder,
      firstMsgIdx: entry.meta.firstMsgIdx,
      lastMsgIdx: entry.meta.lastMsgIdx,
      sourceCount: entry.meta.sourceChapterEntryIds?.length,
      turnCount: entry.meta.msgIds.length,
      isRoot: entry.meta.isRoot
    });
    const rawContent = entry.raw.content || "";
    const nextContent = settings.includeContentHeaders ? rawContent : stripGeneratedHeader(rawContent);
    const patch = {};
    if (isAdoptedEntry(entry.meta)) {
      const ext = entry.raw.extensions || {};
      const nextMeta = { ...entry.meta, preserveComment: true };
      const repaired = repairLegacyAdoptedComment(entry.raw.comment || "");
      if (!entry.meta.preserveComment)
        patch.extensions = { ...ext, [EXTENSION_KEY]: nextMeta };
      if (repaired && repaired !== entry.raw.comment)
        patch.comment = repaired;
    } else if (!entry.meta.preserveComment && nextComment && nextComment !== entry.raw.comment) {
      patch.comment = nextComment;
    }
    if (nextContent !== rawContent)
      patch.content = nextContent;
    if (Object.keys(patch).length === 0)
      continue;
    await updateEntry(entry.raw.id, patch, userId).catch((err) => {
      warn(`entry rename failed for ${entry.raw.id}: ${describeError(err)}`);
    });
  }
  invalidateBookCache(userId, chatId);
}
function isAdoptedEntry(meta) {
  return meta.model === "adopted" || meta.connectionId === "adopted";
}
function repairLegacyAdoptedComment(comment) {
  let next = comment.replace(/\s+\(\d+\)?\s*$/, "").trim();
  const opens = (next.match(/\(/g) ?? []).length;
  const closes = (next.match(/\)/g) ?? []).length;
  if (opens > closes)
    next += ")".repeat(opens - closes);
  return next;
}

// src/backend/import-lorebook.ts
var RANGE_PATTERNS = [
  /\((?:msgs?|messages?)?\s*(\d{1,6})\s*[-\u2013\u2014]\s*(\d{1,6})\)/i,
  /\bmsgs?\s*(\d{1,6})\s*[-\u2013\u2014]\s*(\d{1,6})\b/i,
  /\bmessages?\s*(\d{1,6})\s*[-\u2013\u2014]\s*(\d{1,6})\b/i
];
async function importAttachedLorebooks(chatId, userId) {
  const settings = await loadSettings(userId);
  const targetBook = await ensureBookForChat(chatId, userId);
  const attachedIds = await getChatAttachedBookIds(chatId, userId);
  const sourceBookIds = [...new Set(attachedIds.filter((id) => id !== targetBook.id))];
  const messages = await spindle.chat.getMessages(chatId);
  const existing = await listLmbEntries(chatId, userId);
  const existingRanges = new Set(existing.filter((entry) => entry.meta.tier === 1).map((entry) => `${entry.meta.firstMsgIdx ?? -1}:${entry.meta.lastMsgIdx ?? -1}`));
  const occupiedRanges = existing.filter((entry) => entry.meta.tier === 1).map((entry) => ({
    first: entry.meta.firstMsgIdx ?? -1,
    last: entry.meta.lastMsgIdx ?? -1
  })).filter((range) => range.first >= 0 && range.last >= range.first);
  const candidates = [];
  let skippedNoRange = 0;
  let skippedDuplicate = 0;
  let skippedInvalidRange = 0;
  let scannedBooks = 0;
  let hideThroughIdx;
  const details = [];
  for (const bookId of sourceBookIds) {
    const book = await spindle.world_books.get(bookId, userId).catch(() => null);
    if (!book)
      continue;
    scannedBooks++;
    const entries = await listAllEntries(bookId, userId).catch(() => []);
    const parsedEntries = [];
    for (const entry of entries) {
      if (entry.disabled)
        continue;
      const ext = entry.extensions || {};
      if (ext[EXTENSION_KEY])
        continue;
      const parsed = parseRange(entry.comment || entry.content.split(/\n+/, 1)[0] || "");
      if (!parsed) {
        skippedNoRange++;
        addDetail(details, `${entryLabel(entry)}: no range`);
        continue;
      }
      parsedEntries.push({ entry, parsed });
    }
    const zeroBasedBook = parsedEntries.some(({ parsed }) => parsed.start === 0);
    for (const { entry, parsed } of parsedEntries) {
      const resolved = resolveRange(parsed.start, parsed.end, messages.length, zeroBasedBook);
      if (!resolved) {
        skippedInvalidRange++;
        addDetail(details, `${entryLabel(entry)}: invalid range ${parsed.start}-${parsed.end} for ${messages.length} chat messages`);
        continue;
      }
      const { firstMsgIdx, lastMsgIdx } = resolved;
      const key2 = `${firstMsgIdx}:${lastMsgIdx}`;
      if (existingRanges.has(key2)) {
        skippedDuplicate++;
        addDetail(details, `${entryLabel(entry)}: duplicate range`);
        continue;
      }
      if (occupiedRanges.some((range) => rangesOverlap(firstMsgIdx, lastMsgIdx, range.first, range.last))) {
        skippedDuplicate++;
        addDetail(details, `${entryLabel(entry)}: overlapping range`);
        continue;
      }
      existingRanges.add(key2);
      occupiedRanges.push({ first: firstMsgIdx, last: lastMsgIdx });
      candidates.push({
        source: entry,
        firstMsgIdx,
        lastMsgIdx,
        title: cleanTitle(entry.comment, parsed.raw) || cleanTitle(entry.content.split(/\n+/, 1)[0] || "", parsed.raw) || "Imported Memory"
      });
    }
  }
  candidates.sort((a, b) => a.firstMsgIdx - b.firstMsgIdx);
  const maxScene = existing.reduce((max, entry) => {
    if (entry.meta.tier !== 1 || entry.meta.isRoot)
      return max;
    return Math.max(max, entry.meta.sceneNumber ?? 0);
  }, 0);
  const firstStoryOrder = nextStoryOrder(existing);
  let imported = 0;
  for (const candidate of candidates) {
    const msgIds = messages.slice(candidate.firstMsgIdx, candidate.lastMsgIdx + 1).map((message) => message.id);
    const sceneNumber = maxScene + imported + 1;
    const storyOrder = firstStoryOrder + imported;
    const meta = {
      tier: 1,
      chatId,
      msgIds,
      firstMsgIdx: candidate.firstMsgIdx,
      lastMsgIdx: candidate.lastMsgIdx,
      tokenCountInput: 0,
      tokenCountOutput: approximateTokensFromChars((candidate.source.content || "").length),
      model: "imported",
      connectionId: "imported",
      createdAt: candidate.source.created_at || Date.now(),
      title: candidate.title,
      sceneNumber,
      storyOrder
    };
    const comment = await formatEntryName(settings, {
      chatId,
      userId,
      tier: "chapter",
      title: meta.title ?? "",
      sceneNumber,
      storyOrder,
      firstMsgIdx: meta.firstMsgIdx,
      lastMsgIdx: meta.lastMsgIdx,
      turnCount: msgIds.length
    });
    await createChapterEntry(targetBook.id, meta, candidate.source.content || "", comment, userId, candidate.source.key ?? [], settings.forceConstantEntries);
    hideThroughIdx = hideThroughIdx === undefined ? candidate.lastMsgIdx : Math.max(hideThroughIdx, candidate.lastMsgIdx);
    imported++;
  }
  if (imported > 0)
    invalidateBookCache(userId, chatId);
  return { imported, skippedNoRange, skippedDuplicate, skippedInvalidRange, scannedBooks, details, hideThroughIdx };
}
async function listAdoptLorebookCandidates(chatId, userId) {
  const targetBookId = await findBookForChat(chatId, userId).catch(() => null);
  const attachedIds = await getChatAttachedBookIds(chatId, userId);
  const sourceBookIds = [...new Set(attachedIds.filter((id) => id !== targetBookId))];
  const books = [];
  for (const bookId of sourceBookIds) {
    const book = await spindle.world_books.get(bookId, userId).catch(() => null);
    if (!book)
      continue;
    const entries = await listAllEntries(bookId, userId).catch(() => []);
    const drafts = entries.filter((entry) => !entry.disabled).sort((a, b) => {
      if (a.order_value !== b.order_value)
        return a.order_value - b.order_value;
      return a.created_at - b.created_at;
    }).map((entry) => {
      const ext = entry.extensions || {};
      return {
        entryId: entry.id,
        comment: entry.comment || "(untitled)",
        preview: (entry.content || "").slice(0, 220).replace(/\s+/g, " ").trim(),
        orderValue: entry.order_value,
        contentChars: (entry.content || "").length,
        alreadyManaged: !!ext[EXTENSION_KEY]
      };
    });
    if (drafts.length > 0)
      books.push({ bookId: book.id, name: book.name || book.id, entries: drafts });
  }
  return books;
}
async function confirmAdoptLorebook(chatId, userId, bookId, plan) {
  const settings = await loadSettings(userId);
  await adoptBookForChat(chatId, bookId, userId);
  const existing = await listLmbEntries(chatId, userId);
  const sceneCounts = new Map([
    [1, 0],
    [2, 0],
    [3, 0]
  ]);
  for (const entry of existing) {
    if (entry.meta.isRoot)
      continue;
    sceneCounts.set(entry.meta.tier, Math.max(sceneCounts.get(entry.meta.tier) ?? 0, entry.meta.sceneNumber ?? 0));
  }
  const entries = await listAllEntries(bookId, userId);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const orderedPlan = plan.filter((entry) => entry.tier === 1 || entry.tier === 2 || entry.tier === 3).slice().sort((a, b) => a.storyOrder - b.storyOrder);
  let adopted = 0;
  let skipped = 0;
  for (const item of orderedPlan) {
    const source = byId.get(item.entryId);
    if (!source || source.disabled) {
      skipped++;
      continue;
    }
    const ext = source.extensions || {};
    if (ext[EXTENSION_KEY]) {
      skipped++;
      continue;
    }
    const tier = item.tier;
    const sceneNumber = (sceneCounts.get(tier) ?? 0) + 1;
    sceneCounts.set(tier, sceneNumber);
    const title = cleanTitle(source.comment, "") || cleanTitle(source.content.split(/\n+/, 1)[0] || "", "") || "Imported Memory";
    const meta = {
      tier,
      chatId,
      msgIds: [],
      tokenCountInput: 0,
      tokenCountOutput: approximateTokensFromChars((source.content || "").length),
      model: "adopted",
      connectionId: "adopted",
      createdAt: source.created_at || Date.now(),
      title,
      sceneNumber,
      storyOrder: item.storyOrder,
      preserveComment: true
    };
    await spindle.world_books.entries.update(source.id, {
      constant: true,
      position: 8,
      outlet_name: normalizeOutletName(settings.memoryOutletName),
      order_value: item.storyOrder,
      extensions: { ...ext, [EXTENSION_KEY]: meta }
    }, userId);
    adopted++;
  }
  invalidateBookCache(userId, chatId);
  return { adopted, skipped };
}
function parseRange(text) {
  for (const pattern of RANGE_PATTERNS) {
    const match = pattern.exec(text);
    if (!match)
      continue;
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (!Number.isFinite(start) || !Number.isFinite(end))
      continue;
    return { start, end, raw: match[0] };
  }
  return null;
}
function resolveRange(start, end, messageCount, preferZeroBased) {
  const zeroBased = { firstMsgIdx: start, lastMsgIdx: end };
  const oneBased = { firstMsgIdx: start - 1, lastMsgIdx: end - 1 };
  const preferred = preferZeroBased ? zeroBased : oneBased;
  if (isValidRange(preferred.firstMsgIdx, preferred.lastMsgIdx, messageCount))
    return preferred;
  const fallback = preferZeroBased ? oneBased : zeroBased;
  if (isValidRange(fallback.firstMsgIdx, fallback.lastMsgIdx, messageCount))
    return fallback;
  return null;
}
function isValidRange(firstMsgIdx, lastMsgIdx, messageCount) {
  return firstMsgIdx >= 0 && lastMsgIdx >= firstMsgIdx && lastMsgIdx < messageCount;
}
function cleanTitle(text, rangeRaw) {
  if (!rangeRaw)
    return text.trim();
  return text.replace(rangeRaw, "").replace(/\bmsgs?\s*$/i, "").replace(/\bmessages?\s*$/i, "").replace(/[-\u2013\u2014:#[\]()[\]\s]+$/g, "").replace(/^\s*[-\u2013\u2014:#[\]()[\]\s]+/g, "").trim();
}
function rangesOverlap(aFirst, aLast, bFirst, bLast) {
  return aFirst <= bLast && bFirst <= aLast;
}
function entryLabel(entry) {
  const label = (entry.comment || entry.content.split(/\n+/, 1)[0] || entry.id).trim();
  return label.length > 80 ? `${label.slice(0, 77)}...` : label;
}
function addDetail(details, detail) {
  if (details.length < 3)
    details.push(detail);
}

// src/backend/index.ts
async function notify(userId, tone, text, automation = false) {
  try {
    if (automation && tone !== "error") {
      const settings = await loadSettings(userId).catch(() => null);
      if (settings && !settings.showAutomationToasts)
        return;
    }
    hostToast(userId, tone, text);
    send({ type: "toast", tone, text }, userId);
  } catch (err) {
    warn(`toast delivery failed: ${describeError(err)}`);
  }
}
function importSkipSummary(result) {
  const parts = [];
  if (result.skippedNoRange)
    parts.push(`${result.skippedNoRange} no range`);
  if (result.skippedInvalidRange)
    parts.push(`${result.skippedInvalidRange} invalid range`);
  if (result.skippedDuplicate)
    parts.push(`${result.skippedDuplicate} duplicate/overlap`);
  return parts.length ? parts.join(", ") : "0 skipped";
}
var PUSH_DEBOUNCE_MS = 30;
var pushTimers = new Map;
var pendingPushChatIds = new Map;
var pendingPushResolvers = new Map;
async function doPushState(userId, chatId) {
  try {
    if (chatId) {
      const active = await spindle.chats.getActive(userId).catch(() => null);
      if (active && active.id !== chatId)
        return;
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
      if (active && active.id !== chatId)
        return;
    }
    send({ type: "state", state }, userId);
  } catch (err) {
    error(`pushState failed: ${describeError(err)}`);
    send({ type: "error", text: `LumiBooks state refresh failed: ${describeError(err)}` }, userId);
  }
}
function pushState(userId, chatId) {
  pendingPushChatIds.set(userId, chatId ?? null);
  const prev = pushTimers.get(userId);
  if (prev)
    clearTimeout(prev);
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
          try {
            r();
          } catch (_) {}
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
    notify(userId, tone, text, automation === true);
  },
  onStateChange(userId, chatId) {
    pushState(userId, chatId);
  }
});
spindle.registerWorldInfoInterceptor(async (ctx) => {
  const userId = ctx.userId ?? resolveUserId(ctx.chatId) ?? getBootstrapUserId();
  const settings = userId ? await loadSettings(userId).catch(() => null) : null;
  const outletMode = !!settings?.enabled;
  let activeOutletIds = null;
  if (outletMode && userId && ctx.chatId) {
    const allEntries = await listLmbEntries(ctx.chatId, userId).catch(() => []);
    const coverage = await buildCoverage(ctx.chatId, userId, allEntries).catch(() => null);
    activeOutletIds = coverage ? new Set(coverage.activeEntries.map((entry) => entry.raw.id)) : null;
  }
  const disabled = [];
  for (const entry of ctx.entries) {
    const ext = entry.extensions;
    if (!ext)
      continue;
    if (ext[PROJECTION_KEY]) {
      disabled.push(entry.id);
      continue;
    }
    if (ext[EXTENSION_KEY]) {
      if (!outletMode)
        disabled.push(entry.id);
      else if (!activeOutletIds?.has(entry.id))
        disabled.push(entry.id);
    }
  }
  return disabled.length ? { disabled } : undefined;
}, 90);
spindle.registerInterceptor(async (messages, context) => {
  try {
    const chatId = context && typeof context === "object" && typeof context.chatId === "string" ? context.chatId : null;
    if (!chatId)
      return messages;
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
    if (!userId)
      return messages;
    const settings = await loadSettings(userId);
    if (!settings.enabled)
      return messages;
    return messages;
  } catch (err) {
    warn(`interceptor failed: ${describeError(err)}`);
    return messages;
  }
}, 90);
spindle.on("MESSAGE_SENT", async (payload, hostUserId) => {
  const p = payload;
  if (!p?.chatId)
    return;
  const userId = hostUserId ?? resolveUserId(p.chatId);
  if (!userId)
    return;
  rememberChatUser(p.chatId, userId);
});
spindle.on("GENERATION_ENDED", async (payload, hostUserId) => {
  const p = payload;
  if (!p?.chatId || p.error)
    return;
  const userId = hostUserId ?? resolveUserId(p.chatId);
  if (!userId)
    return;
  rememberChatUser(p.chatId, userId);
  await ensureUserFolders(userId).catch(() => {});
  const settings = await loadSettings(userId).catch(() => null);
  if (!settings?.enabled)
    return;
  const profile = settings.profiles.find((x) => x.id === settings.activeProfileId);
  if (!profile)
    return;
  await reassertChatBinding(p.chatId, userId).catch(() => {});
  await maybeRunPipeline(p.chatId, profile, settings, userId).catch((err) => {
    warn(`pipeline failed: ${describeError(err)}`);
  });
});
spindle.on("CHAT_SWITCHED", async (payload, hostUserId) => {
  const p = payload;
  const userId = hostUserId ?? resolveUserId(p?.chatId ?? null);
  if (!userId)
    return;
  if (p?.chatId)
    rememberChatUser(p.chatId, userId);
  invalidateConnectionsCache(userId);
  await pushState(userId, p?.chatId ?? null);
});
spindle.on("MESSAGE_DELETED", async (payload, hostUserId) => {
  const p = payload;
  if (!p?.chatId)
    return;
  const userId = hostUserId ?? resolveUserId(p.chatId);
  if (!userId)
    return;
  rememberChatUser(p.chatId, userId);
  invalidateBookCache(userId, p.chatId);
  await pushState(userId, p.chatId);
});
spindle.on("WORLD_BOOK_ENTRY_DELETED", async (payload, hostUserId) => {
  if (!hostUserId)
    return;
  const p = payload;
  if (!p?.worldBookId)
    return;
  await handleExternalEntryDeletion(hostUserId, p.worldBookId, false);
});
spindle.on("WORLD_BOOK_DELETED", async (payload, hostUserId) => {
  if (!hostUserId)
    return;
  const p = payload;
  if (!p?.id)
    return;
  await handleExternalEntryDeletion(hostUserId, p.id, true);
});
spindle.on("REGEX_SCRIPT_CHANGED", (_payload, hostUserId) => {
  if (hostUserId)
    invalidateRegexCache(hostUserId);
});
spindle.on("REGEX_SCRIPT_DELETED", (_payload, hostUserId) => {
  if (hostUserId)
    invalidateRegexCache(hostUserId);
});
spindle.on("CONNECTION_PROFILE_LOADED", (_payload, hostUserId) => {
  if (hostUserId)
    invalidateConnectionsCache(hostUserId);
});
spindle.on("MAIN_API_CHANGED", (_payload, hostUserId) => {
  if (hostUserId)
    invalidateConnectionsCache(hostUserId);
});
async function handleExternalEntryDeletion(userId, bookId, isBookDeletion) {
  const chatId = isBookDeletion ? findCachedChatIdForBook(userId, bookId) : await findChatIdForBook(userId, bookId).catch(() => null);
  if (!chatId)
    return;
  if (isBookDeletion)
    invalidateAllBookCacheEntriesForBook(userId, bookId);
  else
    invalidateBookCache(userId, chatId);
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
async function collectActiveChapterIds(chatId, userId) {
  const entries = await listLmbEntries(chatId, userId);
  const coverage = await buildCoverage(chatId, userId, entries);
  return coverage.activeEntries.filter((e) => e.meta.tier === 1 && !e.meta.isRoot).map((e) => e.raw.id);
}
async function collectActiveArcIds(chatId, userId) {
  const entries = await listLmbEntries(chatId, userId);
  const coverage = await buildCoverage(chatId, userId, entries);
  return coverage.activeEntries.filter((e) => e.meta.tier === 2 && !e.meta.isRoot).map((e) => e.raw.id);
}
async function retryLastFailure(chatId, userId, profile, settings) {
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
  const msg = raw;
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
        let prevHide = null;
        let nextHide = null;
        let activeBefore = null;
        let missing = false;
        await mutateSettings(userId, (cur) => {
          activeBefore = cur.activeProfileId;
          const existing = cur.profiles.find((p) => p.id === id);
          if (!existing) {
            missing = true;
            return cur;
          }
          const merged = normalizeProfile({ ...existing, ...incoming, id });
          if (!merged)
            return cur;
          prevHide = existing.hideCoveredMessages;
          nextHide = merged.hideCoveredMessages;
          return { ...cur, profiles: cur.profiles.map((p) => p.id === id ? merged : p) };
        });
        if (missing) {
          warn(`save_profile dropped: no profile with id "${id}"`);
          send({ type: "error", text: `Profile ${id} no longer exists.` }, userId);
          break;
        }
        if (prevHide !== null && nextHide !== null && prevHide !== nextHide && id === activeBefore && msg.chatId) {
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
          if (idx === -1)
            return cur;
          const current = cur.profiles[idx];
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
          const baseProfile = cur.profiles.find((p) => p.id === cur.activeProfileId) ?? cur.profiles[0];
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
          const activeProfileId = cur.activeProfileId === msg.profileId ? profiles[0].id : cur.activeProfileId;
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
          if (!cur.profiles.some((p) => p.id === msg.profileId))
            return cur;
          return { ...cur, activeProfileId: msg.profileId };
        });
        await pushState(userId, msg.chatId);
        break;
      }
      case "create_chapter": {
        const cur = await loadSettings(userId);
        const profile = cur.profiles.find((p) => p.id === cur.activeProfileId);
        if (!profile)
          break;
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
        if (!profile)
          break;
        if (getBusy(userId).some((b) => b.kind === "chapter" && b.chatId === msg.chatId)) {
          await notify(userId, "warn", "Memoria is already filing a chapter");
          break;
        }
        const rangeMessages = await spindle.chat.getMessages(msg.chatId);
        const selectedIds = new Set(msg.messageIds);
        const positions = rangeMessages.map((m, i) => ({ m, i })).filter(({ m }) => selectedIds.has(m.id) && !(m.metadata?.["lmb_excluded"] === true)).map(({ i }) => i);
        const runs = [];
        let prev = -2;
        for (const pos of positions) {
          if (pos === prev + 1)
            runs[runs.length - 1].push(rangeMessages[pos].id);
          else
            runs.push([rangeMessages[pos].id]);
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
        if (!profile)
          break;
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
        if (!profile)
          break;
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
        if (!profile)
          break;
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
        if (!profile)
          break;
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
        if (!profile)
          break;
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
        if (!profile)
          break;
        await retryLastFailure(msg.chatId, userId, profile, cur);
        await pushState(userId, msg.chatId);
        break;
      }
      case "delete_entry": {
        const entries = await listLmbEntries(msg.chatId, userId);
        const entry = entries.find((e) => e.raw.id === msg.entryId);
        if (entry && entry.meta.tier !== 1 && !entry.meta.supersededByEntryId && Array.isArray(entry.meta.sourceChapterEntryIds)) {
          const sourceIds = new Set(entry.meta.sourceChapterEntryIds);
          for (const src of entries) {
            if (!sourceIds.has(src.raw.id))
              continue;
            if (src.meta.supersededByEntryId !== msg.entryId)
              continue;
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
        if (entry.meta.tier !== 1 && !entry.meta.supersededByEntryId && Array.isArray(entry.meta.sourceChapterEntryIds)) {
          const sourceIds = new Set(entry.meta.sourceChapterEntryIds);
          for (const src of entries) {
            if (!sourceIds.has(src.raw.id))
              continue;
            if (src.meta.supersededByEntryId !== msg.entryId)
              continue;
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
        if (!profile)
          break;
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
        const sourceIds = Array.isArray(entry.meta.sourceChapterEntryIds) ? entry.meta.sourceChapterEntryIds.slice() : [];
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
            const blockerEntryId = otherCoverage.coveredBy.get(blockingIds[0]);
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
      case "resync_hidden": {
        const messages = await spindle.chat.getMessages(msg.chatId);
        const coverage = await buildCoverage(msg.chatId, userId);
        await syncHiddenForCoveredMessages(msg.chatId, messages, coverage, userId, true);
        await pushState(userId, msg.chatId);
        break;
      }
      case "import_attached_lorebooks": {
        const result = await importAttachedLorebooks(msg.chatId, userId);
        if (result.imported > 0) {
          const settings = await loadSettings(userId);
          const profile = settings.profiles.find((p) => p.id === settings.activeProfileId);
          if (profile?.hideCoveredMessages || typeof result.hideThroughIdx === "number") {
            const messages = await spindle.chat.getMessages(msg.chatId);
            const coverage = await buildCoverage(msg.chatId, userId);
            await syncHiddenForCoveredMessages(msg.chatId, messages, coverage, userId, true, result.hideThroughIdx);
          }
        }
        const skipped = result.skippedDuplicate + result.skippedInvalidRange + result.skippedNoRange;
        const text = result.imported > 0 ? `Imported ${result.imported} entr${result.imported === 1 ? "y" : "ies"} from attached lorebooks${skipped ? ` (${importSkipSummary(result)})` : ""}${result.details.length ? `; ${result.details.join("; ")}` : ""}` : result.scannedBooks === 0 ? "No other attached lorebooks found to import" : `No importable entries found (${importSkipSummary(result)})${result.details.length ? `; ${result.details.join("; ")}` : ""}`;
        await notify(userId, result.imported > 0 ? "success" : "info", text);
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
        const text = result.adopted > 0 ? `Adopted ${result.adopted} entr${result.adopted === 1 ? "y" : "ies"} in-place${result.skipped ? ` (${result.skipped} skipped)` : ""}` : "No entries were adopted";
        await notify(userId, result.adopted > 0 ? "success" : "info", text);
        await pushState(userId, msg.chatId);
        break;
      }
      case "dry_run_chapter": {
        const cur = await loadSettings(userId);
        const profile = cur.profiles.find((p) => p.id === cur.activeProfileId);
        if (!profile)
          break;
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
        if (!profile)
          break;
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
        if (!profile)
          break;
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
        const text = updated === 0 ? `Future entries will be ${msg.value ? "constant" : "keyword-triggered"}` : `Memoria flipped ${updated} entr${updated === 1 ? "y" : "ies"} to ${msg.value ? "constant" : "keyword-triggered"}`;
        await notify(userId, "info", text);
        await pushState(userId, msg.chatId);
        break;
      }
      case "resync_visibility": {
        const settings = await loadSettings(userId);
        const profile = settings.profiles.find((p) => p.id === settings.activeProfileId);
        const desiredHidden = profile ? profile.hideCoveredMessages : true;
        const { unhidden, hidden } = await resyncVisibility(msg.chatId, userId, desiredHidden);
        const total = unhidden + hidden;
        const text = total === 0 ? "Memoria's shelf is already aligned, nya" : `Memoria resynced ${total} message${total === 1 ? "" : "s"} (${hidden} hidden, ${unhidden} unhidden)`;
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
            if (existing >= 0)
              merged[existing] = record;
            else
              merged.push(record);
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
          if (idx >= 0)
            list[idx] = next;
          else
            list.push(next);
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
        if (!profile)
          break;
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
          const text = result.reason === "has_own" ? "This chat already has memories, use Rebuild instead" : result.reason === "empty_source" ? "That chat has no memories to inherit" : result.reason === "busy" ? "Memoria is already rebasing this chat" : "Memoria can't rebase a chat onto itself";
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
          const text = result.reason === "empty_source" ? "That chat has no memories to inherit" : result.reason === "busy" ? "Memoria is already rebuilding this chat" : "Memoria can't rebuild a chat onto itself";
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
        const ids = Array.isArray(msg.messageIds) ? msg.messageIds.filter((x) => typeof x === "string") : [];
        if (ids.length === 0)
          break;
        const messages = await spindle.chat.getMessages(msg.chatId);
        const byId = new Map(messages.map((m) => [m.id, m]));
        const coveredNow = msg.excluded ? (await buildCoverage(msg.chatId, userId)).coveredBy : null;
        const hideToUnhide = [];
        for (const id of ids) {
          const m = byId.get(id);
          if (!m)
            continue;
          const cur = m.metadata;
          const next = cur && typeof cur === "object" ? { ...cur } : {};
          if (msg.excluded) {
            next["lmb_excluded"] = true;
            const hidden = !!(m.extra && m.extra.hidden);
            if (hidden && coveredNow?.has(id))
              hideToUnhide.push(id);
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
        await notify(userId, "info", msg.excluded ? `Memoria will leave ${ids.length} message${ids.length === 1 ? "" : "s"} untouched` : `Memoria will compress ${ids.length} message${ids.length === 1 ? "" : "s"} again`);
        await pushState(userId, msg.chatId);
        break;
      }
      case "detach_root": {
        const removed = await detachRoot(msg.chatId, userId);
        const text = removed === 0 ? "This chat has no inherited memories to detach" : `Memoria detached ${removed} inherited memor${removed === 1 ? "y" : "ies"}`;
        await notify(userId, "info", text);
        await pushState(userId, msg.chatId);
        break;
      }
      default:
        debug(userId, `unknown frontend msg type`, msg.type);
    }
  } catch (err) {
    const description = describeError(err);
    error(`frontend handler failed: ${description}`);
    send({ type: "error", text: description }, userId);
  }
});
registerBookAnomalyCallback((userId, tone, text) => {
  notify(userId, tone, text);
});
registerInjectionAnomalyCallback((userId, text) => {
  notify(userId, "error", text);
});
registerHookEndpoints();
info("LumiBooks loaded.");
