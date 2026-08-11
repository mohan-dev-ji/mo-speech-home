# Brief: fallback/reverted content speaks in the wrong voice + cache hygiene

**Status:** problem brief for a fresh brainstorming session · **Owner:** Mo · **Written:** 2026-08-11
**Do:** brainstorm the model first (this is a design decision), then plan → ADR → implement. Don't jump to code.

---

## 1. The symptom

On a **HI** list board, a list item **"put on your shoes"** whose Hindi translation was **reverted** (so it falls back to the English text) plays the **English words spoken by the Hindi voice** — not English in an English voice.

```
[TTS] text="put on your shoes" voiceId="hi-IN-Wavenet-F" tone="-"
      lookup={"r2Key":"audio/hi-IN-Wavenet-F/tts/…","source":"ttsCache"}
```

Same on **ES** (`es-US-Wavenet-C`, `source:"none"` → generates English in a Spanish voice).

**Desired:** reverted / untranslated content should speak in the **"made in" (authored) language's voice** — English text → an English voice — not the active board voice speaking a foreign language ("accent switch").

Mo's call (2026-08-11): the earlier "board-accent" design decision (always speak in the active board voice regardless of the text's language) was a **mistake**. Revert-to-made-in-voice is the better model.

---

## 2. Why it happens (mechanism)

- Content stores a **per-language text record** (e.g. list item `descriptionRecord = {en, es, hi}`).
- Playback resolves **text** = `descriptionRecord[activeLang] ?? fallback(en/DEFAULT_LOCALE/authoredLang)`.
- **Voice** = the active profile `voiceId` (e.g. `hi-IN-Wavenet-F`), which encodes a **language + accent**.
- So when the active-language text is missing, the text falls back to English **but the voice stays the active (Hindi/Spanish) voice** → English words in a Hindi/Spanish accent.

The just-shipped "Option 2" fix (see §5) helps only for **single-symbol words** (untranslated "eat" → non-literal → symbol-by-English match → seeded localized clip). A **multi-word phrase** ("put on your shoes") matches no symbol → falls through to TTS **in the active voice** → the bug.

**Root design flaw:** the **voice does not follow the text's language.** It should. Speaking English text ⇒ English voice; speaking the Hindi translation ⇒ Hindi voice.

---

## 3. Cache infection

`ttsCache` is keyed by **(text, voiceId, tone)**. Because English text has been synthesised under non-EN voices, the cache now holds junk rows like **`("put on your shoes", hi-IN-Wavenet-F)`** and **`(…, es-US-Wavenet-C)`** — English words in the wrong-language voice. These get **served on future plays** (the HI log above is a `ttsCache` hit of exactly such a row).

So there are two coupled problems: **(a) the resolution logic** produces wrong-voice audio, and **(b) the cache is polluted** with wrong-voice clips from before.

---

## 4. What Mo wants (three workstreams)

1. **Fallback/revert voice model** — content with no translation in the active language speaks in the **made-in / authored language's voice** (persona-matched — same gender/age as the active voice, different language), not the active accent.
2. **Clean the cache** — remove the infected `ttsCache` rows (wrong-language-voice clips). Decide wipe-all (regenerable) vs targeted delete.
3. **Foundation for fallback + reverted content** — a single, coherent rule for *"given active board language + a localized content record, what TEXT do I speak and in what VOICE?"* — used everywhere (lists, sentences, phrases, categories, talker), tied to the existing **"Made in <lang>"** concept.

---

## 5. Recent context (what was just built — may interact)

Phase-18 (this session) separated image / text / audio for list items and reworked audio resolution. Relevant commits/behaviour:

- **imageOnly editor** — symbol editor is image-only for list items + group covers.
- **Per-row audio** — list rows have an audio control → `AudioAuthorModal` (generate literal TTS / record). `recordedAudioPath` + `activeAudioSource:'record'` play a human recording.
- **Literal TTS reuse fix** (`328b3e3`) — `literal` requests reuse a seeded symbol clip on an **exact same-language** match (active voice's language via `getVoiceLang(voiceId)`), skipping the English cross-match. Eliminated duplicate clips for exact symbol words on EN.
- **Option 2 fallback** (`d8a0589`) — list play flips `literal` on whether `descriptionRecord[activeLang]` exists: translated → literal TTS; untranslated → **non-literal** so the English word resolves the symbol's seeded **active-language** localized clip (like a category tap).

**Tension to resolve:** Option 2 makes an untranslated *symbol word* speak the concept **in the active language** (untranslated "eat" on HI → खाना). The new "made-in voice" direction would instead speak it **in the authored language's voice** (English "eat" in an English voice). These are different philosophies for fallback:
- **symbol-localized** (active lang) — good for symbol concepts.
- **made-in voice** (authored lang) — good for authored phrases / anything unmatched.

Brainstorm must reconcile when each applies (candidate: symbol-linked word with a seeded active-lang clip → symbol-localized; everything else → made-in voice).

---

## 6. Code map (verify line numbers — code moves)

- **`convex/ttsCache.ts`** — `resolveCachedAudio` (order: **symbol match → ttsCache → none**), `matchSymbolByWord` (exact, normalised, per-lang search index), `SEARCHABLE_LANGS = {en,hi,es}`, `lookup`, `checkMany`, `write`.
- **`app/api/tts/route.ts`** — `/api/tts` entry; `literal` flag → `skipSymbolstix`; serves symbolstix key via `resolveSymbolAudioPath` + `fileExists`; else generates (Wavenet, or Gemini for tones) and `ttsCache.write`.
- **`lib/audio/resolveAudioPath.ts`** — `resolveSymbolAudioPath` (`audio/<voiceId>/symbols/<words.en>.mp3`; `LEGACY_VOICE_ID` → `audio/eng/default/<basename>.mp3`), `resolveTtsAudioPath`.
- **`lib/audio/resolveVoiceId.ts`** — `voiceForLanguage(lang)`, `personaOf(voiceId)`. **Likely needs a `voiceForLanguageAndPersona(lang, persona)`** for made-in-voice fallback.
- **`lib/languages/registry.ts`** — `getVoiceLang(voiceId)`, voice/language registry, personas.
- **`lib/audio/playTts.ts`** — client `playTts(text, voiceId, tone?, {literal})`, `playKey`.
- **`lib/languages/displayValue.ts`** — `displayString`, `resolvedLocale` (text fallback chain — the place that decides which language the text fell back to).
- **`lib/languages/variants.ts`** — `needsTranslation`, `isRevertableVariant`, "Made in <lang>" state; revert removes the board-language key.
- **`app/components/app/lists/sections/ListDetailDisplay.tsx`** — `ListItemPlayModal` (the play path changed by Option 2). Sentences/phrases/talker have parallel play paths.
- **`convex/schema.ts`** — `ttsCache` table (`text`, `voiceId`, `tone`, `r2Key`, `charCount`); `by_text_voice_tone` index.

---

## 7. Open questions for brainstorming

1. **Voice-follows-text**: where to compute it? A shared resolver `resolveSpokenAudio({ record, activeLang, activeVoiceId })` → `{ text, lang, voiceId }` that every play path uses, so voice always matches the spoken text's language. `resolvedLocale` already tells us which language the text resolved to.
2. **Persona matching**: made-in fallback needs a voice in the fallback language matching the active voice's **gender/age** (`personaOf`). Does the registry have a persona→voice map per language? If not, add one.
3. **Symbol-localized vs made-in** for fallback (the §5 tension): decide the precedence rule and whether Option 2 stays for symbol words.
4. **Cache cleanup strategy**: wipe `ttsCache` entirely (safe — clips regenerate on demand, at some re-gen cost) vs targeted delete of rows whose text's language ≠ voice's language (needs a language guess for arbitrary text — hard). Consider: is the wrong-voice clip detectable (e.g. latin-script text under a non-latin voice)? A migration in `convex/migrations.ts`.
5. **Preventing re-infection**: once voice-follows-text is in, the cache can't gain cross-language rows (the voice always matches the text's language). Confirm every play path routes through the shared resolver.
6. **Symbol seeded clips**: these are `audio/<voiceId>/symbols/<words.en>.mp3` per voice, speaking the localized word. Made-in fallback for a symbol word could instead use the seeded clip in the **authored** language's voice. Interaction with §3 tension.
7. **Scope of "content"**: lists, sentences, phrases, categories, talker chips all resolve localized text + a voice. The foundation should be shared, not list-only.
8. **"Made in <lang>" UX tie-in**: the badge already signals authored-language content; the audio model should align (badge lang == spoken lang/voice when untranslated).

---

## 8. Suggested first brainstorming prompt

> "Design a single audio-resolution foundation where the **voice follows the language of the spoken text**, not the active board. When localized content (a per-language record) has no entry for the active board language, it should fall back to the **authored/'made in' language's text AND a persona-matched voice in that language** — never the active accent speaking a foreign language. Reconcile this with the just-shipped symbol-localized fallback (Option 2) for single symbol words. Then design a `ttsCache` cleanup for the wrong-voice rows already written, and confirm the new model prevents re-infection. Deliver: the resolution rule, a shared resolver + voice-per-(lang,persona) mapping, the cleanup migration strategy, and which play paths must adopt it."
