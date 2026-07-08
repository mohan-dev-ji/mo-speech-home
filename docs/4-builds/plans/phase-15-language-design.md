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

### The confirmed bug (still real, still fixed)

Talker sentences flatten every unit to a single current-language string at save and file it under the *profile's* language key:

- **Flatten on tap** — `app/components/app/shared/ui/TalkerDropdown.tsx:508-524` collapses a phrase/word's full localised record to `displayString(..., language, DEFAULT_LOCALE)`; other languages are discarded before the item is in the bar.
- **Re-wrap under the wrong key** — `app/components/app/shared/sections/PersistentTalker.tsx:122-164` stores `{ [language]: string }`, so a Hindi profile files English text under `hi`.
- **Silent symptom** — `blocksFromUnits` (`app/components/app/shared/ui/composition/blocks.ts:59-79`) resolves to that one string regardless of board language, while the resolved *voice* is the board voice → **English words in a Hindi/Spanish accent.**

`createProfileSentence` (`convex/profileSentences.ts:113-157`) is a pass-through; the bug is client-side. The "translate audio on demand" feature the instructor remembers is *on-demand TTS synthesis* (`resolveTtsKey`, keyed `(text, voiceId)`) — it works; it was fed poisoned text.

### The foundation fix (Phase 15 scope)

| # | Fix | Detail |
|---|-----|--------|
| **3a** | **Key text by its real language** | Carry each unit's full localised record from its source, keyed by the language the text is actually in. Fresh instructor-typed text is keyed by the authoring language. Fix both lossy points (`TalkerDropdown` tap; `PersistentTalker` save). This requires threading records — not pre-flattened strings — through `TalkerSymbolItem`. |
| **3b** | **`authoredLanguage` on composed items** | Every composed item — `profilePhrases`, `profileSentences` (block/sequence *and* fluent) — carries an explicit `authoredLanguage`. Legacy rows default to `en`. |
| **3c** | **Render composed items in their authored language, always** | Composed items resolve text and voice against their own `authoredLanguage`, **not** the board language, and never attempt translation. An English sentence on a Hindi board displays and speaks correct English. |
| **3d** | **"Made in \<lang\>" badge** | When the board language ≠ an item's `authoredLanguage`, show a small language badge on the item so the instructor understands why it didn't switch. This badge is the seed of the follow-on phase's "edit to localise" affordance. |
| **3e** | **Voice follows resolved text language** | The shared rule. Used for composed items (authored language) *and* for order-free content (board language). Neutralises the wrong-accent symptom structurally. |
| **3f** | **Voice persona across languages (gender fix)** | Store voice preference as a persona (`gender` + `age band`), not a raw language-specific `voiceId`. On a language switch of order-free content, `resolveVoiceId` picks the target-language voice whose persona matches, instead of falling to `voices[0]` (a fixed gender). Registry voices gain `{ gender, age }` metadata (data-only). |

**Explicitly NOT in Phase 15:** any in-place translation of composed content. Deferred to the variants phase (below).

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

---

## Deferred — follow-on phase: Composed-content language variants

Not built in Phase 15. Captured here so the foundation stays forward-compatible.

- **Linked per-language variants**: one logical "sentence slot" holds a separate, natively-authored composition per language (`en` comp + `hi` comp). The `authoredLanguage` tag from 3b is the hook; variants link items that share a slot.
- **"Made in EN — edit to build the Hindi version"**: the badge from 3d becomes an action. Viewing a slot in a language it lacks shows the prompt; tapping opens the composition builder in that language's authoring mode.
- **MT as authoring assist**: inside the localise flow, offer a machine-translated fluent text as a *starting suggestion* (Pro+); the instructor arranges symbols/phrases in correct target-language order. MT never ships unreviewed.
- **View behaviour**: a slot shows its current-language variant, or the "build it" prompt — replacing Phase 15's always-show-in-authored-language + badge.
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

### Open items to confirm at review
- Persona axes — `{ gender: 'male'|'female', age: 'adult'|'child' }` proposed; confirm against the seeded voice set (ADR-009 §8.4 targets 4 voices/language, but the current registry appears to ship adult M/F only for en/es/hi — the persona resolver must degrade gracefully until child voices are seeded).
- Roadmap update: the Phase 15 entry still says "click to translate is broken"; it should be reworded to the foundation model, and a new follow-on phase (composed-content variants) added.

### Testing
- Thread 3 confirmation test (control vs broken) — before/after 3a.
- Cross-language regression: sentences from (a) translated symbols and (b) English-only custom words, on English/Hindi/Spanish profiles — verify display, voice, and badge.
- Persona test: male child voice, switch Hindi↔English, gender holds.
- Tone test: block sentence — blocky replay unchanged, emoji plays fluent clip; Neutral matches baseline, Excited differs and caches.
