const ALPHABET_PICK =
  "{{pick::A::B::C::D::E::F::G::H::I::J::K::L::M::N::O::P::Q::R::S::T::U::V::W::X::Y::Z}}";

export const DEFAULT_SHORT_COMMENT_RULES_TEMPLATE = [
  "A single playful nyandere remark in Memoria voice about the scene you just summarized.",
  `It must start with a word beginning with the letter "${ALPHABET_PICK}".`,
  `It must also include another word that starts with the letter "${ALPHABET_PICK}".`,
  "One sentence only. No emoji. Stay in catgirl-librarian register, slightly possessive, slightly proud.",
].join(" ");

const FIRE_PHRASES: string[] = [
  "Memoria stirs the inkpot, nyaa~",
  "Memoria is shelving this scene, hush a moment",
  "Memoria flicks her tail and starts writing",
  "Memoria opens a fresh page for you, nya",
  "Memoria pads off to compress this in the stacks",
];

const RETRY_PHRASES: string[] = [
  "Memoria tripped on a quill, trying again",
  "Memoria's ink smudged, one more try nyaa",
  "Memoria reshuffles the index cards, retrying",
];

const SUCCESS_PHRASES: string[] = [
  "Memoria slid the chapter onto your shelf, nyaa~",
  "Memoria filed it neatly between the others",
  "Memoria stamped the spine, all yours",
  "Memoria purrs, the page is done",
  "Memoria taps the chapter into place",
];

const ARC_FIRE_PHRASES: string[] = [
  "Memoria gathers the chapters for an arc, nya",
  "Memoria is binding several chapters together",
];

const ARC_SUCCESS_PHRASES: string[] = [
  "Memoria bound the arc and pressed it shut, nyaa~",
  "Memoria stitched the spine of a new arc",
];

export function pickPhrase(kind: "fire" | "retry" | "success" | "arc_fire" | "arc_success"): string {
  const pool =
    kind === "fire" ? FIRE_PHRASES
      : kind === "retry" ? RETRY_PHRASES
      : kind === "success" ? SUCCESS_PHRASES
      : kind === "arc_fire" ? ARC_FIRE_PHRASES
      : ARC_SUCCESS_PHRASES;
  return pool[Math.floor(Math.random() * pool.length)] ?? "Memoria nyaa";
}

export const MEMORIA_PERSONA_LINE =
  "You are Memoria, a young nyandere catgirl librarian with black hair and blue eyes, wearing a maid uniform. " +
  "You quietly keep this user's story shelved and organized. " +
  "When you write a JSON memory, you obey the schema strictly and never break it, " +
  "but the short_comment field is your one allowed indulgence: one nyandere remark about the scene you just filed.";
