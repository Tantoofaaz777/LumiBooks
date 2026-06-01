import type { CustomPreset, LMBProfile, LMBSettings, LMBEntryMeta, SamplerSet } from "./shared";

export interface ChapterView {
  entryId: string;
  bookId: string;
  comment: string;
  content: string;
  meta: LMBEntryMeta;
  active: boolean;
  contentTokens: number;
  contentChars: number;
  sourceTokensInput: number;
}

export interface ArcView extends ChapterView {
  sourceChapterEntryIds: string[];
}

export interface ConnectionOption {
  id: string;
  name: string;
  provider: string;
  model: string;
  isDefault: boolean;
  hasApiKey: boolean;
}

export interface CoverageStats {
  totalMessages: number;
  coveredMessages: number;
  uncoveredMessages: number;
  approxUncoveredTokens: number;
  lagSatisfied: boolean;
  windowAvailable: boolean;
}

export interface BusyEntry {
  kind: "chapter" | "arc";
  chatId: string;
  label: string;
  startedAt: number;
}

export interface FailureRecord {
  kind: "chapter" | "arc";
  message: string;
  retriedTimes: number;
  at: number;
}

export interface MessageStub {
  id: string;
  role: "system" | "user" | "assistant";
  preview: string;
  charCount: number;
  approxTokens: number;
  hidden: boolean;
  covered: boolean;
  coveredByEntryId: string | null;
  indexInChat: number;
}

export interface BuiltInPreset {
  key: string;
  displayName: string;
  prompt: string;
}

export interface RegexScriptOption {
  id: string;
  name: string;
}

export interface PendingPreview {
  kind: "chapter" | "arc";
  draftId: string;
  title: string;
  content: string;
  shortComment: string;
  sourceMessageIds: string[];
  sourceChapterEntryIds?: string[];
  model: string;
  connectionId: string;
  tokenCountInput: number;
  tokenCountOutput: number;
  firstMsgIdx?: number;
  lastMsgIdx?: number;
  presetKey: string;
  /** When set, accepting this preview replaces (deletes) the given entry — used by regenerate. */
  replacesEntryId?: string;
}

export interface FrontendState {
  activeChatId: string | null;
  activeChatName: string | null;
  activeCharacterId: string | null;
  activeCharacterName: string | null;
  settings: LMBSettings;
  activeProfile: LMBProfile;
  chapters: ChapterView[];
  arcs: ArcView[];
  bookId: string | null;
  bookName: string | null;
  connections: ConnectionOption[];
  resolvedSidecarConnectionId: string | null;
  coverage: CoverageStats;
  busy: BusyEntry[];
  lastFailure: FailureRecord | null;
  messages: MessageStub[];
  chapterPresets: BuiltInPreset[];
  arcPresets: BuiltInPreset[];
  customPresets: CustomPreset[];
  regexScripts: RegexScriptOption[];
  pendingPreviews: PendingPreview[];
  backlogChapters: number;
  backlogArcs: number;
}

export type FrontendToBackend =
  | { type: "ready"; chatId?: string | null }
  | { type: "refresh"; chatId?: string | null }
  | { type: "save_settings"; patch: Partial<LMBSettings>; chatId?: string | null }
  | { type: "save_profile"; profile: Partial<LMBProfile> & { id: string }; chatId?: string | null }
  | { type: "save_samplers"; profileId: string; samplers: Partial<SamplerSet>; chatId?: string | null }
  | { type: "create_profile"; name: string; chatId?: string | null }
  | { type: "delete_profile"; profileId: string; chatId?: string | null }
  | { type: "set_active_profile"; profileId: string; chatId?: string | null }
  | { type: "create_chapter"; chatId: string }
  | { type: "create_chapter_range"; chatId: string; messageIds: string[] }
  | { type: "create_all_chapters"; chatId: string }
  | { type: "create_arc"; chatId: string }
  | { type: "create_arc_from"; chatId: string; chapterEntryIds: string[] }
  | { type: "create_all_arcs"; chatId: string }
  | { type: "retry_last_failure"; chatId: string }
  | { type: "delete_entry"; chatId: string; entryId: string }
  | { type: "release_entry"; chatId: string; entryId: string }
  | { type: "regenerate_entry"; chatId: string; entryId: string }
  | { type: "update_entry"; chatId: string; entryId: string; patch: { content?: string; comment?: string } }
  | { type: "resync_hidden"; chatId: string }
  | { type: "resync_visibility"; chatId: string }
  | { type: "set_force_constant"; value: boolean; chatId?: string | null }
  | { type: "abort_busy"; chatId: string; kind: "chapter" | "arc" }
  | { type: "dry_run_chapter"; chatId: string }
  | { type: "dry_run_arc"; chatId: string }
  | { type: "ensure_book"; chatId: string }
  | { type: "import_preset"; raw: unknown; category: "chapter" | "arc"; chatId?: string | null }
  | { type: "save_custom_preset"; preset: CustomPreset; chatId?: string | null }
  | { type: "delete_custom_preset"; key: string; category: "chapter" | "arc"; chatId?: string | null }
  | { type: "accept_preview"; draftId: string; chatId: string }
  | { type: "discard_preview"; draftId: string; chatId: string }
  | { type: "edit_preview"; draftId: string; chatId: string; patch: { title?: string; content?: string } };

export interface DryRunMessage {
  role: "system" | "user";
  content: string;
}

export interface DryRunDiagnostic {
  message: string;
}

export type BackendToFrontend =
  | { type: "state"; state: FrontendState }
  | { type: "toast"; tone: "success" | "info" | "warn" | "error"; text: string }
  | { type: "busy"; entries: BusyEntry[] }
  | { type: "error"; text: string }
  | { type: "dry_run_result"; kind: "chapter" | "arc"; messages: DryRunMessage[]; diagnostics: DryRunDiagnostic[] };
