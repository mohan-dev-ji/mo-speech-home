# ADR-009 — Multi-language and Multi-voice Architecture

Date: 2026-05-06
Status: Accepted — implementation begins Phase 8.0 (see `docs/4-builds/features/language-plugin-phase-8.md`)

---

## Context

Mo Speech Home today supports two languages (English, Hindi) hard-coded across multiple surfaces:

- Schema bilingual fields are typed as `{ eng: string; hin?: string }` — fixed two-key objects.
- `i18n/routing.ts` enumerates `en` and `hi` as routing locales.
- `messages/en.json` / `messages/hi.json` carry static UI strings.
- Locale switchers, the student-profile language picker, and the talker dropdown each list `en` and `hi` independently.
- TTS audio is keyed per-language with a single default voice (`audio/<lang>/default/<word>.mp3`).
- The `symbols` table stores `audio.eng.default` / `audio.hin.default` as fixed fields.

Two upcoming product moves break this fixed-pair model:

1. **More languages.** The plan is to ship `en` + `hi` as stable, then in private build out `es`, `ko`, and other Romanised European languages plus East Asian scripts. New languages should be addable as "plugins" — content + config + voices in a self-contained unit, no app-wide rewiring.
2. **More voices.** Launch will seed four voices per language (adult male, adult female, child male, child female) so families can pick a voice that matches the student. Post-launch, more voices will be seeded for `en` and `hi` and the user will switch from settings. Eventually voice variety becomes a product surface itself.

A **52k-symbol × multi-voice × multi-language** asset library is also a meaningful long-term moat — other AAC tools, schools, or research groups may find the dataset useful via API. The architecture should not preclude that, but should not architect for it now either.

The decisions below cover schema, routing, TTS, fonts, R2 layout, the user-content-translation flow, and the product-shape question of "how many languages do real users actually need."

---

## Decision

### 1. A single language registry is the source of truth

A typed array of language entries lives at `lib/languages/registry.ts` (or similar). Every surface that needs to enumerate, branch on, or display a language reads from this registry — no `if (lang === 'en' || lang === 'hi')` anywhere.

```ts
type LangStatus = 'stable' | 'beta' | 'machine-translated';

type LangEntry = {
  code: string;          // ISO 639-1 — 'en', 'hi', 'es', 'ko', ...
  label: string;         // pickers — "English"
  nativeLabel: string;   // self-name — "हिन्दी"
  dir: 'ltr' | 'rtl';
  font: string;          // mapped to a next/font loader
  voices: VoiceEntry[];  // see #4
  status: LangStatus;    // see #3
};

type VoiceEntry = {
  id: string;            // 'adultMale', 'adultFemale', 'childMale', 'childFemale', or future
  label: string;         // "Adult male"
  ttsVoiceId: string;    // upstream provider voice id
  status: LangStatus;
};
```

A union type is derived from the registry via `as const` so callers retain compile-time safety on language codes — typos still fail the build.

### 2. Schema: open record keyed by ISO code

All bilingual fields migrate from `{ eng: string; hin?: string }` to `{ [code: string]: string }`:

- `profileCategories.name`
- `profileLists.name`
- `profileSentences.name`
- `profileSymbols.label`
- `symbols.words`
- `resourcePacks.name` / `resourcePacks.description`

Display-time rendering everywhere becomes:

```ts
const display = value[currentLang] ?? value[defaultLang] ?? Object.values(value)[0];
```

A one-shot migration backfills existing rows: `{ eng, hin } → { en: eng, hi: hin }`. Note the rename `eng → en` / `hin → hi` to align with ISO 639-1 and existing route prefixes.

**Single-string fields that are user-visible also become bilingual at the same migration**:

- `profileLists.items[].description`
- `profileSentences.text`

Deferring these to a later migration is more work than doing them in the same pass, since user data will have accumulated.

### 3. Translation lifecycle: stable / beta / machine-translated

The `status` field on a language (and on a voice) gates visibility:

- **Stable** — native-speaker reviewed. Visible in pickers everywhere.
- **Beta** — AI-translated, public, marked with a small "preview" badge in the picker.
- **Machine-translated** — AI-translated, hidden from production pickers, available behind a feature flag for internal testing.

A build script (`pnpm translate:seed`, exact name TBD) reads English source-of-truth strings + content, runs an AI pass for any language at status ≤ beta, writes `messages/<code>.json` and seeds Convex content fields. Native speakers review by editing those files; flipping `status: 'stable'` is the publish action.

This lets a language ship publicly as **beta** while quality-checking happens in parallel, without committing to it as production-grade.

### 4. Voices: convention-encoded R2 paths, registry-driven

R2 layout for SymbolStix and TTS audio is **voice-first**:

```
audio/<voice>/symbols/<word>.mp3     // per-voice SymbolStix recording
audio/<voice>/tts/<hash>.mp3         // generated TTS, cached
```

Voice is the primary key, with `symbols/` and `tts/` as the asset-type split underneath. This is more compact than `audio/<lang>/<voice>/...` — voice IDs from typical TTS providers (`en-GB-News-M`, `hi-IN-Wavenet-A`) already encode language, so a language prefix would be redundant. It also keeps everything for one voice in a single folder, which matters when seeding, auditing, or deleting a voice.

**Voice ID parsing is forbidden.** Even though Google's voice IDs happen to start with a language code, code never extracts language from the voice string. The language registry maps voice IDs to languages explicitly (`voices: [{ id: 'en-GB-News-M', langCode: 'en', ... }]`). This keeps the door open to non-Google providers, internal voice IDs (`adultMale`), and future voice renames.

The `symbols.audio` field stops storing the **path** and starts storing **whether the voice is seeded**. Lookups resolve the path from the convention. Missing voices fall through to TTS synthesis using the same caching pattern in `convex/ttsCache.ts`.

Adding a voice = registry entry + (optional) R2 seed + (optional) update to a per-symbol "voice availability" map. No code path changes. No schema migration after the initial rework.

The student-profile schema already has `voiceId` — settings page picker reads from the language registry's `voices` array for the current language and writes the chosen voice id. ✓

#### Legacy path: `audio/eng/default/`

The MVP shipped with SymbolStix recordings stored at `audio/eng/default/<word>.mp3`. They were later identified as `en-GB-News-M` recordings — the path is misleading but the audio is correct. The `symbols` table currently stores explicit paths pointing into this legacy folder.

Migration plan: **leave R2 untouched**. When the schema migration in this ADR runs, the new convention-based audio resolver gets a one-line legacy fallback:

> If voice is `en-GB-News-M` and the new path `audio/en-GB-News-M/symbols/<word>.mp3` doesn't exist, try `audio/eng/default/<word>.mp3`.

Once all 52k symbols have been re-seeded under the new path, the fallback is deleted in a follow-up. No risky bulk rename, no symbols-table rewrite for legacy paths.

### 5. UX shape: bilingual default, plugin model for more

Architecture supports N languages cleanly. **Product UX defaults to bilingual** (primary + secondary) because that matches 95% of users:

- **Onboarding** picks one primary language. That's the landing experience.
- **Adding a second language** is one tap from settings — feels like a feature, not setup.
- **Adding a third or fourth language** uses the "language plugin" metaphor: a separate "Available languages" section with download / install affordances, framed as opt-in.

This serves the simple-case user a simple app, the bilingual-family user a natural toggle, and the diaspora trilingual+ family (Korean-in-Berlin, etc.) a discoverable route — without cluttering anything else.

### 6. User-created content translation: show and flag

When a user creates content in language A and switches to language B, the item displays in language A with a small "no translation" indicator visible in instructor / admin view modes. Inline action: **"Translate to <current language>"** runs an AI pass and saves the result to that language's slot in the open record. The user can edit the AI output before saving.

Rejected alternatives:

- **Auto-translate on switch** — heavy-handed, can mistranslate proper nouns or culturally-specific phrasings, surprising.
- **Force re-create** — bad UX; punishes users for switching.

This keeps switching non-destructive, AI a smart helper rather than an autopilot, and the user in control.

### 7. R2 paths stay flat and predictable

To leave the door open to the asset library being exposed externally one day:

- Asset paths embed only language and voice — never user / account / pack ownership prefixes.
- Symbol images use a flat key (`images/<symbolId>.png`).
- The languages registry is data, not code — nothing prevents serialising it to JSON for a future API surface.

These principles are cheap to honour now and expensive to retrofit later.

### 8. Fonts and RTL

- Per-language font is a string in the registry mapped to a `next/font` loader. Subset loading is per-language to avoid pulling all Noto subsets at once.
- `dir` field on the registry entry. Right-to-left support (Arabic, Hebrew, etc.) is **deferred** until a real RTL language is shipped — `dir` is wired through but layout work is non-trivial and out of scope for the initial multi-language pass.

### 9. Latin transliteration for non-Latin scripts

OS-level input methods (Gboard transliteration mode, pinyin IMEs, etc.) already convert Latin typing into the target script before the app ever sees the text — so in the common case, the app receives real Devanagari / Hanzi / Hangul and search works against the stored script.

The edge case Mo Speech's audience hits often: a user fluent in the spoken language but with **only a Latin keyboard installed on their device**. A Hindi-mode user typing `kutta` should still find `कुत्ता`.

For every non-Latin language, each symbol stores a Latin-script transliteration alongside the script label, inside the per-language `synonyms` array (`synonyms.hi = ["कुत्ते","कुतिया","kutta","kutiya"]` — native variants *and* transliterations).

Transliterations are generated by the same AI seed pass that produces the script label — adding the strings at seed time is effectively free; retrofitting later across 52k symbols is not.

This is **not** an IME — the app never tries to convert Latin keystrokes into script in real time. It only ensures search still works when the user can't type the script natively. RTL languages get the same treatment when they ship.

#### Correction (2026-06-02): synonyms aren't directly indexable — search reads a combined `searchText` field

The original plan above assumed the transliterations would "ride on the `synonyms` field — search indexes hit it naturally." **That was wrong.** Convex full-text search requires the `searchField` to be a **single string**; `synonyms.<code>` is a `string[]`, which cannot be a `searchField`. So a Hindi-mode user typing `kutta` matched nothing — the transliteration lived only in an unindexable array, while the search index pointed at the bare `words.<code>` (Devanagari only).

The fix: each symbol carries a combined, indexable **`searchText: { [iso]: string }`** field — `words[code]` joined with every `synonyms[code]` entry into one space-separated string (e.g. `searchText.hi = "कुत्ता कुत्ते कुतिया kutta kutiya"`). The per-language search indexes are `search_text_<code>` over `searchText.<code>`. Because the string includes the word itself, native-script search is unaffected; transliterations and semantic synonyms now match too (the latter benefits `en`/`es` as well).

- **Maintained at write time** by `symbols.applyTranslationsBatch` (the translation pipeline writes `searchText[slug]` alongside `words`/`synonyms`), so any newly-translated or straggler-mopped symbol is searchable with no extra step.
- **Backfilled once** for pre-existing rows by `migrations.backfillSearchText` (paginated, idempotent, additive — re-derivable from `words`+`synonyms` at any time).
- **Promoting a new language to stable** adds a `search_text_<code>` index (the `SearchIndexReminderBanner` emits the exact snippet); the field itself needs no migration because the pipeline already populated it during translation.

The original "separate transliteration into its own field later" escape hatch is now moot — `searchText` *is* that dedicated indexable field, and it subsumes synonyms too.

---

## Consequences

- **One-shot schema migration** — bilingual fields go from typed two-key objects to ISO-keyed open records; `eng → en`, `hin → hi`. Single-string user-visible fields (`description`, `text`) become bilingual records in the same migration.
- **Display logic everywhere reduces to a three-tier fallback** — `value[currentLang] ?? value[defaultLang] ?? firstNonEmpty(value)`.
- **Audio stops being a stored path field on `symbols`** and becomes a convention-resolved lookup with TTS fallback (voice-first path: `audio/<voice>/symbols/<word>.mp3`). The TTS endpoint and `ttsCache.lookup` are updated to take a voice id, with the language derived from the registry rather than parsed from the voice id.
- **Legacy `audio/eng/default/` is left in place** and aliased through the resolver as `en-GB-News-M` symbol recordings until those words have been re-seeded under the new path.
- **The settings page gains a voice picker** populated from the registry's voices for the student's current language. `studentProfiles.voiceId` already supports this.
- **All language-listing UI is consolidated** to read the registry — Navbar locale switcher, profile-locale picker, talker dropdown, marketing language selector, sign-up flow.
- **The `messages/<code>.json` `(hi)` placeholder convention stays** for static UI strings (loaded fresh per render, so updates propagate to all users immediately). It is **not** used for content data (which is copied to user accounts at seed-time and would freeze placeholders into user data; see content-translation flow above).
- **Default packs are translated for real before publish**, not stubbed with `(hi)`. Twelve lists × twelve sentences is a small enough surface to translate properly.
- **Adding a language post-launch becomes**: registry entry + messages file + (optional) AI-seed of pack content + (optional) voice recordings. No code edits anywhere else.
- **Symbol seed pipeline writes a Latin transliteration** for every non-Latin language, stored in the `synonyms` array. Search reaches it via the combined, indexable `searchText.<code>` field — not the array directly (see §9 *Correction (2026-06-02)*; arrays can't be a Convex `searchField`). The pipeline maintains `searchText` at write time; `migrations.backfillSearchText` covered pre-existing rows.

---

## Out of scope

- **External asset / API exposure.** The R2 path conventions and registry-as-data principles keep the door open; no API surface is built as part of this ADR.
- **RTL layout work.** The `dir` field is wired through but no RTL language is being shipped at this time.
- **Per-language native-speaker voice talent procurement.** The launch four voices are seeded via TTS or external recording vendors; the operational pipeline is separate.
- **Voice marketplace / user-uploaded voices.** Voices remain a curated, registry-controlled list.
- **A user-facing translation tool for user content.** The "Translate to <current language>" inline action uses the same AI provider as content seeding; it is not a richer translation UI.
- **Cross-language search.** Searching "shiva" should not auto-find "शिव" — search index strategy stays per-language.

---

## References

- [ADR-011](./ADR-011-plugin-architecture-for-content-modules.md) — generalises this ADR's registry-as-data principle to a shared plugin pattern across packs, themes, and languages. Adds tier-based language slots (Free=1, Pro=2, Max=3) and the admin-dashboard creation flow that this ADR's runtime architecture feeds into.
- [`docs/4-builds/features/language-plugin-phase-8.md`](../plans/_done/language-plugin-phase-8.md) — Phase 8 implementation spec (8.0 foundation through 8.6 stable ship). Punjabi (`pa`) is the third language verifying the plugin pattern beyond bilingual.
- [`docs/1-inbox/ideas/06-resource-library.md`](../../1-inbox/ideas/06-resource-library.md) — pack content is copied to user accounts at seed; relevant to why `(hi)` placeholders work for messages but not for content data
- [`convex/schema.ts`](../../../convex/schema.ts) — current bilingual field shapes
- [`convex/ttsCache.ts`](../../../convex/ttsCache.ts) — TTS lookup pattern that the per-voice fallback model extends
- [`i18n/routing.ts`](../../../i18n/routing.ts) — current locale enumeration; replaced by the registry
- [`messages/en.json`](../../../messages/en.json), [`messages/hi.json`](../../../messages/hi.json) — static UI strings; convention preserved
- ADR-008 — admin role and view modes; admin tools are where content translation gaps are surfaced
