# Block-sentence module pipeline (units + playback + captured text) — design

**Date:** 2026-08-02 · **Status:** Draft (for review)
**Relates to:** ADR-015 (composition primitive / `units`) · ADR-016 (variants) · MOS-27 (variant metadata in the seed round-trip) · FEAT-002 (backup/restore)

---

## 1. Problem

Block/sequence sentences (`playback: "sequence"`) store their composition — and, for a per-language variant, its translated content — in **`units[]`** (ordered word/phrase units with localised `label`/`name`). Playback is stepped per unit.

But the module publish → seed pipeline carries **neither `units` nor `playback`**:
- `libraryModuleSentenceItems` (`convex/schema.ts`) has `name`, `text`, `slots`, audio, and (from MOS-27) `authoredLanguage` + `variantGroupKey` — **no `units`, no `playback`**.
- `publishFolderAsModule` (`convex/contentModules/publish.ts`) serialises only `slots` + `text` for sentences.
- `installContentModule` (`convex/lib/contentModuleInstall.ts`) rebuilds only `slots`/`text`.

So a seeded block sentence loses its composition: no `units` (→ no stepped playback, and the per-language unit content is gone) and no `playback` (→ reader can't tell it's a sequence sentence). It degrades to a flat slot strip. MOS-27 made block variants *group and language-tag* correctly, but their actual content still doesn't survive seeding.

Separately: block sentences keep **no whole-sentence `text`** — the caption ("I want to go to sleep") is derived at render from the units (`blocksFromUnits` → join, `SentencesModeContent.tsx:576-580`). So the admin table shows `text` as `NO-TEXT` for them, and there's no localised string for search.

## 2. Goals / non-goals

**Goals:**
1. Block sentences seed **identically to the authoring account** — `units` + `playback` carried through publish → JSON → install — so the showcase feature works for default/seeded accounts.
2. **Capture the block's full localised text into `text`** at authoring time, so the row shows it like a fluent sentence (and it rides the existing `text` carry to seeded accounts + becomes searchable).

**Non-goals:**
- **Phrases** — already carry `words[]`; untouched.
- **Fluent sentences** — already round-trip via `text`; untouched.
- **The block/fluent field model** — `playback` stays the discriminator (`"sequence"`/`"fluent"`); no move to `kind`. (Legacy rows with unset `playback` are a rebuild concern, not this change.)
- No migration — additive optional fields; the Phase 4 rebuild re-authors.

## 3. Design

Mirrors the MOS-27 approach (widen item shape → publish emits → install sets), plus an authoring-time text capture.

### 3.1 Schema — carry `units` + `playback`
Add to `libraryModuleSentenceItems` (`convex/schema.ts`) and its mirror `LibraryPackSentence` (`convex/data/_shared/types.ts`):
```ts
units:    v.optional(v.array(compositionUnit)),   // reuse the existing compositionUnit validator
playback: v.optional(v.union(v.literal("sequence"), v.literal("fluent"))),
```
`compositionUnit` already exists in `schema.ts` (used by `profileSentences.units`). Both optional ⇒ additive, **no wipe**. `text` already exists (added value below).

### 3.2 Publish — emit them
In `publishFolderAsModule`'s sentence branch, add per item:
```ts
...(s.units ? { units: s.units } : {}),
...(s.playback ? { playback: s.playback } : {}),
```
(`text` is already emitted.)

### 3.3 Install — set them
In `installContentModule`'s sentence branch (`insertSentence`), add:
```ts
...(sentence.units ? { units: sentence.units } : {}),
...(sentence.playback ? { playback: sentence.playback } : {}),
```
(alongside the MOS-27 `authoredLanguage`/`variantGroupId` handling — `slots`/`text`/`name` already set.)

### 3.4 Text capture — derive from units at authoring save
A pure server helper mirrors the client's caption derivation:
```ts
// convex/lib/compositionText.ts
export function deriveCompositionText(units, lang): string
//   units sorted by order → each unit's (phrase → name, word → label)
//   resolved for `lang` via displayValue → joined by " ".
```
Call it wherever a sentence's `units` are written, setting `text` to the derived string in the row's `authoredLanguage` (a plain string — consistent with the fluent string-`text` convention; the reader normalises string → `{authoredLang: text}`):
- `createProfileSentence` (`convex/profileSentences.ts`) — talker save with `units`.
- `createSentenceVariant` — seed the fork's `text` from the source units (already seeds `text`; switch to derived).
- `updateProfileSentenceUnits` — on every unit edit, re-derive + patch `text`.

Only applies when `units` are present (sequence rows); fluent sentences keep typed `text` untouched.

### 3.5 Export / restore — no change
Both are `items` passthroughs; once §3.1–3.2 land they carry `units`/`playback` automatically. `text` already flows.

## 4. Interaction with MOS-27
MOS-27 carried `authoredLanguage` + `variantGroupKey` (grouping + voice). This adds `units` + `playback` (composition + playback mode) + captured `text`. **Together = full block-sentence round-trip**: a seeded block variant groups, collapses by board language, voices correctly, and plays its stepped per-language composition.

## 5. Backward compatibility
All new module fields optional → existing rows/JSON validate unchanged, no wipe. Fluent sentences (no `units`) serialise exactly as today. `playback` unset on legacy rows keeps the reader default (unchanged). Ships via `main` (additive → normal `convex dev` push).

## 6. Edge cases
- **Fluent sentence** — no `units`; `units`/`playback` omitted; `text` is the typed string (unchanged). Text capture skipped (no units).
- **`slots` stays carried** as the flat rendered view (readers still migrating from `slots` to `units`, ADR-015). We now carry *both*.
- **Untranslated block variant** — its units lack the target language; MOS-26's skip is text-based and keeps text-less rows, so such a variant still seeds (grouped, collapses, shows source fallback). Cleaning those is authoring hygiene (as established), not this change.
- **Text drift** — deriving `text` on every units-write keeps it in sync; no manual maintenance.

## 7. Testing / verification (no unit-test harness — `tsc` + runtime)
1. `tsc -p convex/tsconfig.json` clean after each change.
2. Runtime: author a **block** sentence with a hi variant (re-arranged units) → confirm the row's `text` is now the derived Hindi caption → publish → export (JSON item carries `units` + `playback` + `text`) → wipe + restore → fresh signup → the seeded block sentence **plays stepped**, collapses to the hi variant on a hi board, and shows the Hindi caption. Fluent sentence unaffected.

## 8. Rollout & ADR
- Prerequisite to **Phase 4** alongside MOS-27 (block sentences are showcase defaults).
- On ship, add an **ADR-015 addendum** ("composition carried through the module seed round-trip") + note on ADR-016.
- Deploys via `main` (cherry-pick, as with MOS-27).

## 9. Out of scope
Phrase changes; fluent-sentence changes; the `playback`→`kind` redesign; retroactive backfill of `text`/`playback` on legacy rows (the rebuild handles those).
