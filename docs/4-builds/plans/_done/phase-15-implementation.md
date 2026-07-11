# Phase 15 — Bilingual Symbols + Tone TTS + Language Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Design spec (read first):** [`phase-15-language-design.md`](phase-15-language-design.md). **Visual companion:** [`phase-15-figma-companion.md`](phase-15-figma-companion.md) — build/confirm the Figma frames before implementing the UI tasks (Thread 1 Task 9, Thread 2 Task 13, Thread 3 Task 5).

**Goal:** Fix the block-sentence language regression, add per-symbol bilingual pins, and add tone (Neutral + Excited) to fluent sentence playback.

**Architecture:** Three independent threads on `main`, build in order. **Thread 3 (foundation)** stamps composed items with `authoredLanguage`, resolves block sentences against *that* (never the board language — see the ⚠️ rule below), makes the TTS voice follow the resolved text's language, and badges cross-language items. **Thread 1** adds a per-symbol `pinnedLanguage`. **Thread 2** adds a `tone` param to the TTS pipeline and a tone-chip row on the play modal, after an experimentation spike proves prosody quality.

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Tailwind 4 / next-intl v4 / Convex 1.x / Google Cloud TTS (SSML).

## Global Constraints

- **The two governing principles** (from the design spec): (1) **voice follows the language of the resolved *text*, never the board language**; (2) **order-free content (symbols/words) translates live; structure-bound content (phrases, block sentences) is re-authored per language, never machine-translated in place.**
- **⚠️ Never resolve block-sentence units against the board `language`.** Resolve against the sentence's `authoredLanguage`. Board-language resolution shows target-language words in source word-order = grammatically wrong. This is the single most important rule in Thread 3.
- **Fluent library sentences are untouched** — they hold a translated top-level `text` record and keep resolving live per board language. Only block/sequence sentences (`playback === 'sequence'`) and phrases change.
- **i18n:** all UI copy via `useTranslations`; new keys go to **`messages/en.json` only** (never hand-add to other locales — `i18n/request.ts` merges en as fallback and the translate pipeline skips already-valued keys). Real English.
- **Theme tokens:** no hard-coded colours/spacing/radii/font-size — use `--theme-*` utilities (`bg-theme-*`, `text-theme-*`, `rounded-theme-*`, `border-theme-*`) or `var(--theme-*)` inline where unavoidable.
- **Never hard-code a language code** — route reads through `displayValue()`/`displayString()` + the active `language`; the registry is the source of truth for locales and voices.
- **No test harness:** "Verify" = `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc --noEmit` clean (ignore the pre-existing `lib/stripe.ts` error) + targeted `grep` + manual check on the running dev server (port 3001, already running — do NOT start `npm run dev` or `npx convex dev`; the user runs `convex dev` on `main`). For Convex-only type checks use `npx tsc -p convex/tsconfig.json --noEmit`.
- **Backups:** before Task 1 (schema change) and Task 12 (TTS cache-key change), the user should run a deployment snapshot per CLAUDE.md ("Backups"). Flag it; do not run it yourself.

---

## File structure

**Thread 3 — Language foundation**
- Modify: `convex/schema.ts` — add `authoredLanguage` to `profileSentences` + `profilePhrases`; `profileSymbols.pinnedLanguage` (Thread 1).
- Modify: `convex/profileSentences.ts` — accept `authoredLanguage` in `createProfileSentence` (+ update mutations that create sequence sentences).
- Modify: `convex/profilePhrases.ts` — accept `authoredLanguage` in phrase creation.
- Modify: `convex/data/languages/types.ts` — add optional `age` to `VoiceEntry`.
- Modify: `lib/audio/resolveVoiceId.ts` — persona-preserving resolution + new `voiceForLanguage(lang, persona)` export.
- Modify: `lib/languages/displayValue.ts` — add `resolvedLocale()` (which key `displayValue` picked).
- Modify: `app/components/app/shared/ui/composition/blocks.ts` — `blocksFromUnits` resolves against `authoredLanguage`; each block carries its resolved locale for voice selection.
- Modify: `app/components/app/shared/modals/CompositionPlayModal.tsx` + `app/components/app/sentences/modals/SentencePlayModal.tsx` — voice-follows-text at synthesis.
- Modify: `app/components/app/shared/sections/PersistentTalker.tsx` — stamp `authoredLanguage` at save; carry source records (Task 6).
- Modify: `app/components/app/shared/ui/TalkerDropdown.tsx` — stop discarding source records on tap (Task 6).
- Modify: `app/contexts/TalkerContext.tsx` — optional record fields on `TalkerSymbolItem` (Task 6).
- Modify: `app/components/app/sentences/sections/SentencesModeContent.tsx` — pass `authoredLanguage`; render the "Made in <lang>" badge.
- Modify: `messages/en.json` — badge copy.

**Thread 1 — Bilingual symbols**
- Modify: `convex/schema.ts` (with Task 1) + the profileSymbols create/update mutation to accept `pinnedLanguage`.
- Modify: the Symbol Editor display/properties panel — a "Language" select. (Find via `grep -rl "SymbolEditorModal\|PropertiesPanel" app/components`.)
- Modify: `convex/profileCategories.ts` (`getProfileSymbolsWithImages`, ~line 191-234) — honour `pinnedLanguage` when resolving label + audio path.

**Thread 2 — Tone**
- Modify: `app/api/tts/route.ts` — `tone` param, SSML `<prosody>`, cache key.
- Modify: `convex/ttsCache.ts` — add `tone` to the cache key/index.
- Modify: `lib/audio/playTts.ts` — thread `tone` through `resolveTtsKey`/`playTts`.
- Create: `lib/audio/tonePresets.ts` — `TONE_PRESETS` map.
- Modify: `CompositionPlayModal.tsx` + `SentencePlayModal.tsx` — tone-chip row + fluent-clip assembly for block sentences.
- Modify: `messages/en.json` — tone labels.

---

# THREAD 3 — Language foundation (build first)

## Task 1: Schema — `authoredLanguage` on composed items (+ `pinnedLanguage` for Thread 1)

**Files:**
- Modify: `convex/schema.ts` — `profileSentences`, `profilePhrases`, `profileSymbols` table definitions.

- [ ] **Step 1:** In `profileSentences` add `authoredLanguage: v.optional(v.string())` (optional so existing rows validate; treated as `'en'` on read — Task 7). Add the same to `profilePhrases`.
- [ ] **Step 2:** In `profileSymbols` add `pinnedLanguage: v.optional(v.string())` (used by Thread 1).
- [ ] **Step 3:** Verify: `npx tsc -p convex/tsconfig.json --noEmit` clean. Confirm no existing seed/migration writes these tables with a closed validator that would now reject.
- [ ] **Step 4:** Commit: `feat(phase15): add authoredLanguage + pinnedLanguage schema fields`.

## Task 2: Voice persona — preserve gender/age across a language switch

`VoiceEntry` already has `gender: "male" | "female"` (`convex/data/languages/types.ts:27-36`). The gap: `resolveVoiceId` (`lib/audio/resolveVoiceId.ts:26-46`) falls to `getLanguage(lang).voices[0]` on a mismatch, ignoring the previously-chosen gender.

**Files:**
- Modify: `convex/data/languages/types.ts`, `lib/audio/resolveVoiceId.ts`.

- [ ] **Step 1:** Add `age?: "adult" | "child"` to `VoiceEntry` (optional; today all seeded voices are adult — do NOT add values to the JSON yet, just the type, so a future upgrade is data-only).
- [ ] **Step 2:** Add a `personaOf(voiceId)` helper: look the voice up in the registry, return `{ gender, age }` (default `age: "adult"`).
- [ ] **Step 3:** Add `voiceForLanguage(lang: string, persona?: { gender?: "male"|"female"; age?: "adult"|"child" }): string`. It returns the `ttsVoiceId` of the voice in `lang` matching `persona.gender` (then `age`), else `voices[0]`, else `DEFAULT_VOICE_ID`. Never throws (Punjabi has `voices: []`).
- [ ] **Step 4:** In `resolveVoiceId`, when the stored preference is a voice for a *different* language than requested, re-map via `voiceForLanguage(lang, personaOf(storedVoiceId))` instead of jumping straight to `voices[0]`.
- [ ] **Step 5:** Verify: `tsc` clean; on the dev server, set a male voice on an English profile, switch the profile to Hindi, confirm the resolved Hindi voice is male (`hi-IN-Wavenet-M`-class), not `voices[0]` if that is female. Use `preview_*` tools.
- [ ] **Step 6:** Commit: `feat(phase15): persona-preserving voice resolution across languages`.

## Task 3: Voice-follows-text — synthesise in the resolved text's language

**Files:**
- Modify: `lib/languages/displayValue.ts`, `app/components/app/shared/modals/CompositionPlayModal.tsx`, `app/components/app/sentences/modals/SentencePlayModal.tsx`.

- [ ] **Step 1:** In `displayValue.ts` add:

```ts
/** Which locale key displayValue actually resolved to (tier 1/2/3), or undefined. */
export function resolvedLocale(
  value: Record<string, unknown> | undefined,
  currentLang: string,
  defaultLang?: string,
): string | undefined {
  if (!value) return undefined;
  if (currentLang in value) return currentLang;
  if (defaultLang && defaultLang in value) return defaultLang;
  return Object.keys(value)[0];
}
```

- [ ] **Step 2:** In both play modals, at the point where a block/sentence has no pre-recorded/snapshot clip and calls `resolveTtsKey(text, voiceId)`, derive the voice from the *text's* locale: compute `loc = resolvedLocale(record, resolveLang, DEFAULT_LOCALE)` and use `voiceForLanguage(loc, personaOf(profileVoiceId))` instead of the raw board `voiceId`. (`resolveLang` = the sentence's `authoredLanguage` for block sentences, the board `language` for fluent sentences.)
- [ ] **Step 3:** Verify: build an English sentence, switch board to Hindi, play — audio is English-voiced (no Hindi accent). `tsc` clean.
- [ ] **Step 4:** Commit: `feat(phase15): TTS voice follows resolved text language`.

## Task 4: Resolve block sentences against `authoredLanguage` + stamp it at save

**Files:**
- Modify: `app/components/app/shared/ui/composition/blocks.ts`, `app/components/app/sentences/sections/SentencesModeContent.tsx`, `app/components/app/shared/modals/CompositionPlayModal.tsx`, `app/components/app/shared/sections/PersistentTalker.tsx`.

- [ ] **Step 1:** Change `blocksFromUnits(units, language)` → `blocksFromUnits(units, resolveLang)` and make each returned `PlayBlock` also carry its resolved locale (extend `PlayWord`/`PlayPhrase` with `locale?: string`, set from `resolvedLocale(u.label ?? u.name, resolveLang, DEFAULT_LOCALE)`), so Task 3's voice selection has it. ⚠️ Callers pass the sentence's `authoredLanguage` here, **not** the board language.
- [ ] **Step 2:** Update every `blocksFromUnits(...)` caller. In `SentencesModeContent.tsx` (the `blocksFromUnits(sentence.units!, language)` call ~line 525 and the seq-full-text derivation) pass `sentence.authoredLanguage ?? 'en'`. In the `CompositionPlayModal` open path pass the same.
- [ ] **Step 2b:** For the *live talker* Play (composing, not yet saved) — `blocksFromTalker` — keep using the current board `language` context (a sentence being composed IS in the board language). No change to `blocksFromTalker`.
- [ ] **Step 3:** In `PersistentTalker.tsx` `handleSaveConfirm` (~lines 158-170), add `authoredLanguage: language` to the `createProfileSentence({...})` call (the board language at authoring time). Do the same anywhere a phrase is created (`createProfilePhrase`).
- [ ] **Step 4:** Verify: build an English sentence, switch to Hindi — the saved sentence still displays coherent English (not Hindi words in English order) and is English-voiced. `tsc` clean.
- [ ] **Step 5:** Commit: `fix(phase15): resolve block sentences against authoredLanguage, not board language`.

## Task 5: "Made in <lang>" badge on cross-language composed items

**Files:**
- Modify: `app/components/app/sentences/sections/SentencesModeContent.tsx` (sentence row), `messages/en.json`. (If phrases render a comparable row, add there too.)

- [ ] **Step 1:** Add `en.json` key, e.g. `"sentences.madeInBadge": "Made in {lang}"` (lang = the native label from the registry for `authoredLanguage`).
- [ ] **Step 2:** In the sentence row, when `isSequenceRow(sentence) && (sentence.authoredLanguage ?? 'en') !== language`, render a small badge using theme tokens (`bg-theme-*`, `rounded-theme-sm`, `text-theme-*`). Confirm the Figma frame (companion doc, Thread 3) before styling.
- [ ] **Step 3:** Verify: badge shows on an English sentence viewed on a Hindi board; hidden when board = authored language. `preview_*` screenshot.
- [ ] **Step 4:** Commit: `feat(phase15): 'Made in <lang>' badge on cross-language sentences`.

## Task 6: Carry source localised records through the talker (mixed-language robustness)

Fixes the edge case: an English-only symbol tapped onto a Hindi board is currently re-keyed `hi`. Additive — existing `string` consumers keep working.

**Files:**
- Modify: `app/contexts/TalkerContext.tsx`, `app/components/app/shared/ui/TalkerDropdown.tsx`, the board tap site (`CategoryDetailContent.tsx` `onTap`/`addToTalker`), `app/components/app/shared/sections/PersistentTalker.tsx`.

- [ ] **Step 1:** In `TalkerContext.tsx` add optional record fields to `TalkerSymbolItem`: `labelRecord?: Record<string,string>`, `phraseNameRecord?: Record<string,string>`, and on `TalkerPhraseWord` a `labelRecord?: Record<string,string>`. Keep the existing `label: string` etc. for back-compat.
- [ ] **Step 2:** At the tap sites, populate the record fields from the source (`TalkerDropdown.tsx:508-524` pass `p.name`/`w.label` records; the board tap passes the symbol's `label` record) instead of only the `displayString`ed string.
- [ ] **Step 3:** In `PersistentTalker.tsx` `handleSaveConfirm`, when building each unit prefer the record: `name: s.phraseNameRecord ?? { [language]: s.phraseName ?? s.label }` (and likewise `label`). This keys the text by its true source language when known.
- [ ] **Step 4:** Verify: on a Hindi board, tap an English-only symbol into a sentence, save, play — it is English-voiced and badged, not Hindi-accented. `tsc` clean.
- [ ] **Step 5:** Commit: `fix(phase15): carry source localised records through the talker`.

## Task 7: Legacy default `authoredLanguage = 'en'`

**Files:**
- Modify: read sites that consume `sentence.authoredLanguage` (Tasks 4–5) — ensure every read is `?? 'en'`. Optionally a one-off backfill script under `scripts/`.

- [ ] **Step 1:** Grep `authoredLanguage` across the app; confirm each read defaults to `'en'`. (No migration strictly required — lazy default-on-read is sufficient.)
- [ ] **Step 2:** Verify: an old block sentence (pre-Phase-15) renders as a correct English asset with the badge on a Hindi board. `tsc` clean.
- [ ] **Step 3:** Commit: `chore(phase15): default legacy sentences to authoredLanguage=en`.

---

# THREAD 1 — Bilingual symbols (per-symbol pin)

## Task 8: `pinnedLanguage` mutation plumbing

(Schema field added in Task 1.)

**Files:**
- Modify: the profileSymbols create/update mutation (find via `grep -rln "profileSymbols" convex | grep -i "mutation\|patch\|insert"`).

- [ ] **Step 1:** Add `pinnedLanguage: v.optional(v.string())` to the update mutation args and patch it through. Passing `undefined`/`null` clears the pin.
- [ ] **Step 2:** Verify: `npx tsc -p convex/tsconfig.json --noEmit` clean.
- [ ] **Step 3:** Commit: `feat(phase15): accept pinnedLanguage on profileSymbol update`.

## Task 9: Symbol Editor "Language" control

**Prerequisite:** confirm the Figma frame (companion doc, Thread 1) for the control's placement in the display/properties panel.

**Files:**
- Modify: the Symbol Editor display panel component; `messages/en.json`.

- [ ] **Step 1:** Add a `Language` select: options `Auto (follow board)` (value `undefined`) + one per registry language (`getLanguages().map(l => ({ value: l.code, label: l.nativeLabel }))`). Bind to the editor's working `pinnedLanguage`. Copy key `symbolEditor.languageLabel` etc. in `en.json`.
- [ ] **Step 2:** On save, include `pinnedLanguage` in the mutation call (Task 8).
- [ ] **Step 3:** Verify: set a symbol to English on a Hindi profile via the editor; the value persists. `preview_*` check.
- [ ] **Step 4:** Commit: `feat(phase15): Symbol Editor language pin control`.

## Task 10: Apply the pin in board render + audio

**Files:**
- Modify: `convex/profileCategories.ts` `getProfileSymbolsWithImages` (~lines 191-234), and the board tile render in `CategoryDetailContent.tsx` (~line 449).

- [ ] **Step 1:** In `getProfileSymbolsWithImages`, when `ps.pinnedLanguage` is set, resolve the label + audio path against `pinnedLanguage` instead of the requested `language` (audio: `resolveSymbolAudioPath(voiceForLanguage(pinnedLanguage, personaOf(voiceId)), sym.words.en, ...)`).
- [ ] **Step 2:** In the board tile, resolve the display label against `sym.pinnedLanguage ?? language` (via `displayString`). The tap → talker should carry the pinned language too (set `labelRecord` to `{ [pinnedLanguage]: pinnedLabel }` so it survives into sentences per Task 6).
- [ ] **Step 3:** Verify: a symbol pinned to English on a Hindi board shows the English label and speaks English. `preview_*` screenshot + audio check.
- [ ] **Step 4:** Commit: `feat(phase15): render + voice per-symbol language pin`.

---

# THREAD 2 — Tone TTS

## Task 11: Experimentation spike (throwaway — do FIRST)

**Goal:** decide whether SSML prosody on the current voices is good enough, before building any UI.

- [ ] **Step 1:** Temporarily allow `/api/tts` to accept a raw `ssml` field (or a `tone`), and hand-POST a few sentences with `<prosody pitch="+3st" rate="1.15">` (Excited) vs plain, on `en-GB-News-M`, `hi-IN-Wavenet-F`, `es-US-Wavenet-C`. Listen.
- [ ] **Step 2:** If Wavenet prosody is too flat, POST the same to candidate Google voices (Neural2 / Studio / Chirp 3 HD — check EU availability, per the London deployment). Note quality + cost.
- [ ] **Step 3:** Record findings in a short note at the bottom of the design spec (`phase-15-language-design.md`, Thread 2) — chosen approach + any voice-set upgrade. Revert the throwaway `ssml` passthrough.
- [ ] **Step 4:** Commit the findings note: `docs(phase15): tone spike findings`. **Gate:** only proceed to Task 12 if a synthesised approach is acceptable; otherwise re-scope to recorded variants with the user.

## Task 12: `/api/tts` tone param + SSML + cache key

**Files:**
- Create: `lib/audio/tonePresets.ts`. Modify: `app/api/tts/route.ts`, `convex/ttsCache.ts`, `lib/audio/playTts.ts`.

- [ ] **Step 1:** `tonePresets.ts`:

```ts
export type Tone = "neutral" | "excited";
export const TONE_PRESETS: Record<Tone, { pitchSt?: number; rate?: number; volumeDb?: number }> = {
  neutral: {},                         // no wrapping — byte-identical to today
  excited: { pitchSt: 3, rate: 1.15 }, // tune from the Task 11 spike
};
```

- [ ] **Step 2:** In `/api/tts/route.ts` accept optional `tone` (default `neutral`). For non-neutral, wrap text in `<speak><prosody pitch="+Nst" rate="R">…</prosody></speak>` and send as `input.ssml` instead of `input.text`. Guard: on any SSML build issue, fall back to plain `neutral`.
- [ ] **Step 3:** Thread `tone` into the cache key: `ttsCache` lookup/write key becomes `(normalisedText, voiceId, tone)`; **omit the tone segment when `neutral`** so existing cached clips stay valid. Update the `by_text_voice` index → `by_text_voice_tone` (or append `tone` with a `neutral` default). R2 path: `audio/{voiceId}/tts/{tone}/{uuid}.mp3` for non-neutral.
- [ ] **Step 4:** In `playTts.ts`, add optional `tone` to `resolveTtsKey(text, voiceId, tone?)` / `playTts(...)`, passed to `/api/tts`.
- [ ] **Step 5:** Verify: POST neutral (cache hit on existing clips) and excited (new clip) for the same text/voice; confirm two distinct cached entries. `tsc` clean. Flag the pre-Task backup.
- [ ] **Step 6:** Commit: `feat(phase15): tone param through TTS pipeline + cache key`.

## Task 13: Tone-chip row on the play modal + block fluent-clip

**Prerequisite:** confirm the Figma frame (companion doc, Thread 2) for the chip row.

**Files:**
- Modify: `app/components/app/shared/modals/CompositionPlayModal.tsx`, `app/components/app/sentences/modals/SentencePlayModal.tsx`, `messages/en.json`.

- [ ] **Step 1:** Add a tone-chip row (😐 Neutral · 😃 Excited) using theme tokens. Copy keys `tone.neutral` / `tone.excited` in `en.json`. Neutral is the default/selected state.
- [ ] **Step 2 (fluent sentence):** In `SentencePlayModal`, tapping a chip re-runs `resolveTtsKey(sentenceText, voiceId, tone)` and plays the returned clip.
- [ ] **Step 3 (block sentence):** In `CompositionPlayModal`, keep the existing stepped blocky replay (▶) unchanged. Add a helper `fluentText(blocks)` = join block `ttsText` in order (authored-language). A chip tap synthesises `resolveTtsKey(fluentText, voiceForLanguage(authoredLocale, persona), tone)` and plays it as ONE clip. (This is the "fluent tone-corrected" playback — one whole-utterance clip, cached + shared.)
- [ ] **Step 4:** Verify: block sentence — blocky replay still steps clip-by-clip; Excited chip plays a single fluent higher-energy clip and caches. Neutral chip matches the fluent baseline. `preview_*` audio + screenshot.
- [ ] **Step 5:** Commit: `feat(phase15): tone chips + block-sentence fluent playback`.

---

## Self-review — spec coverage

- Thread 3 design fixes 3a→3f: 3a Task 6, 3b Task 1, 3c Task 4, 3d Task 5, 3e Tasks 2+3, 3f Task 2 ✅
- Thread 1 (pin, editor, render/voice): Tasks 1/8/9/10 ✅
- Thread 2 (spike, API+cache, chips + block fluent): Tasks 11/12/13 ✅
- "Fluent sentences untouched" preserved (Task 4 Step 2b + Global Constraints) ✅
- Legacy rows handled (Task 7) ✅
- Deferred to Phase 15.5 (variants / rebuild-to-native): not in this plan, by design ✅

## Execution notes
- Threads are independent; if parallelising, Thread 3 Tasks 2–4 are the shared spine (voice + resolution) — land them before Thread 1 Task 10 and Thread 2 Task 13, which reuse `voiceForLanguage`/`personaOf`.
- Each task is committed independently; review between tasks.
