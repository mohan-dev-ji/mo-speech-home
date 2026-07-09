# Phase 15 — Bilingual Symbols + Tone TTS + Language Foundation — Design

> **Type:** Design spec (brainstorm output). Feeds a step-by-step implementation plan.
> **Status:** Design approved in brainstorm 2026-07-08 (revised after the structure-vs-translation realization). Not yet built.
> **Roadmap:** `docs/00-roadmap.md` → Phase 15. Clinical source: dossier doc 4 (#1, #4).
> **Architectural contracts:** ADR-009 (multi-language/multi-voice), ADR-012 (live text resolution), ADR-014 (structure frozen / text live), ADR-015 (composition primitive).

Phase 15 is **three linked but independent features**, all in the "language" family and all surfacing in the talker.

**Two principles run through the whole phase:**

1. **Voice follows the language of the resolved *text*, never the board's current language.** English text is always spoken by an English voice — a pinned bilingual tile, an English-authored sentence, anything.
2. **Order-free content translates live; structure-bound content does not.** A single symbol or word has no internal grammar and translates safely forever. A *composed* utterance (phrase, block sentence, fluent sentence) encodes word order and morphology, which are language-specific — you cannot swap text under a frozen structure and get a valid utterance. Structure-bound content is authored per language, not translated.

---

## The structure-vs-translation realization (why Thread 3 changed)

The original design assumed composed sentences could resolve their text live in any language ("structure frozen, text live", ADR-014). That holds only across languages with the *same* structure. It breaks for English↔Hindi:

- English is SVO with prepositions; Hindi is SOV with postpositions and gender/case/aspect agreement.
- A block sentence is a fixed sequence of symbol/phrase blocks in the **authoring language's order**. A literal per-block translation keeps English order and English phrase boundaries → grammatically wrong in Hindi, and the *displayed symbol sequence* won't match a fluent translated audio either.
- Phrases are worse: they inflect internally and join by append/prepend in language-specific ways.

**Therefore: composed structure is re-authored per language, never machine-translated in place.** Machine translation is not deleted — it returns in the follow-on phase as an *authoring assist* (a suggested starting text inside a "build the Hindi version" flow), never as the shipped artifact.

**What still translates live (unchanged):** individual **symbols** and **words** — order-free. Thread 1's pin is the one deliberate exception.

---

## Thread 3 — Language foundation *(build first — de-risks the others)*

### The confirmed regression (git-traced)

Instructor test (2026-07-08): a sentence built on an English profile plays "exact EN audio + EN text" after switching to Hindi, while **old sentences show Hindi text + Hindi audio**. Git trace confirms the mechanism:

- **Old working sentences are library-installed *fluent* rows** — a single pre-translated `text` record (`{en, hi, es}`), materialised from the admin module-translation pipeline via `convex/lib/contentModuleInstall.ts:267-279`. They have no `units`; they take the fluent path (`SentencePlayModal`), where `displayString(text, language)` + `resolveTtsKey(text, voiceId)` resolve **live** → Hindi text + Hindi voice on a Hindi board. **This is the whole-text-translates exception** (§ principle 2): one string, translated as a unit, order handled by the translation.
- **There is no old block-sentence path to restore.** Pre-Phase-14 `createProfileSentence` accepted only `{ name }` (`git show 6b90d93`). The Phase 14 talker save (`9a38724` "re-point talker Save") and tap-time flatten (`e8c3fd9`) are a **brand-new path that never carried language** — it flattens each unit to a single string (`PersistentTalker.tsx:122-164` writes `{ [language]: string }`; `TalkerDropdown.tsx:509-514` discards the source record on tap) and renders via `blocksFromUnits(units, language)` (`blocks.ts:59-79`).

So this is a *new feature that shipped without language-awareness*, not a broken old behaviour.

### What "correct" looks like (given structure isn't translatable)

A block sentence authored in English **should stay a coherent English utterance** on any board — correct English word order, English words, English voice — because auto-translating its structure would produce Hindi words in English order (grammatically wrong). So the instructor's test result (EN text + EN audio after the switch) is **almost correct** — it is missing only (1) a **"Made in EN" badge** so it reads as a deliberate English asset rather than a bug, (2) a **guaranteed correct voice** in every authoring path (so the Hindi-accent case below can never occur), and (3) the **rebuild path** (Phase 15.5).

The genuine bug is narrower: **voice can follow the board language instead of the text's language.** When content is composed on a *non-English* board (e.g. an English-only phrase tapped onto a Hindi board, or a mislabelled key), `CompositionPlayModal.tsx:38-43` synthesises the English fallback label in the *Hindi* `voiceId` → **English words in a Hindi accent.** Voice-follows-text (3e) kills this in every path.

`createProfileSentence` (`convex/profileSentences.ts:113-157`) is a pass-through; the fix is client-side + a resolution change.

### The foundation fix (Phase 15 scope)

| # | Fix | Detail |
|---|-----|--------|
| **3a** | **Carry the source record; stop flattening to the board key** | Thread each unit's full localised record (ideally plus a `symbolId`/`librarySourceId`) through the talker instead of a flattened string. Deepest-leverage change (per the git-trace): the `TalkerSymbolItem` shape in `app/contexts/TalkerContext.tsx` must hold `Record<string,string>`, and the two flatten sites stop calling `displayString` (`TalkerDropdown.tsx:509-514` tap; `PersistentTalker.tsx:122-164` save). For the dominant case (authored on an English board) the text is already correctly keyed `en`; carrying the source record additionally fixes the *mixed* case (an English-only symbol tapped onto a Hindi board stays English-voiced, not mislabelled `hi`) and future-proofs Phase 15.5 variants. |
| **3b** | **`authoredLanguage` on structure-bound items only** | `profilePhrases` and **block/sequence** `profileSentences` (`playback === 'sequence'`) carry an explicit `authoredLanguage`, stamped at save (= the board language at authoring time — the grammar the user composed in). Legacy rows default to `en`. **Fluent sentences are NOT touched** — they hold a translated `text` record and keep resolving live per board language (the working path; see the regression note). |
| **3c** | **Resolve block units against `authoredLanguage`, never the board language** | Change `blocksFromUnits(units, language)` (`blocks.ts:59-79`) to resolve each unit's text against the sentence's `authoredLanguage`, not the current board `language`. An English block sentence then renders coherent English on any board. ⚠️ **Do NOT resolve block units live against the board language** (the git-trace's raw suggestion) — units built from library symbols carry `{en, hi}`, and board-language resolution would show Hindi words *in English order* = the grammatically-wrong literal translation. The **frozen authored-language audio snapshot is correct** for this model — do not re-resolve block audio per board language either. |
| **3d** | **"Made in \<lang\>" badge** | When the board language ≠ an item's `authoredLanguage`, show a small language badge on the item so the instructor understands why it didn't switch. This badge is the seed of the follow-on phase's "edit to localise" affordance. |
| **3e** | **Voice follows resolved text language** | The shared rule. Used for composed items (authored language) *and* for order-free content (board language). Neutralises the wrong-accent symptom structurally. |
| **3f** | **Voice persona across languages (gender fix)** | Store voice preference as a persona (`gender` + `age band`), not a raw language-specific `voiceId`. On a language switch of order-free content, `resolveVoiceId` picks the target-language voice whose persona matches, instead of falling to `voices[0]` (a fixed gender). Registry voices gain `{ gender, age }` metadata (data-only). **Today the Wavenet set ships `gender` only (male/female, all adult)** to keep costs down — so the resolver keys on `gender` now, and `age` is modelled but not yet varied. Keeping `age` in the shape means a later voice upgrade (child voices, a richer TTS API) is data-only, no resolver rewrite. |

**Explicitly NOT in Phase 15:** any in-place translation of composed (block/phrase) content — deferred to Phase 15.5. **Fluent library sentences are untouched** (they already translate). **Existing single-language block rows**: stamp `authoredLanguage = 'en'` by default (light migration or lazy default on read); they then render as correct English assets with a badge — no data loss.

*Confirmation test for the instructor (control vs broken, run before/after 3a):*
1. English profile → build *I want more* in the talker from known-translated core words → save.
2. Switch that profile to Hindi.
3. A normal category board flips *want* to Hindi (control); the saved sentence currently stays English text spoken in the Hindi voice (broken). After the fix it still displays English (correct — it's an English sentence) but speaks with an **English** voice and carries a **"Made in EN"** badge.

### Acceptance criteria — Thread 3

- Order-free symbols/words translate live on board switch (unchanged); a male-persona voice stays male across Hindi↔English.
- A composed item authored in English, viewed on a Hindi board, **displays English, speaks English (no Hindi accent), and shows a "Made in EN" badge.**
- No composed item is ever machine-translated in place; none produces wrong-accent audio.
- Switching the board language never mutates stored composed text.

### Edge cases — Thread 3

- **Legacy `sentence.text` as a bare string**: read as `{ en: string }`, `authoredLanguage = 'en'`. Extend the existing back-compat path (`SentencesModeContent.tsx:513-521`).
- **A sentence built from symbols of mixed authored languages** (possible via Thread 1 pins): each *unit* voices in its own resolved language; the item's `authoredLanguage` governs the badge and the fluent-tone assembly. Mixed audio is legitimate, not a bug.
- **Punjabi (`pa`) has no voices**: persona/voice resolution falls through (persona match → any voice in lang → default) without throwing.
- **Voice persona not available in target language** (e.g. no child voice seeded for a language): fall back to same-gender adult, then `voices[0]`, then default — never throw.

---

## Thread 1 — Bilingual symbols *(per-symbol language pin)*

### Problem

Multilingual families code-switch. A Hindi board should keep *specific* symbols in English — label **and** audio — as a deliberate instructor choice (a routine always said in English, a brand name, an English loanword). The advising SLP asked for exactly this. It is the one deliberate exception to "order-free content translates live": a pin overrides `displayValue`'s language selection even when a translation exists.

### Design

- New optional `pinnedLanguage?: string` on `profileSymbols`.
- When set: the symbol renders its label from `words[pinnedLanguage]` (or `label[pinnedLanguage]`) regardless of board language, and — via 3e — speaks in `pinnedLanguage`'s voice.
- When unset (default `Auto`): unchanged, follows board language.
- **UI:** Symbol Editor gains a **"Language"** control — `Auto (follow board) / English / हिन्दी / Español / …` from the registry. Default `Auto`.
- **Symbol instance level only** (per brainstorm) — not per-category, not per-board.

### Acceptance criteria — Thread 1

- A symbol pinned to English on a Hindi board shows its English label and speaks with an English voice.
- Clearing the pin restores board-language behaviour.
- A pinned symbol dropped into a talker sentence keeps its pin as a unit (resolves + voices in the pinned language).

### Edge cases — Thread 1

- **Pin to a language the symbol lacks a word for**: fall through `displayValue` (default `en` → first available); voice-match whatever resolves; never blank.
- **Pin to a voiceless language (`pa`)**: label pins; audio uses on-demand TTS with the best available voice, or falls through per 3f.

---

## Thread 2 — Tone TTS *(multi-intonation, fluent whole-utterance playback)*

### Problem

Meaning lives in melody (dossier doc 4 #4 — the most clinically load-bearing GLP Stage-1 feature). `/api/tts` hardcodes `speakingRate: 1.0`; there is no way to vary intonation. And prosody is a **whole-utterance** property — it cannot be applied to a stepped, block-by-block playback.

### Design — the blocky-replay vs fluent-tone split

- **Interaction: live, ephemeral modifier.** The play modals (`CompositionPlayModal`, `SentencePlayModal`) gain a **row of tone emoji chips**. Tapping one re-speaks the sentence with that prosody. Nothing is saved.
- **Block sentences keep their stepped "blocky" replay** (▶) — neutral, structural, for teaching/modelling. Unchanged.
- **The tone chips generate and play a single *fluent whole-utterance clip*** — the item's blocks assembled into one string **in its `authoredLanguage`**, synthesised with the tone's prosody, played as one clip. This gives block sentences a fluent playback they never had, and it sidesteps the language problem entirely: **tone only ever operates on a whole-utterance clip in the item's own authored language.**
- **Fluent sentences** get the same chip row on their existing whole-sentence clip.
- **It corrects prosody/flow, not grammar** — telegraphic input stays telegraphic, spoken with natural intonation.
- **Phrases are deferred from tone in V1** — their append/prepend join is awkward; revisit after the sentence path proves out.
- **V1 tone set: `Neutral` (default) + `Excited`.** Minimal, to prove the pipeline. `Excited` (pitch + rate) synthesises cleanly; the preset map makes `Asking`/`Calm`/`Sad` each a `{ pitch, rate, volume }` entry + a chip later. `Asking` (a natural question rise) is the hardest to fake with SSML and is the first candidate for a recorded-human fallback if added.

### Experimentation spike — do this FIRST, before committing tone UI

Tone quality is not guaranteed on the current voices, so the first task is a throwaway spike, not production code:

1. Test SSML `<prosody>` (pitch/rate/volume) on the **current Wavenet voices** via `/api/tts`. Judge whether `Excited` is audibly and acceptably distinct from `Neutral`.
2. If Wavenet prosody is too flat, evaluate **other Google TTS models/voices** (e.g. Neural2, Studio, or Chirp 3 HD — check EU availability per the London-based deployment) for prosody or style support. **A voice-quality upgrade is accepted** for this SLP-requested feature (the owner is happy to step up cost/quality here specifically).
3. Only after the spike proves an approach do we build the chip UI + cache-key change. If no synthesised approach is good enough, fall back to recorded-human variants for the few phrases that need them (dossier doc 4 #4).

This spike also informs voice strategy generally (it may surface better base voices worth adopting beyond tone).

### API / cache

- `/api/tts` accepts an optional `tone`. A `TONE_PRESETS` map wraps the text in SSML `<prosody>`. `Neutral`/absent = today's exact behaviour.
- Cache key + R2 path grow from `(text, voiceId)` to **`(text, voiceId, tone)`**; `Neutral` omits the tone segment so existing cached clips stay valid.
- Fluent-clip text for a block sentence = the blocks' `authoredLanguage` labels joined in order (authoring order is already correct within its own language). Cached and shared across users like all TTS.
- **Figma:** the tone-chip row is designed in Figma against existing design-system tokens before implementation (chips = emoji + label, e.g. 😐 Neutral · 😃 Excited).

### Acceptance criteria — Thread 2

- Block sentence modal: the stepped blocky replay is unchanged; the emoji row plays a fluent single clip.
- Neutral = current baseline; Excited differs audibly; both cache and are instant on repeat.
- Adding a tone later = a `TONE_PRESETS` entry + a chip (no schema change, no cache migration).

### Edge cases — Thread 2

- **Provider SSML support**: guard the SSML build so an unsupported attribute degrades to Neutral rather than a failed synth.
- **Empty/single-block sentence**: fluent clip = that block's text; still valid.

### Spike findings — Thread 2 (2026-07-09)

**Outcome: SSML prosody is rejected. Tone will use a prompt-driven expressive model (Gemini 2.5 native TTS), not `<prosody>`.** This changes the Task 12/13 mechanism from the original SSML plan — see "Revised approach" below.

**What was tested** (throwaway; direct Google TTS calls, no cache/R2 writes — clips A/B'd by the owner):

1. **SSML `<prosody pitch="+3st" rate="1.15">` on current Wavenet voices** (`en-GB-News-M`, `es-US-Wavenet-C`, `hi-IN-Wavenet-F`). Verdict: **too mechanical** — you can hear it's a flat read that's been pitch-shifted, not an emotional performance.
2. **Upgrade voices + an Angry preset** (`pitch −2st rate 1.1 vol +6dB`), across **Neural2 / Studio / Chirp3-HD**:
   - **Neural2** — accepts full prosody (pitch+rate+vol) in all three languages, EU-available. Still mechanical (same root cause: pitch-shifting a neutral read).
   - **Studio** — **rejects `pitch` in `<prosody>`** (`400`: *"…do not currently support `pitch` attributes for Studio voices"*); Excited/Angry silently degrade to Neutral. Also **no Hindi** voice. → unusable for pitch-based tone.
   - **Chirp3-HD** — accepts the SSML without error but is generative and effectively ignores the prosody; not audibly distinct. Best raw naturalness of the standard voices, but no usable prosody control.
   - Verdict: **all SSML-prosody options rejected.**
3. **Gemini 2.5 native TTS** (`gemini-2.5-flash-preview-tts`, via Vertex AI) — emotion supplied as a **natural-language instruction** (`"Say this in a bright, excited voice: …"`), not post-processing. Verdict: **accepted — "a massive step from Wavenet."** Neutral/Excited/Angry all convincing in EN/ES/HI.
   - **English accent**: defaults to US; steered to UK **purely by prompt** (`"Speak in a natural British English accent…"`), which composes with the emotion instruction for free (no separate voice model). Regional accent for any language is a prompt concern, not a voice-id concern.
   - **Chosen voice: `Puck`** (British-steered). Male, matches the seeded `en-GB-News-M` persona.

**Chosen tone presets (natural-language instructions, localise per language):**
- **Excited** — "in a bright, excited, happy voice"
- **Angry** — "in an angry, frustrated voice"
(Neutral = bare phrase, no instruction. Presets are prompt strings now, not `{pitch,rate,volume}` — the `TONE_PRESETS` shape in the plan becomes an instruction map.)

**Product & cost model (owner decision):** two-tier voice strategy.
- **Seeded Wavenet** stays the **cheap, GA, EU-resident** voice for the **whole library** — learning individual words + phrases. Unchanged.
- **Gemini expressive voices** power **fluency + tone only**, invoked **exclusively from the play modals** (`CompositionPlayModal` / `SentencePlayModal`) on the whole-utterance path.
- **Tone is a `max`-tier feature.** The pricey model therefore fires on a narrow path only; every clip is cached once in R2 (`(text, voiceId, tone)`) and served free thereafter — which also neutralises Gemini's per-call latency and run-to-run non-determinism.

**Technical notes for Task 12:**
- Reachability: preview model answered on **`us-central1`** only; `global` returned `500`; standard Wavenet/Neural2/Studio/Chirp3-HD are all fine on the EU endpoint but the **Gemini preview TTS was not confirmed on EU**.
- Output is **24 kHz mono PCM (L16) / WAV**, not MP3 — the route must wrap PCM → WAV (or transcode to MP3) before R2 upload; R2 path/cache logic is otherwise unchanged.
- **Caching is mandatory** (not just an optimisation) because output is non-deterministic — the first synthesis defines the canonical clip.
- Gemini voice ids (e.g. `Puck`) are a different namespace from the standard `TTS_VOICES`; Task 12 adds them alongside, tagged with persona/accent so voice-follows-text (Thread 3) still applies.

**Open decisions for the owner (not blockers):**
1. **EU data residency** — accept US-region (`us-central1`) *generation* of tone clips (low-sensitivity text; result stored in our EU R2), or wait for an EU-region / GA Gemini TTS? Current recommendation: accept US generation for the tone path given the sensitivity and one-time nature.
2. Confirm `max`-gating copy/upsell on the play modal when a free/pro user taps a tone chip (Task 13).

**Gate: PASSED** — a synthesised approach is acceptable, so Task 12 proceeds (with the Gemini mechanism above, superseding the SSML-prosody plan in Tasks 12–13). No throwaway code shipped: the spike used a standalone script against Google TTS directly, so `app/api/tts/route.ts` was never modified and needs no revert.

---

## Deferred — follow-on phase: Composed-content language variants

Not built in Phase 15. Captured here so the foundation stays forward-compatible. Roadmapped as **Phase 15.5**.

- **Default-to-bilingual is a first-class, permanent state.** An English-authored item that is *not* rebuilt stays a fully-working English asset — English symbols, English text, English audio, played correctly. This is not a broken/degraded state; it is a valid bilingual board. The instructor has a genuine **choice: rebuild in the target language, or leave it as a working English asset.**
- **Keep the working English symbols + text visible** when viewing an un-localised item on a target-language board, *plus* the "Made in EN" disclaimer — so the instructor can see exactly what the item is and what they'd be rebuilding.
- **Click the disclaimer/badge → enter EDIT MODE**, reusing the existing composition-builder components (preferred over a bespoke remake modal, for component reuse). The English original stays visible as a reference while the instructor authors the target-language version natively (correct order, correct phrases).
- **Reactive language-switch recognition** — the view must respond to a language switch the way the **search page already does** (re-query/re-resolve on `language` change). Use that as the reference pattern; the search page is the proof it works.
- **Linked per-language variants**: one logical "sentence slot" holds a separately-authored composition per language (`en` comp + `hi` comp). The `authoredLanguage` tag from 3b is the hook; variants link items that share a slot. Once a target-language variant exists, viewing that language shows the native variant instead of the English asset + badge.
- **MT as authoring assist**: inside the rebuild flow, offer a machine-translated fluent text as a *starting suggestion* (Pro+ gated); the instructor arranges symbols/phrases in correct target-language order. MT never ships unreviewed.
- **Monolingual families** keep the ADR-009 "one profile per language" pattern; the variant model is the bilingual-profile enhancement, not a requirement.

---

## Cross-thread summary

### Schema / data changes
- `profileSymbols.pinnedLanguage?: string` (Thread 1) — additive.
- `authoredLanguage: string` on `profilePhrases` + `profileSentences` (Thread 3b) — additive, legacy defaults `en`.
- Registry voice entries gain `{ gender, age }` persona metadata in `convex/data/languages/*.json` (Thread 3f) — data-only.
- **No schema change** for Thread 3 core text keying (records already open), for tone (ephemeral), or for any in-place translation (not built).

### API changes
- `/api/tts` gains optional `tone` → SSML prosody; cache key `(text, voiceId, tone)`.
- No new translate endpoint in Phase 15.

### Shared rules
- **Voice follows resolved text language** (3e; used by Threads 1, 2, 3).
- **Voice persona maps across languages** (3f).

### Build sequence
1. **Thread 3** — foundation: 3a/3b/3c text keying + authored-language render, 3d badge, 3e voice-follows-text, 3f persona. Everything else rests on this.
2. **Thread 1** — small; sits on 3e.
3. **Thread 2** — Figma the chip row, then `/api/tts` tone param + cache-key + play-modal fluent-clip generation.

### Resolved decisions (from brainstorm)
- **Persona axes** — `{ gender, age }` shape, but only `gender` (male/female, all adult, Wavenet) drives resolution now; `age` is modelled for a future voice upgrade (data-only, no resolver rewrite). Confirmed 2026-07-08.
- **Tone quality** — an experimentation spike gates the tone build; a voice-model/quality upgrade is accepted for this SLP request if Wavenet prosody is too flat. Confirmed 2026-07-08.
- **Rebuild UX** — default-to-bilingual (keep the working English asset) is a permanent valid state; rebuild is opt-in via the badge → edit mode (reusing composition components), search-page reactive switch pattern. Confirmed 2026-07-08 → Phase 15.5.
- **Roadmap** — Phase 15 entry reworded to the foundation model; Phase 15.5 (composed-content variants) added. Done 2026-07-08.

### Still open
- Exact `authoredLanguage` migration for existing single-language block rows (light backfill vs lazy default-on-read) — decide during implementation planning.

### Testing
- Thread 3 confirmation test (control vs broken) — before/after 3a.
- Cross-language regression: sentences from (a) translated symbols and (b) English-only custom words, on English/Hindi/Spanish profiles — verify display, voice, and badge.
- Persona test: male child voice, switch Hindi↔English, gender holds.
- Tone test: block sentence — blocky replay unchanged, emoji plays fluent clip; Neutral matches baseline, Excited differs and caches.
