# Variant-aware module publish & seeding — design

**Date:** 2026-08-01 · **Status:** Draft (for review)
**Relates to:** ADR-016 (composed-content language variants) · ADR-015 (composition primitive) · ADR-014 (content modules) · FEAT-002 (library-modules backup/restore) · MOS-26 (skip untranslated siblings at publish)

---

## 1. Problem

Sentence and phrase **language variants** (ADR-016 §1) are sibling `profileSentences` / `profilePhrases` rows linked by `variantGroupId` and tagged with `authoredLanguage`. In an authoring account this works: the client collapses each group to the board language and resolves voice off `authoredLanguage`.

But the **module publish → seed round-trip silently drops both fields**, so seeded (default) accounts get broken content:

- `libraryModuleSentenceItems` (`convex/schema.ts:206`) and `libraryModulePhraseItems` (`convex/schema.ts:296`) have **no `authoredLanguage`, no `variantGroupId`**.
- `publishFolderAsModule` (`convex/contentModules/publish.ts:74-116`) serialises rows 1:1 and emits neither field.
- `installContentModule` (`convex/lib/contentModuleInstall.ts:267` sentences / `:306` phrases) creates the seeded rows **without** either field (grep: zero matches).

### Observed symptoms (fresh-signup seed test, 2026-08-01)
- **Every language variant shows on every board** — no `variantGroupId` ⇒ no client collapse.
- **Stuck on EN voice** even on a Hindi board / Hindi variant — no `authoredLanguage` ⇒ voice resolution defaults to `en`.
- **Duplicates** — each sibling installs as its own ungrouped row.

Lists and `dropbar-core` seed correctly (lists are single-record localised labels; no variant model), confirming the fault is specific to the composed-content variant round-trip.

## 2. Goals / non-goals

**Goal:** a folder of properly-authored variant groups, once published, seeds into a new account as correctly-grouped, language-tagged content — collapsing by board language and voicing correctly, identical to the authoring account.

**Non-goals:**
- **Untranslated/junk siblings** (a variant tagged `hi` still holding English) — handled by **MOS-26** (skip at publish). This spec makes *complete* variants seed correctly; MOS-26 removes *incomplete* ones.
- **Genuine duplicate rows** in the authoring account (e.g. `countryside` ×3 identical) — authoring hygiene, cleaned during the Phase 4 rebuild. Not a pipeline concern.
- **Lists** — already correct; untouched.
- No migration of existing module JSON — the Phase 4 rebuild re-authors and re-publishes; this is a **forward fix**.

## 3. Design (Approach A — carry the metadata through the pipeline)

### 3.1 Schema — widen the two module-item validators
Add to **both** `libraryModuleSentenceItems` and `libraryModulePhraseItems`:
```ts
authoredLanguage: v.optional(v.string()),
variantGroupKey:  v.optional(v.string()), // opaque grouping token = source row's original _id
```
Both **optional ⇒ backward-compatible**. Existing rows validate unchanged; **no table wipe required** (contrast with the Phase-3 field *drops*).

### 3.2 Publish — emit the metadata
In `publishFolderAsModule`, for the `sentences` and `phrases` branches, add per item:
```ts
...(row.authoredLanguage ? { authoredLanguage: row.authoredLanguage } : {}),
...((row.variantGroupId ?? row._id) ? { variantGroupKey: row.variantGroupId ?? row._id } : {}),
```
`variantGroupKey` is the **group token** = `variantGroupId ?? _id` (the source row's `_id`). All siblings in a group share it. Singletons get their own unique key (a group of one).

### 3.3 Install — re-link groups + tag language
In `contentModuleInstall`, replace the flat per-item insert (sentences/phrases branches) with a **group-aware** pass:

1. **Bucket** the module's items by `variantGroupKey` (items without one → singleton bucket of size 1).
2. For each bucket:
   - **Pick the source** = the item with `authoredLanguage === DEFAULT_LOCALE` (`"en"`), else the lowest-`order` item. (Source is the collapse fallback, so English-first gives the best default.)
   - Assign **one shared `order` slot** to the whole bucket (ADR-016 §1: siblings occupy one stable slot).
   - **Insert the source first**, capturing its new `_id`.
   - If the bucket has **>1** item, set `variantGroupId = source._id` on the source and on every sibling (siblings inserted pointing at the source's new `_id`). If the bucket has **1** item, leave `variantGroupId` unset (lazy grouping — a singleton).
   - Set `authoredLanguage` on **every** inserted row from its item.

Everything else about the insert (name, slots/words, audio, `folderId`, `librarySourceId`) is unchanged.

### 3.4 Export / restore — no change
`dumpAllModules` (`convex/contentModules/exportModules.ts:39`) and `seedLibraryModulesFromJSON` are `items` passthroughs, so once §3.1–3.2 land the new fields ride along into the committed JSON and back out on restore automatically.

## 4. Why the round-trip is correct after this

| Field | Authoring row | Published item | Seeded row |
|---|---|---|---|
| `authoredLanguage` | set | **now emitted** | **now set** ⇒ correct voice |
| `variantGroupId` | set (`= source _id`) | **now emitted as `variantGroupKey`** | **re-linked to new source `_id`** ⇒ client collapses |

Collapse and voice resolution are unchanged client code (`getProfileSentences`/`getProfilePhrases` already return both fields; the client already collapses by board language). We are only restoring the inputs they were always meant to receive.

## 5. Edge cases

- **Singletons** — one item, no siblings; `variantGroupId` left unset (matches a normal new sentence/phrase). Works today, still works.
- **Order** — assigned per bucket, not per item, so a group occupies one list slot (ADR-016 §1). Hidden siblings never create visible gaps.
- **No `en` variant in a group** — source falls back to lowest-`order` item; that language shows as the fallback on unsupported boards (with its "Made in" badge), which is the ADR-016 §2 behaviour.
- **Untranslated sibling slips through** (MOS-26 not yet applied) — it will now at least *group and collapse* rather than duplicate; still shows source-language text + badge on its board. MOS-26 removes it entirely; the two are complementary.
- **Idempotent install** — install already creates a fresh folder per module; re-install is out of scope (unchanged).

## 6. Testing / verification

1. **Authoring fixture** — a folder with one fully-translated group (en+hi+es) + one singleton.
2. **Publish → export** — assert each variant item in the JSON carries `authoredLanguage` and a shared `variantGroupKey`; singleton carries its own.
3. **Restore → fresh-account seed** — assert seeded `profileSentences`/`profilePhrases`: siblings share one re-linked `variantGroupId`, source points to itself, each row has `authoredLanguage`.
4. **Runtime** — on a **hi** board only the hi variant shows and speaks in the hi voice; on **en** the en variant; singleton shows everywhere. Confirms all three original symptoms are resolved.
5. **Regression** — lists seed unchanged; a module with no variants (all singletons) seeds exactly as before.
6. `tsc -p convex/tsconfig.json` clean.

## 7. Sequencing & rollout

- **Prerequisite to Phase 4** of the Default modules remake — do not rebuild/publish sentences & phrases until this ships, or the rebuilt defaults inherit the same broken seeds.
- Ships via `main` (schema widen is additive/optional → normal `convex dev` push, no wipe).
- On ship, add an **ADR-016 addendum** ("Variant metadata in the module publish/seed round-trip") recording the decision, per the ADR-016 addendum pattern.
- **MOS-26** (skip untranslated siblings) can land in the same change or immediately after — both touch `publishFolderAsModule`.

## 8. Out of scope (explicit)
Deduping genuine duplicate authoring rows; any list changes; MT/translation behaviour; the authoring UI. This spec is strictly the publish→module→install variant round-trip.
