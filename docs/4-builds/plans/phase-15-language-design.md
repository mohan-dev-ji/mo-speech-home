# Phase 15 — Bilingual Symbols + Tone TTS + Language-Switching Fixes — Design

> **Type:** Design spec (brainstorm output). Feeds a step-by-step implementation plan.
> **Status:** Design approved in brainstorm 2026-07-08. Not yet built.
> **Roadmap:** `docs/00-roadmap.md` → Phase 15. Clinical source: dossier doc 4 (#1, #4).
> **Architectural contracts:** ADR-009 (multi-language/multi-voice), ADR-012 (live text resolution), ADR-014 (structure frozen / text live), ADR-015 (composition primitive).

Phase 15 is **three linked but independent features**, all in the "language" family and all surfacing in the talker. They share one underlying principle (below), which is why they ship together.

**The shared principle:** *audio voice follows the language of the resolved **text**, never the board's current language.* English text is always spoken by an English voice — whether that English is a pinned bilingual tile (Thread 1), an untranslated sentence fragment (Thread 3), or anything else. This single rule appears in all three threads and is the spine of the phase.

---

## Thread 3 — Language-switching fixes *(build first — de-risks the others)*

### The diagnosis (root cause confirmed in code)

The whole app stores content as ISO-keyed localised records (`{ en: "dog", hi: "कुत्ता" }`) and resolves them live per profile language via `displayValue(value, currentLang, 'en')` — a 3-tier fallback (current → default `en` → first available). Normal category symbols translate correctly on language switch because they resolve their label live from a translated source.

**Block sentences built in the Phase 14 talker are the exception**, and they break in two lossy steps:

1. **Flatten on tap** — the moment a phrase/word enters the talker, its full localised record is collapsed to a single current-language string.
   `app/components/app/shared/ui/TalkerDropdown.tsx:508-524` — `name = displayString(p.name, language, DEFAULT_LOCALE)` etc. All other languages are discarded here, before the item is ever in the bar.
2. **Re-wrap under the wrong key on save** — `app/components/app/shared/sections/PersistentTalker.tsx:122-164` saves each unit as `{ [language]: string }`, filing the string under the *profile's current language key* even when the string is actually English:
   ```ts
   name:  { [language]: s.phraseName ?? s.label }   // only current lang
   label: { [language]: w.label }                    // only current lang
   ```
   On a Hindi profile, an English-authored sentence is stored as `{ hi: "I want more" }` — English text keyed `hi`.

**The silent symptom.** On playback, `blocksFromUnits` (`app/components/app/shared/ui/composition/blocks.ts:59-79`) calls `displayString(u.label, language, 'en')`. With only one key and no `en`, tier-3 always returns that one string — a language switch changes nothing. Meanwhile the resolved **voice** is the current-language voice. English text + Hindi voice = **English words in a Hindi/Spanish accent** — the exact reported symptom.

This **violates ADR-014's own contract**: "structure frozen, *text live*." Phase 14 froze the text. The fix restores the intended behaviour.

The `createProfileSentence` mutation (`convex/profileSentences.ts:113-157`) is a pure pass-through — it stores whatever the client sends. The bug is entirely client-side (flatten + re-wrap). The schema already permits full records (`compositionWord`/`compositionUnit` use open `localisedString`), so **no schema migration is required for the core fix.**

*Confirmation test for the instructor to run (control vs broken, side by side):*
1. Set a profile to **English**; build a short sentence in the talker from known-translated core words (e.g. *I want more*); save it.
2. Switch that profile to **Hindi**.
3. Observe: a normal category board flips *want* to Hindi (control — pipeline works), but the saved sentence stays English text and speaks English in the Hindi voice (broken). Seeing that split confirms the diagnosis.

### The "translated audio on demand" feature is NOT broken

Clarified in brainstorm: there is no "translate" button. The existing feature is *on-demand audio generation* — tap a list/sentence → if no audio exists for the current language + voice, synthesise via `/api/tts` and cache it (`resolveTtsKey`, keyed `(text, voiceId)`). It works correctly; it was simply being **fed poisoned text**. Fixing the text upstream fixes the audio.

### The three defects and their fixes

| # | Defect | Fix |
|---|--------|-----|
| **3a** | Text flattened to one language, keyed by the *profile* language rather than the text's actual language | Carry each unit's **full localised record from its source**, keyed by the language the text is actually in. Fix at both lossy points: `TalkerDropdown` (don't flatten on tap — keep the record) and `PersistentTalker` (store the record, not `{ [language]: string }`). Fresh instructor-typed text is keyed by the profile language (valid); content pulled from a source keeps that source's record. |
| **3b** | On-demand audio speaks whatever string it's handed, in the board voice | **Voice follows the resolved text's language, not the board language.** Resolve which language `displayValue` actually returned, and pick a voice for *that* language. English text → English voice, always. This alone neutralises the wrong-accent symptom even before 3a fully lands. |
| **3c** | "Wrong gender" — voice preference is a raw, language-specific `voiceId`; on language switch it falls through to `getLanguage(lang).voices[0]` (a fixed gender) | Store voice preference as a **persona (gender + age band)** that maps across languages, so a male child stays male when the board flips Hindi↔English. `resolveVoiceId` picks the voice in the target language whose persona matches, instead of `voices[0]`. Requires tagging each registry voice with `{ gender, age }` (data-only) and one resolver change. |

### On-demand translation *(the deliberate design choice)*

Translation of user-composed content is **lazy and click-triggered — never eager on language switch**:

- On **tap/play** of a sentence or list item, if a unit has no text for the current language, run that unit's source text through the translate pipeline (Gemini, the same Vertex client the admin pipelines use), **write the result back onto the record** (so it's a one-time cost, cached forever), tag it `translatedFrom: "<sourceLang>"`, then synthesise audio as today.
- Machine-translated content shows a small **"translated from English"** provenance badge. Composed-sentence machine translation is genuinely risky (Hindi word order + gender agreement can come out "the wrong way round"), so the badge lets the instructor spot and correct it.
- **Tier gate:** the on-demand *machine-translation* step is **Pro+ gated** (it is the roadmap's Phase 8.5 "Translate to current language" capability, and each call costs a Gemini request). The graceful fallback (keep the text in its authored language, speak it in the correct-language voice) is **free for everyone** — only the machine-translation enrichment is gated.

### Acceptance criteria — Thread 3

- A sentence built from translated symbols on an English profile, viewed on a Hindi profile, **displays and speaks Hindi**.
- A sentence built from English-only custom words, viewed on a Hindi profile, **displays English and speaks English (English voice, no Hindi accent)** — until translated on demand.
- Tapping such a sentence (Pro+) fills in the Hindi text, caches it, tags it "translated from English", and future taps are instant.
- Switching board language back and forth never changes stored text incorrectly and never produces wrong-accent audio.
- A male-persona voice stays male across a Hindi↔English switch.

### Edge cases — Thread 3

- **Legacy `sentence.text` as a bare string** (pre-8.0 migration): treat a bare string as `{ en: string }` on read; back-compat path in `SentencesModeContent.tsx:513-521` already tolerates this — extend it rather than remove it.
- **Mixed-language sentences** (some units translated, some pinned English via Thread 1): each unit resolves and voices independently — this is correct, not a bug. The sentence may legitimately be spoken half in Hindi, half in English.
- **Translate-on-demand failure** (Gemini error/timeout): fall back to authored-language text + correct-language voice; do not block playback; do not write a partial/failed translation.
- **Punjabi (`pa`) has no voices yet**: `voices: []`. Voice resolution must fall through gracefully (persona match → any voice in lang → default) without throwing.

---

## Thread 1 — Bilingual symbols *(per-symbol language pin)*

### Problem

Multilingual families code-switch. A Hindi board should be able to keep *specific* symbols in English — label **and** audio — as a deliberate instructor choice (e.g. a routine always said in English, a brand name, an English loanword). The advising SLP asked for exactly this.

Note the convergence: once Thread 3b (voice follows text language) lands, a symbol that is merely *untranslated* already code-switches on its own. But that is accidental (it flips to Hindi the moment a translation arrives). Thread 1 is a **deliberate pin** that overrides `displayValue`'s language selection even when a translation exists.

### Design

- New optional field `pinnedLanguage?: string` on `profileSymbols`.
- When set, the symbol renders its label from `words[pinnedLanguage]` (or `label[pinnedLanguage]`) regardless of board language, and — via the shared voice rule — speaks in `pinnedLanguage`'s voice.
- When unset (default), behaviour is unchanged: follow the board language.
- **UI:** the Symbol Editor gains a **"Language"** control — `Auto (follow board) / English / हिन्दी / Español / …`, populated from the language registry. Default `Auto`.
- Applies at the **symbol instance** level only (per brainstorm decision) — not per-category, not per-board. Smallest lift; covers the SLP's request precisely.

### Acceptance criteria — Thread 1

- A symbol pinned to English on a Hindi board shows its English label and speaks with an English voice.
- Clearing the pin (back to Auto) restores board-language behaviour.
- A pinned symbol added to a talker sentence keeps its pin inside the sentence (its unit resolves to the pinned language, spoken in that language's voice).

### Edge cases — Thread 1

- **Pin to a language the symbol has no word for**: fall back through `displayValue` (default `en` → first available) and voice-match whatever text resolves. Never render blank.
- **Pin to a language with no voice (e.g. `pa`)**: label pins correctly; audio uses on-demand TTS with the best available voice for that language, or falls through per Thread 3c.

---

## Thread 2 — Tone TTS *(multi-intonation sentence playback)*

### Problem

Meaning lives in melody — dossier doc 4 #4 calls tone "the most clinically load-bearing" GLP Stage-1 feature. The same utterance said excitedly vs flatly carries different content. Today `/api/tts` hardcodes `speakingRate: 1.0`; there is no way to vary intonation.

### Design

- **Interaction: live, ephemeral modifier** (per brainstorm). The fluent-sentence play modals (`CompositionPlayModal`, `SentencePlayModal`) gain a **row of tone chips**. Tapping a chip re-speaks the sentence with that prosody. **Nothing is saved** — it is real-time expression. No schema change.
- **V1 tone set: `Neutral` (default) + `Excited`.** Deliberately minimal — prove the prosody pipeline with one expressive tone. The preset map is built so `Asking`, `Calm`, `Sad`, etc. are each just a `{ pitch, rate, volume }` entry + a chip added later.
- **API:** `/api/tts` accepts an optional `tone` param. A `TONE_PRESETS` map turns it into SSML `<prosody>` (pitch/rate/volume) wrapping the text. `Neutral`/absent = today's exact behaviour (backward compatible).
- **Cache:** the `ttsCache` key and R2 path grow from `(text, voiceId)` to **`(text, voiceId, tone)`** so each intonation is its own cached clip. `Neutral` omits the tone segment so existing cached clips remain valid (no cache bust).
- **Fidelity note:** SSML prosody generates most tones well on the Wavenet/News voices. A natural **question rise is the hardest to fake** — if `Asking` is added later and sounds off, it is the first candidate for a recorded-human-variant fallback (dossier doc 4 #4). `Excited` (pitch + rate) synthesises cleanly, which is why it is the V1 choice.
- **Figma:** the tone-chip row is designed in Figma against the existing design-system tokens before implementation (chips: emoji + label, e.g. 😐 Neutral · 😃 Excited).

### Acceptance criteria — Thread 2

- The sentence play modal shows Neutral + Excited chips; Neutral is the default and matches current playback exactly.
- Tapping Excited re-speaks the current sentence at higher pitch/rate; the clip is cached and instant on repeat.
- Adding a third tone later requires only a `TONE_PRESETS` entry + a chip (no cache migration, no schema change).

### Edge cases — Thread 2

- **Voice/tone interaction with Thread 3b**: tone applies per block; each block is already voiced in its resolved text-language. Excited-in-English and Excited-in-Hindi are distinct cache entries — correct.
- **Provider SSML support**: guard the SSML build so an unsupported prosody attribute degrades to plain text (Neutral) rather than a failed synth call.

---

## Cross-thread summary

### Schema / data changes
- `profileSymbols.pinnedLanguage?: string` (Thread 1) — additive, optional.
- Registry voices tagged with `{ gender, age }` persona metadata (Thread 3c) — data-only in `convex/data/languages/*.json` voice entries.
- `translatedFrom?: string` provenance marker on translated units/sentences (Thread 3) — additive, optional.
- **No schema change** for the Thread 3 core text fix (records already open) or for Thread 2 tone (ephemeral).

### API changes
- `/api/tts` gains optional `tone` param → SSML prosody; cache key becomes `(text, voiceId, tone)`.
- New lazy translate path invoked from sentence/list tap (Pro+), writing back translated records.

### Shared rules
- **Voice follows resolved text language** (Threads 1 & 3) — one resolver change, used everywhere.
- **Voice persona maps across languages** (Thread 3c).

### Build sequence
1. **Thread 3** first — it fixes the foundational text/voice resolution the other two rely on. Land 3a + 3b + 3c (the fixes), then the lazy translate-on-demand + badge.
2. **Thread 1** — small, sits on the shared voice rule.
3. **Thread 2** — most design-forward; Figma the chip row, then the API + cache-key + modal work.

### Open items to confirm at review
- Pro+ gating for on-demand machine translation (proposed default; roadmap-consistent).
- Exact persona axes for voices — `{ gender: 'male'|'female', age: 'adult'|'child' }` proposed; confirm against the seeded voice set (ADR-009 §8.4: 4 voices/language = adult M/F + child M/F).

### Testing
- The Thread 3 confirmation test above (control vs broken) — run before and after the fix.
- Cross-language regression: build sentences from (a) translated symbols and (b) English-only custom words; verify display + voice on English/Hindi/Spanish profiles.
- Persona test: set a male child voice, switch Hindi↔English, confirm gender holds.
- Tone test: Neutral matches baseline; Excited differs audibly and caches.
