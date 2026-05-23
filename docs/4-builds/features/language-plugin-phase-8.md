# Language Plugin — Phase 8 Build Order

Spec for Phase 8 of `docs/1-inbox/ideas/00-build-plan.md`. Combines [ADR-009](../decisions/ADR-009-multi-language-multi-voice-architecture.md) (multi-language architecture) with [ADR-011](../decisions/ADR-011-plugin-architecture-for-content-modules.md) (plugin pattern). Phase 7 admin shell is in production — the Library section is the template we clone.

---

## The two questions this spec answers

1. **"Should we translate the other 2 languages first to have real assets to work with?"** — No, not first. You can't write translations into the schema until the schema migration lands. Translation work *is* the pipeline build; it runs *through* the admin tab, not before it.
2. **"Should we build the language admin tab first?"** — The admin tab and the translation pipelines are the same feature. The tab is the UI shell around the pipelines. You build them together, one content surface at a time, with UI strings as the first slice because it's the smallest.

The real first step is neither of those — it's the **foundation migration** that turns `{eng, hin}` into `{[iso]: string}` and turns the registry into JSON-loaded plugin modules. Without that, both translation work and the admin tab are building on quicksand.

---

## The mental model

Translating Spanish and Korean is not "content work that precedes the build" — it *is* the build. Every translation is the output of a pipeline you write. The pipelines run from the admin dashboard. So:

```
foundation migration  →  admin shell + first pipeline (UI strings)  →  scale pipelines  →  ship
```

The foundation has to land before anything else. After that, each content surface (UI strings → symbols → packs → voices) gets its own pipeline + admin view, in increasing order of risk and size.

---

## Critical files we're cloning

The Library section already proves the plugin pattern end-to-end:

- **Plugin data:** `convex/data/library_packs/*.json` (one file per pack) + `_index.ts` typed barrel
- **Lifecycle table:** `packLifecycle` in `convex/schema.ts:614`
- **Convex API:** `listAllPacksForAdmin`, `updatePackLifecycle`, `deletePackLifecycle` in `convex/resourcePacks.ts:2348-2526`
- **Admin table component:** `app/components/admin/sections/LibraryAdminTable.tsx`
- **Admin page:** `app/(admin)/admin/library/page.tsx`
- **Publish API (write-back-to-JSON):** `app/api/admin/pack-publish/route.ts`
- **Index barrel:** `convex/data/library_packs/_index.ts`

Languages will mirror this exactly:

- `convex/data/languages/<code>.json`
- `languageLifecycle` table
- `listAllLanguagesForAdmin`, `updateLanguageLifecycle`, `deleteLanguageLifecycle`
- `app/components/admin/sections/LanguagesAdminTable.tsx`
- `app/(admin)/admin/languages/page.tsx`
- `app/api/admin/language-publish/route.ts`
- `convex/data/languages/_index.ts`

Plus the language-specific bits not in packs: translation pipelines, registry assembly from JSON, font loaders, voice list.

---

## Phase 8 sub-phases

### 8.0 — Foundation migration (no new languages yet)

The highest-risk piece because it touches every user's data. **Do this alone, ship it, monitor for a week before adding language #3.**

- **Schema migration**: all bilingual fields `{eng, hin?}` → `{[iso]: string}`. Affected tables (per ADR-009 §2):
  - `symbols.words`, `symbols.synonyms`, `symbols.audio`
  - `profileCategories.name`, `profileLists.name`, `profileSentences.name`, `profileSymbols.label`
  - `resourcePacks.name`, `resourcePacks.description`
  - `packLifecycle.name`, `packLifecycle.description` (already bilingual — needs the same rename)
  - **New bilingual fields**: `profileLists.items[].description`, `profileSentences.text` (currently single strings)
  - Key rename: `eng → en`, `hin → hi` to align with ISO 639-1
- **Registry refactor**: `lib/languages/registry.ts` becomes a thin barrel that imports `convex/data/languages/<code>.json` modules and assembles the typed `LangEntry[]`. `i18n/routing.ts` reads `locales` from the registry instead of the literal `['en', 'hi']`.
- **Audio resolver**: voice-first R2 path convention (`audio/<voice>/symbols/<word>.mp3`) + the one-line `audio/eng/default/` legacy fallback for `en-GB-News-M`. Update `convex/ttsCache.ts` to key by voice id, not language.
- **`languageLifecycle` table added** (publishedAt / expiresAt / tierOverride / status / notes — clone of `packLifecycle` minus pack-specific fields).
- **`en.json` and `hi.json` move** into `convex/data/languages/en.json` and `hi.json` as the first two language modules. `messages/<code>.json` either gets generated from these (single source of truth) or is left where it is and the language module references it — call this in 8.1.

**Verification:** all existing user data still renders correctly post-migration (especially Devanagari Hindi). Library pack publish still works. Audio still resolves for existing en-GB-News-M recordings. No new languages yet — this phase ships invisibly.

### 8.1 — Admin shell + first pipeline (UI strings)

The smallest end-to-end vertical slice — proves the loop.

- **Admin section**: `/admin/languages` page + `LanguagesAdminTable.tsx` cloned from Library shape.
- **Convex API**: `listAllLanguagesForAdmin` returns the registry's current languages joined with `languageLifecycle` rows. `updateLanguageLifecycle` mutates one row. `deleteLanguageLifecycle` removes a row.
- **"Add language" flow**: admin enters ISO code + label + native label + font + initial status (`machine-translated`). Writes a stub `convex/data/languages/<code>.json` via the publish API route. Adds the language to the registry on the next deploy.
- **UI strings pipeline**: button on the admin row → calls an AI translation pass (Anthropic API) that reads `en.json` and writes `<code>.json`. Idempotent — diffs and only translates new/changed keys.
- **Per-row actions** (same shape as Library): Publish · Unpublish · Edit lifecycle · Promote status (machine → beta → stable) · Delete.
- **Picker visibility**: `getVisibleLanguages({ includeBeta, includeMachine })` helper, used by every picker in the app (locale switcher, profile language picker, talker dropdown).

**Verification:** add Spanish from admin → run UI strings pipeline → promote to beta → Spanish appears in the picker with a "preview" badge → switching to `es` renders Spanish UI strings. This is the proof. After this works, everything else is a scaling exercise.

### 8.2 — Symbol translation pipeline + transliterations

The 52k-row job. Highest content volume but the pattern is the same as 8.1.

- **Pipeline**: reads `symbols.words.en` for every symbol, batched, AI-translates to `<code>`, writes back to `symbols.words.<code>` and the transliteration into `synonyms.<code>` (per the ADR-009 §9 we just added).
- **Progress tracking**: a small `translationJobs` table or a status field on `languageLifecycle` showing X/52000 symbols translated. Admin sees a progress bar; pipeline is resumable.
- **Cost note**: this is the one expensive step. Budget the API spend before running. Spanish is cheaper than Korean because Korean wants both Hangul + Latin transliteration.
- **Audit view**: admin section gains a "Translation status" tab showing % UI keys, % symbols, % default packs translated per language.

**Verification:** flip a student profile to Spanish; symbol labels render in Spanish; searching `perro` finds the dog symbol; searching `kutta` finds it in Hindi mode (transliteration hit).

### 8.3 — Default pack translation

Twelve lists × twelve sentences (per Religion/Fun and friends in the catalogue). Small surface; ADR-009 says "translate for real before publish, not stubbed with `(hi)`."

- **Pipeline**: same shape as 8.2 but scoped to `convex/data/library_packs/*.json` fields. AI pass + native-speaker review checkbox per pack per language.
- **Native-speaker review state**: per (pack, language) flag — `reviewed: false | true`. Status promotion (machine → beta → stable) gates on this.

**Verification:** load the Religion pack in Spanish → categories, lists, sentences all render in real Spanish (not `(es)` placeholders).

### 8.4 — Voice seeding

- **TTS provider voice picks**: 4 voices per language (adult M/F, child M/F) chosen from Google Cloud TTS or equivalent. Registry entries added. Voice IDs documented in `lib/languages/<code>.json`.
- **Symbolstix recording seed (optional, per voice)**: per-voice MP3 generation for the 500 priority symbols, written to `audio/<voice>/symbols/<word>.mp3`. TTS cache handles everything else on demand.
- **Settings page picker**: read voices from `registry.voices.filter(v => v.langCode === currentLang)`. Write to `studentProfiles.voiceId`. Already-supported field — wiring only.

**Verification:** profile set to Spanish → adult-female Spanish voice plays the symbol audio. Switch voice → switches.

### 8.5 — Runtime UX (slots, swap flow, fonts, beta badge)

- **Language slots** (Free=1 / Pro=2 / Max=3 per ADR-011 §3): enforced server-side in the "add language to profile" mutation. Slot-full UI shows the swap-out picker.
- **Adding a language UX**: settings page → "Add a language" → list of published languages (filter by visibility helper) → adds to active slot or triggers swap flow.
- **Beta badge in pickers**: small "preview" pill next to language label when `status === 'beta'`.
- **Font loading**: per-language `next/font` loader entries, referenced by the registry. Subset loading triggered on language activation, not at app boot.
- **`translate to <current language>` inline action** for user-created content (per ADR-009 §6) — Pro+ gated per ADR-011 §3.

**Verification:** Free user adding a 2nd language sees upgrade nudge; Pro user adding 3rd sees swap picker; Max user adds three freely; Spanish font loads only when Spanish is active.

### 8.6 — Native-speaker review + ship Spanish & Korean as beta

The translation pipelines have populated everything as machine-translated. This phase is the editorial pass:

- **Spanish reviewer**: friend / contractor edits `convex/data/languages/es.json` UI strings, `symbols.words.es` entries via an admin "Review" view, default pack content.
- **Korean reviewer**: same.
- **Promote** to `beta` (visible in pickers with badge) → eventually `stable` (no badge).
- **Then ship.**

Stable promotion does not happen in Phase 8. Beta is the launch state. Stable comes later when review is complete and real users have used the beta without major complaints.

---

## Direct answers, restated

> **Should I translate the other 2 languages first to have real assets?**

Don't think of it as "translating before building." The act of translating produces JSON files that need a specific shape — that shape only exists after 8.0. After 8.0, the translation *is* the build. You write a pipeline, run it from the admin tab, get translations out. So the order is: foundation first, then pipelines and admin tab together starting with the smallest content surface (UI strings), scaling up.

> **Should I build the language admin tab first?**

The admin tab is not separable from the pipelines. The pipelines need a UI to trigger them; the admin tab needs pipelines to be useful. Build them together in 8.1 with the smallest content type (UI strings, ~800 lines of JSON). When the loop works for UI strings, scale it to symbols (8.2), packs (8.3), voices (8.4).

> **Where do I actually start?**

`convex/schema.ts` — change the `{eng, hin?}` field shape to `{[iso]: string}` across the tables in 8.0, write the migration, run it on a dev branch. That's the wall to push against first. Everything else has a recipe.

---

## Risks worth pre-empting

- **The 8.0 migration is three migrations in a coat** — schema field shape change + `eng→en` rename + audio path field removal. Dry-run with a snapshot of prod data before running for real. Per ADR-009 consequences section.
- **TTS cache invalidation** in 8.0 — moving from per-language key to per-voice key wipes the cache. Acceptable but worth being deliberate (warm the cache for priority symbols post-deploy).
- **Convex search indexes are static** — adding a stable language requires a code edit to add the `search_words_<code>` index. Document this as part of "promoting to stable" so it doesn't surprise later.
- **8.2 pipeline cost** — 52k symbols × N languages × token cost. Bound this with a dry-run estimate before kicking off the real run.
- **Coordinate with ADR-010 pack seeding** — pack JSON files in `convex/data/library_packs/` currently use `{eng, hin}`. The 8.0 migration must update these files in the same pass as the schema, otherwise loaded packs write `(eng/hin)` records into user accounts that look migrated but aren't.

---

## What's explicitly out of scope for Phase 8

- **Stable status** for Spanish or Korean — beta is the launch state.
- **RTL languages** — `dir` is wired through but no RTL language ships now (per ADR-009 §8).
- **User-uploaded languages** — never; languages stay registry-curated.
- **A fourth language** — three slots is the architectural cap until usage data justifies more.
- **External asset API** — R2 paths stay flat to leave the door open, but no API is built.

---

## Verification (full Phase 8)

End-to-end smoke test once everything ships:

1. Sign up a fresh Max-tier user
2. Add Spanish from settings → translated UI, Spanish symbol labels, Spanish voice plays
3. Add Korean → reaches 3 slots
4. Try to add a fourth → swap-out picker appears
5. Create a custom category in Spanish, switch to Korean → "no translation" indicator appears with inline "Translate to Korean" action
6. Click → AI fills the Korean slot, user can edit before saving
7. Switch back to English → no translation indicators visible (data is complete)
8. Admin view: `/admin/languages` shows 4 rows (en, hi, es-beta, ko-beta) with full translation status percentages
