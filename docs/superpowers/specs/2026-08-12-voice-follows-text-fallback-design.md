# Voice-follows-text for untranslated content — design

**Status:** approved design (brainstorming complete) · **Owner:** Mo · **Written:** 2026-08-12
**Context:** discovered while testing multi-language boards for MOS-13 (rebuild defaults for marketing).
**Supersedes framing of:** ADR-016 Addendum H + §B ("board-accent literal-TTS"). New ADR-018 records the decision.
**Origin brief:** `docs/2-research/tts-fallback-voice-and-cache-hygiene.md`

---

## 1. Problem

On a non-English board, **untranslated** composed content speaks in the **wrong voice**.

A list item "put on your shoes" whose Hindi translation was reverted (so its text falls back to English) plays the **English words in the Hindi voice** (`hi-IN-Wavenet-F`) — an "accent switch". The text falls back to English but the voice stays the active board voice.

```
[TTS] text="put on your shoes" voiceId="hi-IN-Wavenet-F" tone="-"
      lookup={"source":"ttsCache", ...}   ← English words, Hindi voice
```

Two coupled defects:

- **(a) Resolution logic** — the voice is the active board voice, independent of what language the text resolved to. When the text falls back, the voice doesn't.
- **(b) Cache pollution** — because English text has been synthesised under non-English voices, `ttsCache` (keyed by `text, voiceId, tone`) now holds junk rows like `("put on your shoes", hi-IN-Wavenet-F)` that get served on future plays.

## 2. Decision — the one rule

**The voice follows the language the text resolved to — always, everywhere.**

Untranslated content speaks in its **"made-in" / authored language's voice**, persona-matched (same gender/age as the active board voice, different language) — never the active accent speaking a foreign language.

This is the model **phrases and sentences already implement**. Lists are the outlier. We name the pattern as a shared helper and point every play path at it.

### 2.1 Why this is exactly right (not just plausible)

The two building blocks already exist and compose into the "made-in voice" semantics for free:

- **`resolvedLocale(record, activeLang, DEFAULT_LOCALE)`** (`lib/languages/displayValue.ts`) returns *which* locale key the text fell back to, via the chain `activeLang → en → first key`. A record authored only in Spanish, viewed on a Hindi board, resolves to `es`. **The authored language is the natural tail of the fallback chain** — `resolvedLocale` already means "made-in language".
- **`voiceForLanguage(loc, personaOf(activeVoiceId))`** (`lib/audio/resolveVoiceId.ts`) returns a voice *in that language* matching the active voice's persona. A female Hindi board voice → a female English fallback voice. **Persona preserved, language switched.**

No new registry work, no new voice map — `voiceForLanguage(lang, persona)` is the `voiceForLanguageAndPersona` the origin brief speculated we'd need to build. It exists.

### 2.2 The shared foundation

A single pure helper, used by every play path so the voice can never diverge from the text again:

```ts
// lib/audio/resolveSpokenVoice.ts  (new)
import { resolvedLocale } from "@/lib/languages/displayValue";
import { DEFAULT_LOCALE } from "@/lib/languages/registry";
import { personaOf, voiceForLanguage } from "@/lib/audio/resolveVoiceId";

/**
 * Given a localized text record + the active board language + the active board
 * voice, return the language the text will actually speak in and a persona-matched
 * voice IN that language. Untranslated content → the authored ("made-in") voice.
 *
 * When `record` is absent (plain string content, no per-language record), the
 * active voice is used unchanged — there is nothing to resolve.
 */
export function resolveSpokenVoice(
  record: Record<string, string> | undefined,
  activeLang: string,
  activeVoiceId: string,
): { locale?: string; voiceId: string } {
  const loc = record ? resolvedLocale(record, activeLang, DEFAULT_LOCALE) : undefined;
  return {
    locale: loc,
    voiceId: loc ? voiceForLanguage(loc, personaOf(activeVoiceId)) : activeVoiceId,
  };
}
```

Playback always: resolve → `playTts(text, voiceId, tone, { literal: true })`. **`literal: true` unconditionally** for composed/authored content — it speaks the exact typed text and skips the SymbolStix per-language default lookup. (This is what phrases already do.)

## 3. Scope

| Content | Today | Action |
|---|---|---|
| **Phrases** (`PersistentTalker.playItem`, `CompositionPlayModal`) | ✅ correct — inline `resolvedLocale` + `voiceForLanguage` | Refactor to call `resolveSpokenVoice` (behaviour-preserving DRY) |
| **Sentences** (`SentencePlayModal` via `textLocale` prop) | ✅ correct — caller computes `textLocale` via `resolvedLocale` | Verify parity, refactor to `resolveSpokenVoice` |
| **Lists** (`ListDetailDisplay.tsx` `ListItemPlayModal`) | ❌ **broken** — raw board `voiceId`; Option 2 flips `literal` on whether a translation exists | **Fix**: adopt `resolveSpokenVoice`, always `literal: true`, **delete Option 2** |
| **Categories / talker default symbols** | ✅ correct — localized seeded clip (खाना on a Hindi board) | **No change** — default symbols are pre-translated; localized playback is intended |

### 3.1 Why categories are correctly untouched

A default category symbol like "eat" *ships* a seeded Hindi clip — it is **pre-translated**. Tapping it on a Hindi board correctly says खाना. That is not the bug. The bug is only about genuinely *untranslated user content* (an instructor's English list item on a Hindi board). The uniform rule — "text resolves to a translated locale → that locale's voice; text falls back to the authored locale → the authored voice" — makes categories fall out correct on their own, because their text resolves to the board locale (a seeded translation exists).

### 3.2 The list fix, concretely

Replace `ListDetailDisplay.tsx` lines ~99–101:

```ts
// BEFORE (Option 2, buggy)
const hasLocalised = !!item.descriptionRecord?.[language]?.trim();
audioRef.current = null;
playTts(item.description, voiceId, undefined, { literal: hasLocalised });
```

```ts
// AFTER (voice-follows-text)
const { voiceId: spokenVoice } = resolveSpokenVoice(item.descriptionRecord, language, voiceId);
audioRef.current = null;
playTts(item.description, spokenVoice, undefined, { literal: true });
```

Imports to add in that file: `resolveSpokenVoice` from `lib/audio/resolveSpokenVoice`. (The file currently imports only `playKey, playTts`.)

This deletes both defects of the list path in one move: the raw-board-voice accent switch **and** the Option 2 symbol-localized detour (per Mo's "made-in voice always" decision — untranslated list items never symbol-localize).

## 4. Cache cleanup — targeted `_id` hit-list

Not a blind wipe. Mo eyeballs the `ttsCache` table (Latin-script text under a `hi-IN-*`/`es-US-*` voice is trivially spotted) and supplies a list of `_id`s. A cleanup tool then, **for each id**: reads the row, deletes its R2 object by the stored `r2Key`, and deletes the row.

### 4.1 Why mis-flags are free (self-healing)

Cleanup only ever touches the `ttsCache` **row** and its **R2 audio object** — never the content's text record (`descriptionRecord`, phrase name, sentence text). If a *correct* row is mistakenly deleted:

1. Next play of that item → `ttsCache.lookup` finds no row → `source: "none"`.
2. `/api/tts` Step 3 regenerates the identical clip (same text + voice + Wavenet settings), re-uploads, re-caches.
3. Cached again thereafter.

**Net cost of a mis-flag: one extra TTS generation on the next tap** (a few hundred ms, fractions of a cent). No content is remade, reverted, or re-translated — audio is a pure derivative of text + voice and always regenerates from the text already present.

### 4.2 Deletion safety

- **Serve path has no `fileExists` check on `ttsCache` hits** (`route.ts` Step 2 returns the stored `r2Key` directly; only the *symbolstix* branch checks existence). Therefore deleting an R2 object while its row still exists → a broken, silent play with no auto-heal. The cleanup tool deletes **row-and-object together**; on the solo test deployment there are no concurrent live plays mid-script, so ordering within the tool is not load-bearing. As a live-safety rule of thumb: **row before object**.
- **Prefix isolation** (`lib/r2-paths.ts`): pollution lives only under `audio/<voiceId>/tts/`. Seeded symbol clips (`audio/<voiceId>/symbols/`), legacy MVP clips (`audio/eng/default/`) and **recorded human audio** (`profiles/<id>/audio/`) are on separate prefixes and are never touched.
- **R2 is likely shared with the live MVP** (this app already reads MVP-era `audio/eng/default/` objects) — which is exactly why the targeted `_id` list, not a mass prefix delete, is the chosen approach. Every polluted object is under a `hi-IN-*`/`es-US-*` voice folder — voices that did not exist in the MVP — so even the object deletes are provably MVP-safe.

## 5. Re-infection prevention

Once every play path routes through `resolveSpokenVoice`, the voice can never mismatch the resolved text language, so `ttsCache.write` can never persist a cross-language row again. The shared helper is what makes this guarantee **auditable** — one chokepoint to verify instead of four divergent inline copies.

## 6. Open implementation question (non-blocking)

Whether auto-matched list items store just `{ en: "eat" }` or inherit the matched symbol's full `{ en, hi, es }` labels:

- **Inherit** → the item is "translated" (has `hi`) → `resolvedLocale` returns `hi` → speaks the localized clip via the normal path.
- **English-only** → untranslated → `resolvedLocale` returns `en` → made-in English voice.

The rule holds either way. Confirm during implementation which path real auto-matched items take, and document the resulting behaviour.

## 7. Deliverables

1. `lib/audio/resolveSpokenVoice.ts` — the shared helper.
2. Lists wired to it (`ListDetailDisplay.tsx`), always `literal: true`, Option 2 removed.
3. Phrases + sentences refactored to it (behaviour-preserving), and verified.
4. Cache cleanup tool taking an `_id` hit-list → deletes rows + R2 objects.
5. ADR-018 recording the decision and superseding the ADR-016 board-accent framing.

## 8. Non-goals

- No change to categories / talker default-symbol playback.
- No change to text records, translation flows, or the "Made in <lang>" badge/variant model.
- No change to the recorded-human-audio path (`recordedAudioPath` / `activeAudioSource`).
- No mass `ttsCache` wipe and no mass R2 prefix delete.
