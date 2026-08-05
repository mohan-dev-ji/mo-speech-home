# Variant-aware Module Seeding Implementation Plan

**Status:** ✅ Shipped to `main` (2026-08-02). Landed via `3e475b2` / `411d199` / `3b0dce7` / `b863da6`; ADR-016 addendum `a8255ac`. Archived 2026-08-05 (checkboxes below left as-authored). One of the phase-15.9 module seed round-trip pair with [`phase-15.9-block-sentence-module-pipeline.md`](phase-15.9-block-sentence-module-pipeline.md).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carry `authoredLanguage` + variant-group identity through the module publish → JSON → seed pipeline so seeded (default) accounts reproduce the authoring account's variant groups (collapse by board language + correct voice).

**Architecture:** Widen the two composed-content module-item validators (and their mirror TS types) with two optional fields; have `publishFolderAsModule` emit them; have `installContentModule` re-group items by a shared key and re-link siblings' `variantGroupId` to the newly-inserted source row (ADR-016 §1). Export/restore are `items` passthroughs and need no change.

**Tech Stack:** Convex (schema validators + mutations), TypeScript. No test framework in this repo — verification is `tsc -p convex/tsconfig.json` + a runtime seed-round-trip protocol (Task 4).

**Spec:** `docs/superpowers/specs/2026-08-01-variant-aware-module-seeding-design.md`

## Global Constraints

- **Convex deploys from `main`.** The worktree must NOT run `npx convex dev` (it spawns an anonymous local backend + rewrites `.env.local`). Verify locally with `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json`; the change reaches the deployment only when merged to `main` (where the user's `convex dev` pushes it).
- **Node 20+** for any Convex CLI command (`nvm use 20.17.0`).
- **Additive only — no table wipe.** Both new fields are `v.optional`, so existing rows keep validating.
- **Two type sources must stay in sync:** the schema validators (`convex/schema.ts`, used by `publish` via `Doc<"libraryModules">`) AND the mirror types (`convex/data/_shared/types.ts`, used by `install` via `ContentModule`). A field added to one but not the other is a type error.
- **ADR-016 §1 grouping:** the group id is the source row's `_id`; source row `variantGroupId === _id`; siblings `variantGroupId === source._id`; a singleton leaves `variantGroupId` unset.
- **Forward fix, no migration:** the Phase 4 rebuild re-authors + re-publishes; existing messy JSON is wiped/rebuilt.

---

### Task 1: Widen the composed-content module-item types

Add `authoredLanguage` + `variantGroupKey` to both the DB validators and the mirror TS types. Grouped as one task because the two sources must match or `tsc` fails.

**Files:**
- Modify: `convex/schema.ts` (`libraryModuleSentenceItems` ~L206, `libraryModulePhraseItems` ~L296)
- Modify: `convex/data/_shared/types.ts` (`LibraryPackSentence` ~L135, `LibraryPackPhrase` ~L225)

**Interfaces:**
- Produces: module sentence/phrase items may now carry `authoredLanguage?: string` and `variantGroupKey?: string`. Consumed by Task 2 (publish writes them) and Task 3 (install reads them).

- [ ] **Step 1: Add the fields to the sentence validator**

In `convex/schema.ts`, inside `libraryModuleSentenceItems`, immediately after `order: v.number(),`:

```ts
    order: v.number(),
    // ADR-016 seed round-trip — variant metadata so seeded rows collapse by
    // board language + voice correctly. `variantGroupKey` = the source row's
    // original _id (shared by all siblings); install re-links to a new _id.
    authoredLanguage: v.optional(v.string()),
    variantGroupKey: v.optional(v.string()),
```

- [ ] **Step 2: Add the fields to the phrase validator**

In `convex/schema.ts`, inside `libraryModulePhraseItems`, immediately after `order: v.number(),`:

```ts
    order: v.number(),
    // ADR-016 seed round-trip — see libraryModuleSentenceItems.
    authoredLanguage: v.optional(v.string()),
    variantGroupKey: v.optional(v.string()),
```

- [ ] **Step 3: Add the fields to `LibraryPackSentence`**

In `convex/data/_shared/types.ts`, in `LibraryPackSentence`, after `order: number;`:

```ts
  order: number;
  /** ADR-016 seed round-trip — variant language tag + shared group token. */
  authoredLanguage?: string;
  variantGroupKey?: string;
```

- [ ] **Step 4: Add the fields to `LibraryPackPhrase`**

In `convex/data/_shared/types.ts`, in `LibraryPackPhrase`, after `order: number;`:

```ts
  order: number;
  /** ADR-016 seed round-trip — variant language tag + shared group token. */
  authoredLanguage?: string;
  variantGroupKey?: string;
```

- [ ] **Step 5: Typecheck (additive → must stay green)**

Run: `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json`
Expected: no errors (optional fields; nothing references them yet).

- [ ] **Step 6: Commit**

```bash
git add convex/schema.ts convex/data/_shared/types.ts
git commit -m "feat(modules): carry authoredLanguage + variantGroupKey on composed module items"
```

---

### Task 2: Publish emits the variant metadata

**Files:**
- Modify: `convex/contentModules/publish.ts` (`publishFolderAsModule`, sentences branch ~L80-89, phrases branch ~L99-116)

**Interfaces:**
- Consumes: the widened item shape from Task 1.
- Produces: published `libraryModules.items` now carry `authoredLanguage` + `variantGroupKey` for grouped rows.

- [ ] **Step 1: Emit on sentence items**

In the `tree === "sentences"` branch, in the `sentences.map((s, i) => ({ … }))` object, add (a source or sibling always has `variantGroupId` set; singletons have neither field):

```ts
      items = sentences.map((s, i) => ({
        name: s.name,
        order: i,
        ...(s.text !== undefined ? { text: s.text } : {}),
        slots: [...s.slots].sort((a, b) => a.order - b.order),
        ...(s.audioPath !== undefined ? { audioPath: s.audioPath } : {}),
        ...(s.recordedAudioPath !== undefined
          ? { recordedAudioPath: s.recordedAudioPath }
          : {}),
        ...(s.authoredLanguage ? { authoredLanguage: s.authoredLanguage } : {}),
        ...(s.variantGroupId ? { variantGroupKey: s.variantGroupId } : {}),
      }));
```

- [ ] **Step 2: Emit on phrase items**

In the `else` (phrases) branch, in the `phrases.map((p, i) => ({ … }))` object, add alongside `name`/`order`/audio/`words`:

```ts
        ...(p.authoredLanguage ? { authoredLanguage: p.authoredLanguage } : {}),
        ...(p.variantGroupId ? { variantGroupKey: p.variantGroupId } : {}),
```

- [ ] **Step 3: Typecheck**

Run: `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json`
Expected: no errors (`s`/`p` are `Doc<"profileSentences">`/`Doc<"profilePhrases">`, which have `authoredLanguage`/`variantGroupId`; targets are the fields added in Task 1).

- [ ] **Step 4: Commit**

```bash
git add convex/contentModules/publish.ts
git commit -m "feat(publish): emit authoredLanguage + variantGroupKey on published composed items"
```

---

### Task 3: Publish — skip untranslated variant siblings (MOS-26)

Drop non-source variant siblings whose primary field lacks their own language (untranslated junk), so incomplete variants never enter a module and never seed.

**Files:**
- Modify: `convex/contentModules/publish.ts` (imports; sentences `.collect()` ~L60-64; phrases `.collect()` ~L94-98)

**Interfaces:**
- Consumes: `needsTranslation` (`lib/languages/variants.ts`) and `DEFAULT_LOCALE` (`lib/languages/registry.ts`) — both already imported elsewhere in `convex/`, so server-safe. `Doc` is already imported in publish.ts.
- Produces: published `items` exclude untranslated non-source siblings. Composes with Task 2 (kept siblings still carry `variantGroupKey`) and Task 4 (install groups the kept set; a group reduced to just its source installs as a singleton).

- [ ] **Step 1: Import the helpers**

Add to `convex/contentModules/publish.ts` imports:

```ts
import { needsTranslation } from "../../lib/languages/variants";
import { DEFAULT_LOCALE } from "../../lib/languages/registry";
```

- [ ] **Step 2: Add the skip predicates (module scope, after imports)**

```ts
/**
 * A NON-source variant sibling whose primary localised field lacks its own
 * language is untranslated junk — skip it at publish so it never seeds (MOS-26,
 * ADR-016 Addendum C: fluent → text, phrase → name). Source rows, and sentences
 * with no `text` (sequence — judged by structure, not text), are always kept.
 */
function isUntranslatedSentence(s: Doc<"profileSentences">): boolean {
  const isSource = !s.variantGroupId || s.variantGroupId === s._id;
  if (isSource || s.text === undefined) return false;
  const lang = s.authoredLanguage ?? DEFAULT_LOCALE;
  const rec = typeof s.text === "string" ? { [lang]: s.text } : s.text;
  return needsTranslation(rec, lang);
}
function isUntranslatedPhrase(p: Doc<"profilePhrases">): boolean {
  const isSource = !p.variantGroupId || p.variantGroupId === p._id;
  if (isSource) return false;
  const lang = p.authoredLanguage ?? DEFAULT_LOCALE;
  return needsTranslation(p.name, lang);
}
```

- [ ] **Step 3: Filter sentences before mapping**

In the `tree === "sentences"` branch, append a filter to the existing `.collect()` so `sentences` excludes untranslated siblings (the later `.map((s, i) => …, order: i)` then reindexes with no gaps):

```ts
      const sentences = (
        await ctx.db
          .query("profileSentences")
          .withIndex("by_folder_id_and_order", (q) => q.eq("folderId", folderId))
          .order("asc")
          .collect()
      ).filter((s) => !isUntranslatedSentence(s));
```

- [ ] **Step 4: Filter phrases before mapping**

In the phrases branch, likewise:

```ts
      const phrases = (
        await ctx.db
          .query("profilePhrases")
          .withIndex("by_folder_id_and_order", (q) => q.eq("folderId", folderId))
          .order("asc")
          .collect()
      ).filter((p) => !isUntranslatedPhrase(p));
```

- [ ] **Step 5: Typecheck**

Run: `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json`
Expected: no errors. The `EMPTY_FOLDER` guard is unaffected — every group keeps its source, so a non-empty folder never filters to zero.

- [ ] **Step 6: Commit**

```bash
git add convex/contentModules/publish.ts
git commit -m "feat(publish): skip untranslated variant siblings so incomplete variants don't seed (MOS-26)"
```

---

### Task 4: Group-aware install (re-link siblings + tag language)

**Files:**
- Create: `convex/lib/variantGroupPlan.ts`
- Modify: `convex/lib/contentModuleInstall.ts` (import ~L19; sentences branch L248-281; phrases branch L282-323)

**Interfaces:**
- Consumes: the widened items from Task 1 (`authoredLanguage`, `variantGroupKey`).
- Produces: seeded `profileSentences`/`profilePhrases` rows with `authoredLanguage` set and, for real groups, `variantGroupId` re-linked to the new source `_id` (source → itself, siblings → source).

- [ ] **Step 1: Create the pure grouping helper**

Create `convex/lib/variantGroupPlan.ts`:

```ts
/**
 * Plan the install of composed module items (ADR-016 §1) so a seeded account
 * reproduces the authoring account's variant groups. Buckets items by
 * `variantGroupKey` (absent → its own singleton group), assigns ONE shared
 * order slot per group, and picks the source (the collapse fallback) as the
 * `en` member, else the lowest-`order` member. Pure — no ctx; the caller does
 * the table-specific inserts and links siblings to the source's new _id.
 */
const DEFAULT_LOCALE = "en";

export type VariantPlanItem = {
  order: number;
  authoredLanguage?: string;
  variantGroupKey?: string;
};

export type PlannedVariantGroup<T> = {
  /** Shared list-order slot for the whole group. */
  order: number;
  /** Fallback row shown on boards without a matching-language variant. */
  source: T;
  /** Non-source siblings (empty for a singleton). */
  siblings: T[];
};

export function planVariantGroups<T extends VariantPlanItem>(
  items: readonly T[],
  startOrder: number,
): { groups: PlannedVariantGroup<T>[]; nextOrder: number } {
  const buckets = new Map<string, T[]>();
  let singletonSeq = 0;
  for (const item of items) {
    const key = item.variantGroupKey ?? `__singleton_${singletonSeq++}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }

  const groups: PlannedVariantGroup<T>[] = [];
  let order = startOrder;
  for (const members of buckets.values()) {
    const sorted = [...members].sort((a, b) => a.order - b.order);
    const source =
      sorted.find(
        (m) => (m.authoredLanguage ?? DEFAULT_LOCALE) === DEFAULT_LOCALE,
      ) ?? sorted[0];
    groups.push({
      order: order++,
      source,
      siblings: sorted.filter((m) => m !== source),
    });
  }
  return { groups, nextOrder: order };
}
```

- [ ] **Step 2: Import the helper + the item types in `contentModuleInstall.ts`**

Change the shared-types import (currently `import type { ContentModule, PackTier } from "../data/_shared/types";`) and add the helper import:

```ts
import type {
  ContentModule,
  PackTier,
  LibraryPackSentence,
  LibraryPackPhrase,
} from "../data/_shared/types";
import { planVariantGroups } from "./variantGroupPlan";
```

- [ ] **Step 3: Replace the sentences install branch**

Replace the **entire** sentences-then-phrases block (from `} else if (module.tree === "sentences") {` at L248 through the closing `}` of the phrases branch at L324) using this step's code **followed immediately by** Step 4's code. This step's code ends by opening `} else {` (the phrases branch); Step 4's code supplies that branch's body and the final `}`. Together they replace L248-324 exactly once.

```ts
  } else if (module.tree === "sentences") {
    const buildSlots = (sentence: LibraryPackSentence) =>
      Promise.all(
        sentence.slots.map(async (slot) => {
          let imagePath = slot.imagePath;
          if (slot.symbolId) {
            const sym = await ctx.db.get(slot.symbolId as Id<"symbols">);
            if (sym) imagePath = sym.imagePath;
          }
          return {
            order: slot.order,
            ...(imagePath !== undefined ? { imagePath } : {}),
            ...(slot.displayProps !== undefined
              ? { displayProps: slot.displayProps }
              : {}),
          };
        }),
      );

    const insertSentence = async (
      sentence: LibraryPackSentence,
      order: number,
      variantGroupId: Id<"profileSentences"> | undefined,
    ): Promise<Id<"profileSentences">> =>
      ctx.db.insert("profileSentences", {
        accountId,
        name: sentence.name,
        order,
        ...(sentence.text !== undefined ? { text: sentence.text } : {}),
        slots: await buildSlots(sentence),
        ...(sentence.audioPath !== undefined
          ? { audioPath: sentence.audioPath }
          : {}),
        ...(sentence.authoredLanguage
          ? { authoredLanguage: sentence.authoredLanguage }
          : {}),
        ...(variantGroupId ? { variantGroupId } : {}),
        folderId,
        librarySourceId: module.slug,
        updatedAt: now,
      });

    const { groups } = planVariantGroups(module.items, 0);
    for (const group of groups) {
      const sourceId = await insertSentence(group.source, group.order, undefined);
      for (const sibling of group.siblings) {
        await insertSentence(sibling, group.order, sourceId);
      }
      if (group.siblings.length > 0) {
        await ctx.db.patch(sourceId, { variantGroupId: sourceId });
      }
      itemsAdded += 1 + group.siblings.length;
    }
  } else {
```

Note: this replacement ends by opening the `} else {` for the phrases branch — do not duplicate it.

- [ ] **Step 4: Replace the phrases install branch**

Replace the phrases branch body (L282-323, the `else { … }` contents up to the closing `}` before `return {`) with (keep the existing explanatory comment at the top):

```ts
    // phrases (ADR-015) — foldered like sentences; materialise into
    // profilePhrases. Each phrase holds words[] only (one level deep). Phrase
    // audio is whole-chunk (audioPath/recordedAudioPath); word-level audio
    // resolves from the symbol at render, so words store imagePath only.
    const buildWords = (phrase: LibraryPackPhrase) =>
      Promise.all(
        phrase.words.map(async (word) => {
          let imagePath = word.imagePath;
          if (word.symbolId) {
            const sym = await ctx.db.get(word.symbolId as Id<"symbols">);
            if (sym) imagePath = sym.imagePath;
          }
          return {
            order: word.order,
            ...(imagePath !== undefined ? { imagePath } : {}),
            ...(word.label !== undefined ? { label: word.label } : {}),
            ...(word.displayProps !== undefined
              ? { displayProps: word.displayProps }
              : {}),
          };
        }),
      );

    const insertPhrase = async (
      phrase: LibraryPackPhrase,
      order: number,
      variantGroupId: Id<"profilePhrases"> | undefined,
    ): Promise<Id<"profilePhrases">> =>
      ctx.db.insert("profilePhrases", {
        accountId,
        kind: "phrase",
        name: phrase.name,
        order,
        words: await buildWords(phrase),
        ...(phrase.audioPath !== undefined
          ? { audioPath: phrase.audioPath }
          : {}),
        ...(phrase.recordedAudioPath !== undefined
          ? { recordedAudioPath: phrase.recordedAudioPath }
          : {}),
        ...(phrase.authoredLanguage
          ? { authoredLanguage: phrase.authoredLanguage }
          : {}),
        ...(variantGroupId ? { variantGroupId } : {}),
        folderId,
        librarySourceId: module.slug,
        updatedAt: now,
      });

    const { groups } = planVariantGroups(module.items, 0);
    for (const group of groups) {
      const sourceId = await insertPhrase(group.source, group.order, undefined);
      for (const sibling of group.siblings) {
        await insertPhrase(sibling, group.order, sourceId);
      }
      if (group.siblings.length > 0) {
        await ctx.db.patch(sourceId, { variantGroupId: sourceId });
      }
      itemsAdded += 1 + group.siblings.length;
    }
  }
```

- [ ] **Step 5: Typecheck**

Run: `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json`
Expected: no errors. If it complains that `module.items` isn't narrowed to `LibraryPackSentence[]`/`LibraryPackPhrase[]`, confirm the branch is still guarded by `module.tree === "sentences"` / the `else` (phrases) — the discriminated union narrows `module.items` accordingly.

- [ ] **Step 6: Commit**

```bash
git add convex/lib/variantGroupPlan.ts convex/lib/contentModuleInstall.ts
git commit -m "feat(install): re-link variant groups + tag authoredLanguage when seeding composed content"
```

---

### Task 5: Runtime acceptance — seed round-trip protocol

No unit-test harness exists; this is the acceptance protocol (mirrors the Phase 2 validation). Deploy first, then verify the round-trip end-to-end. Steps marked **(user)** need the app UI / a real signup.

**Files:** none (verification only).

- [ ] **Step 1: Deploy to `main`**

Merge (or cherry-pick Tasks 1–4) to `main` so `convex dev` pushes the schema widen + publish (emit + skip) + install. Confirm the `convex dev` terminal shows a clean push (schema widen is additive → no validation failure).

- [ ] **Step 2: (user) Author a fixture group**

In the admin account, in a throwaway test folder (Sentences tree): create one sentence, add a **hi variant and translate it** (badge → translate), and create one **singleton** sentence (no variant). Repeat one phrase group in a Phrases folder.

- [ ] **Step 3: (user) Publish the folder(s) as Default modules** via the admin publish flow.

- [ ] **Step 4: Export + assert the JSON carries the metadata**

```bash
source ~/.nvm/nvm.sh && nvm use 20.17.0 && node scripts/export-library-modules.mjs
```
Open the produced `convex/data/sentences/<slug>.json`: the grouped items must each carry `authoredLanguage` and a **shared** `variantGroupKey`; the singleton item must have **neither**.

- [ ] **Step 5: (user) Fresh signup** on a brand-new account (seeds from the restored defaults).

- [ ] **Step 6: Assert seeded rows are grouped + tagged**

```bash
npx convex export --path backups/verify-variant-seed.zip
```
Unzip; in `profileSentences/documents.jsonl` for the new account: the grouped rows share **one** `variantGroupId`, the source row's `variantGroupId === its own _id`, and **every** row has `authoredLanguage`. The singleton has no `variantGroupId`.

- [ ] **Step 7: Runtime confirm the three symptoms are gone**

On the new account: a **hi** board shows only the hi variant and speaks in the **hi** voice; an **en** board shows the en variant; the singleton shows on both; **no duplicates**. This is the pass condition.

---

### Task 6: Document the decision (ADR-016 addendum)

**Files:**
- Modify: `docs/4-builds/decisions/ADR-016-composed-content-language-variants.md`

- [ ] **Step 1: Append Addendum L**

Append to `ADR-016-composed-content-language-variants.md` (current last addendum is K, so this is **L**):

```markdown
## Addendum L — Variant metadata in the module publish/seed round-trip

The variant model (§1) lived only on per-account rows; the module
publish → JSON → seed pipeline silently dropped `authoredLanguage` and
`variantGroupId`, so seeded (default) accounts got ungrouped,
language-untagged rows — every variant showing on every board, stuck on the
`en` voice, and duplicated. Fix: composed module-items now carry
`authoredLanguage` + a `variantGroupKey` (the source row's original `_id`);
`publishFolderAsModule` emits them; `installContentModule` buckets items by
`variantGroupKey`, picks the source (`en`-first, else lowest `order`), assigns
one shared order slot, and re-links siblings' `variantGroupId` to the new
source `_id` (§1). Export/restore are `items` passthroughs (no change).

Scope: this makes *complete* variants seed correctly. Incomplete (untranslated)
siblings are stripped at publish (MOS-26); genuine duplicate authoring rows are
Phase-4 hygiene. Additive optional fields — no migration.

Implemented by `docs/4-builds/plans/variant-aware-module-seeding.md`.
```

- [ ] **Step 2: Commit**

```bash
git add docs/4-builds/decisions/ADR-016-composed-content-language-variants.md
git commit -m "docs(adr): ADR-016 addendum — variant metadata in module seed round-trip"
```

---

## Notes for the tracker
- This is a **prerequisite to Phase 4** (MOS-13) of the Default modules remake — flag/create a Linear issue and set it blocking MOS-13.
- **MOS-26** (skip untranslated siblings at publish) is now **Task 3** of this plan — close MOS-26 as "folded into the variant-aware seeding fix" when this ships.
