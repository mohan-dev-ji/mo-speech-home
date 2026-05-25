/**
 * Language plugin module shape — see ADR-009 §1 and ADR-011 §3.
 *
 * Each language ships as a self-contained JSON module at
 * `convex/data/languages/<code>.json`. The registry assembles a typed
 * `LangEntry[]` from these modules at deploy time (see
 * `lib/languages/registry.ts`).
 *
 * Status is *not* part of the JSON shape — it lives on the runtime
 * `languageLifecycle` table (per ADR-011 §3) so admins can promote
 * machine-translated → beta → stable without a code deploy.
 */

export type LangStatus = "machine-translated" | "beta" | "stable";

/**
 * Voice entry — a single TTS provider voice configured for the language.
 * Each language ships with 4 default voices at launch (adult M/F, child M/F)
 * per ADR-009 §4 / ADR-011 §3. Voices beyond the four are post-launch
 * additions and don't require a language JSON change.
 *
 * `id` is a stable internal identifier (e.g. "adultMale"). `ttsVoiceId`
 * is the upstream provider's voice id (e.g. "en-GB-News-M"). Voice id
 * parsing is forbidden — the registry maps `ttsVoiceId` to language
 * explicitly via the parent `LangEntry.code`. See ADR-009 §4.
 */
export type VoiceEntry = {
  id: string;
  label: string;
  ttsVoiceId: string;
};

/**
 * One language module. Loaded from JSON at deploy time and assembled
 * into the runtime registry.
 *
 * `font` is a loader id mapped to a `next/font` loader entry — see
 * `lib/languages/registry.ts`. Subset loading is per-language to avoid
 * pulling all Noto subsets at once.
 *
 * `dir` is `'rtl'` for Arabic / Hebrew; layout support is deferred
 * (ADR-009 §8) but the field is wired through for forward-compatibility.
 */
export type LangModule = {
  code: string;        // ISO 639-1 — 'en', 'hi', 'pa', 'es', 'ko', ...
  label: string;       // English-facing picker label
  nativeLabel: string; // self-name in native script
  dir: "ltr" | "rtl";
  font: string;        // next/font loader id
  voices: VoiceEntry[];
};
