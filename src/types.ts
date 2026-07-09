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
  isRoot: boolean;
}

export interface ArcView extends ChapterView {
  sourceChapterEntryIds: string[];
}

export interface RootSourceOption {
  chatId: string;
  chatName: string;
  entryCount: number;
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
}

export interface BusyEntry {
  kind: "chapter" | "arc" | "volume";
  chatId: string;
  label: string;
  startedAt: number;
}

export interface FailureRecord {
  kind: "chapter" | "arc" | "volume";
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
  excluded: boolean;
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
  kind: "chapter" | "arc" | "volume";
  draftId: string;
  title: string;
  content: string;
  shortComment: string;
  sourceMessageIds: string[];
  /** Ids of the tier below: chapter ids for an arc preview, arc ids for a volume preview. */
  sourceChapterEntryIds?: string[];
  model: string;
  connectionId: string;
  tokenCountInput: number;
  tokenCountOutput: number;
  firstMsgIdx?: number;
  lastMsgIdx?: number;
  presetKey: string;
  replacesEntryId?: string;
}

export interface AdoptLorebookEntryDraft {
  entryId: string;
  comment: string;
  preview: string;
  orderValue: number;
  contentChars: number;
  alreadyManaged: boolean;
  managedChatId: string | null;
}

export interface AdoptLorebookCandidate {
  bookId: string;
  name: string;
  entries: AdoptLorebookEntryDraft[];
}

export interface AdoptLorebookPlanEntry {
  entryId: string;
  tier: 1 | 2 | 3 | 0;
  storyOrder: number;
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
  volumes: ArcView[];
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
  volumePresets: BuiltInPreset[];
  customPresets: CustomPreset[];
  regexScripts: RegexScriptOption[];
  pendingPreviews: PendingPreview[];
  rootOrigin: string | null;
  rootOriginName: string | null;
  rootEntryCount: number;
  availableRoots: RootSourceOption[];
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
  | { type: "create_chapter_range"; chatId: string; messageIds: string[] }
  | { type: "create_arc_from"; chatId: string; chapterEntryIds: string[] }
  | { type: "create_volume_from"; chatId: string; arcEntryIds: string[] }
  | { type: "retry_last_failure"; chatId: string }
  | { type: "delete_entry"; chatId: string; entryId: string }
  | { type: "release_entry"; chatId: string; entryId: string }
  | { type: "regenerate_entry"; chatId: string; entryId: string }
  | { type: "update_entry"; chatId: string; entryId: string; patch: { content?: string; comment?: string } }
  | { type: "bind_messages_to_entry"; chatId: string; entryId: string; messageIds: string[] }
  | { type: "prepare_adopt_lorebook"; chatId: string }
  | { type: "confirm_adopt_lorebook"; chatId: string; bookId: string; entries: AdoptLorebookPlanEntry[] }
  | { type: "set_force_constant"; value: boolean; chatId?: string | null }
  | { type: "abort_busy"; chatId: string; kind: "chapter" | "arc" | "volume" }
  | { type: "dry_run_arc"; chatId: string }
  | { type: "dry_run_volume"; chatId: string }
  | { type: "ensure_book"; chatId: string }
  | { type: "save_custom_preset"; preset: CustomPreset; chatId?: string | null }
  | { type: "delete_custom_preset"; key: string; category: "chapter" | "arc" | "volume"; chatId?: string | null }
  | { type: "accept_preview"; draftId: string; chatId: string }
  | { type: "discard_preview"; draftId: string; chatId: string }
  | { type: "edit_preview"; draftId: string; chatId: string; patch: { title?: string; content?: string } }
  | { type: "rebase_root"; chatId: string; sourceChatId: string }
  | { type: "rebuild_root"; chatId: string; sourceChatId: string }
  | { type: "detach_root"; chatId: string }
  | { type: "set_message_excluded"; chatId: string; messageIds: string[]; excluded: boolean };

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
  | { type: "adopt_lorebook_candidates"; chatId: string; books: AdoptLorebookCandidate[] }
  | { type: "dry_run_result"; kind: "chapter" | "arc" | "volume"; messages: DryRunMessage[]; diagnostics: DryRunDiagnostic[] };
