/**
 * Tone presets for expressive fluent-utterance playback (Phase 15, Thread 2).
 *
 * The tone path does NOT use SSML `<prosody>` — the spike (see
 * `docs/4-builds/plans/phase-15-language-design.md`, Thread 2 findings) proved
 * pitch-shifting a neutral read sounds mechanical on every standard Google
 * voice. Instead, non-neutral tones synthesise with Google's **Gemini 2.5
 * native TTS**, where the emotion is a natural-language *instruction* the model
 * performs. `Neutral` never touches Gemini — it stays the cheap seeded/Wavenet
 * path, byte-identical to before.
 *
 * Tone is a `max`-tier feature, invoked only from the play modals. See the
 * two-tier voice model in the spike findings.
 */

export type Tone = "neutral" | "excited" | "angry";

/** Tones that route through the expressive Gemini path (everything but neutral). */
export type ExpressiveTone = Exclude<Tone, "neutral">;

export const TONES: readonly Tone[] = ["neutral", "excited", "angry"] as const;

export function isTone(x: unknown): x is Tone {
  return typeof x === "string" && (TONES as readonly string[]).includes(x);
}

export function isExpressiveTone(x: unknown): x is ExpressiveTone {
  return isTone(x) && x !== "neutral";
}

/** V1 expressive voice — the single Gemini prebuilt voice chosen in the spike. */
export const GEMINI_TONE_VOICE = "Puck";

/**
 * Language-bucket → tone → natural-language directive.
 *
 * The directive is spoken to the model as an instruction (the phrase is
 * appended after a colon: `"<directive>: <phrase>"`), so it steers delivery
 * rather than being read aloud. Directives are authored in each language so
 * pronunciation stays native — English also pins a British accent (Gemini
 * otherwise defaults to US). These strings are the exact recipes approved in
 * the spike; tune here, no other code changes.
 */
const TONE_DIRECTIVES: Record<string, Record<ExpressiveTone, string>> = {
  en: {
    excited: "Speak in a natural British English accent, in a bright, excited, happy voice",
    angry: "Speak in a natural British English accent, in an angry, frustrated voice",
  },
  es: {
    excited: "Di esto con una voz alegre y muy emocionada",
    angry: "Di esto con una voz enojada y frustrada",
  },
  hi: {
    excited: "इसे खुश और उत्साहित आवाज़ में कहो",
    angry: "इसे गुस्से भरी आवाज़ में कहो",
  },
};

/**
 * The directive for a `(languageCode, tone)` pair. `languageCode` is the
 * BCP-47 code from the registry/voice (e.g. `en-GB`, `hi-IN`); we bucket on the
 * primary subtag. Falls back to English if a language has no authored set yet.
 */
export function toneDirective(languageCode: string, tone: ExpressiveTone): string {
  const bucket = (languageCode.split("-")[0] || "en").toLowerCase();
  return (TONE_DIRECTIVES[bucket] ?? TONE_DIRECTIVES.en)[tone];
}

/** Build the full Gemini prompt: `"<directive>: <phrase>"`. */
export function tonePrompt(languageCode: string, tone: ExpressiveTone, text: string): string {
  return `${toneDirective(languageCode, tone)}: ${text}`;
}
