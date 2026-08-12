# ADR-018 — Voice follows the text's resolved language

**Status:** Accepted · **Date:** 2026-08-12
**Supersedes:** ADR-016 Addendum H + §B (board-accent literal-TTS), for the untranslated-fallback case.
**Design:** [`2026-08-12-voice-follows-text-fallback-design.md`](../../superpowers/specs/2026-08-12-voice-follows-text-fallback-design.md)
**Brief:** [`tts-fallback-voice-and-cache-hygiene.md`](../../2-research/tts-fallback-voice-and-cache-hygiene.md)

## Context

Composed/localized content stores a per-language text record (e.g. a list item's `descriptionRecord = {en, es, hi}`). Playback resolves the **text** by a fallback chain (`activeLang → en → first key`), but historically resolved the **voice** to the active board voice independently. When the active-language text was missing, the text fell back to English while the voice stayed the board voice — **English words spoken by a Hindi voice** (an "accent switch"). On testing this reads as clearly wrong.

ADR-016 §B ("board-accent literal-TTS") is the origin: it made authored content speak its exact typed text in the **board voice**, and noted — but did not consistently implement — that "an un-translated fallback speaks in the origin voice." Phrases and sentences ended up implementing voice-follows-text correctly (via `resolvedLocale` + `voiceForLanguage`); **lists did not** — they passed the raw board voice, and a later patch (Option 2, `d8a0589`) routed untranslated symbol-words through the SymbolStix localized-clip lookup instead. The result was inconsistent playback and a `ttsCache` polluted with English-text-under-foreign-voice rows.

## Decision

**The voice always follows the language the text resolved to.** Untranslated content speaks in its **"made-in" / authored language's voice**, persona-matched to the active board voice (same gender/age, different language) — never the active accent speaking a foreign language.

This generalises and completes ADR-016 §B rather than contradicting its intent:

- Text resolves to a **translated** locale (a board-language variant / seeded default exists) → **that locale's voice** (e.g. Hindi text → Hindi voice). Unchanged from ADR-016.
- Text falls back to the **authored** locale (no translation for the board language) → the **authored/made-in voice** (e.g. English fallback → English voice). This is the reversal of the board-accent behaviour for fallbacks, and it removes Option 2's symbol-localized detour for untranslated list items.

### Mechanism

A single shared pure helper, adopted by every play path:

```ts
resolveSpokenVoice(record, activeLang, activeVoiceId): { locale?, voiceId }
//   loc     = resolvedLocale(record, activeLang, DEFAULT_LOCALE)   // "made-in" language = tail of the fallback chain
//   voiceId = voiceForLanguage(loc, personaOf(activeVoiceId))      // persona-matched voice IN that language
```

Composed/authored content always plays with `literal: true` (exact typed text, skips the SymbolStix per-language default lookup). No new voice registry is needed — `voiceForLanguage(lang, persona)` already exists.

### Scope

- **Lists** — fixed: adopt `resolveSpokenVoice`, always `literal: true`, **Option 2 deleted**.
- **Phrases, sentences** — already conform; refactored onto the shared helper (behaviour-preserving) so all paths share one chokepoint.
- **Categories / talker default symbols** — **unchanged**. Default symbols are *pre-translated* (they ship seeded per-language clips), so their text resolves to the board locale and correctly speaks the localized clip. This is not the fallback case.

### Cache hygiene

Existing polluted `ttsCache` rows (English text synthesised under `hi-IN-*`/`es-US-*` voices) are removed via a **targeted `_id` hit-list** (owner-supplied), deleting each row and its R2 object — not a blind table wipe or mass prefix delete. R2 is likely shared with the live MVP, but every polluted object sits under a Home-era non-English voice folder, so targeted deletes are MVP-safe. Mis-flagging a *correct* row is self-healing: the next play regenerates the identical clip from the untouched text record.

## Consequences

- **Untranslated content is audibly "unfinished but usable"** — it speaks correctly in the authored voice, matching the "Made in <lang>" badge, instead of mispronouncing in a foreign accent.
- **The cache can no longer be re-infected**: with the voice always matching the resolved text language, `ttsCache.write` cannot persist a cross-language row. The single helper makes this auditable.
- **ADR-016 §B's "board voice for authored content" is narrowed**: authored content speaks in its *resolved-text* voice, which equals the board voice only when a board-language translation exists.
- **Option 2 (`d8a0589`) is retired for lists** — untranslated list items no longer symbol-localize; they speak the made-in voice like every other composed type.
- No change to text records, translation/variant flows, the "Made in <lang>" badge, or the recorded-human-audio path.
