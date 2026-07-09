const FIRE_PHRASES: string[] = [
  "LumiBooks is filing this chapter",
  "LumiBooks is summarizing the selected messages",
  "LumiBooks is preparing the chapter",
  "LumiBooks is writing the memory",
  "LumiBooks is compressing this range",
];

const RETRY_PHRASES: string[] = [
  "LumiBooks hit an error, retrying",
  "LumiBooks is trying again",
  "LumiBooks is retrying the generation",
];

const SUCCESS_PHRASES: string[] = [
  "Chapter saved",
  "Chapter filed",
  "Memory saved",
  "Chapter added to the lorebook",
  "Chapter is ready",
];

const ARC_FIRE_PHRASES: string[] = [
  "LumiBooks is binding the selected chapters",
  "LumiBooks is creating an arc",
];

const ARC_SUCCESS_PHRASES: string[] = [
  "Arc saved",
  "Arc created",
];

const VOLUME_FIRE_PHRASES: string[] = [
  "LumiBooks is creating a volume",
];

const VOLUME_SUCCESS_PHRASES: string[] = [
  "Volume saved",
];

export type PhraseKind = "fire" | "retry" | "success" | "arc_fire" | "arc_success" | "volume_fire" | "volume_success";

export function pickPhrase(kind: PhraseKind): string {
  const pool =
    kind === "fire" ? FIRE_PHRASES
      : kind === "retry" ? RETRY_PHRASES
      : kind === "success" ? SUCCESS_PHRASES
      : kind === "arc_fire" ? ARC_FIRE_PHRASES
      : kind === "arc_success" ? ARC_SUCCESS_PHRASES
      : kind === "volume_fire" ? VOLUME_FIRE_PHRASES
      : VOLUME_SUCCESS_PHRASES;
  return pool[Math.floor(Math.random() * pool.length)] ?? "LumiBooks";
}
