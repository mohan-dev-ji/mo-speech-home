# Block-sentence Module Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carry block/sequence sentences' `units[]` + `playback` through the module publish → JSON → seed pipeline, and capture each block sentence's full localised text into `text` at authoring time — so seeded (default) accounts get working block sentences.

**Architecture:** Widen the sentence module-item validator + its mirror TS type with `units` + `playback` (reusing the existing `compositionUnit` validator); have `publishFolderAsModule` emit them and `installContentModule` set them (extending the MOS-27 sentence branch). Add a pure server helper that derives a block sentence's caption from its units, and call it wherever `units` are written so `text` stays in sync.

**Tech Stack:** Convex (validators + mutations), TypeScript. No test framework — verification is `tsc -p convex/tsconfig.json` + a runtime seed-round-trip (Task 5).

**Spec:** `docs/superpowers/specs/2026-08-02-block-sentence-module-pipeline-design.md`
**Builds on:** MOS-27 (variant metadata carry — already shipped). This adds composition (`units`/`playback`) + captured `text`.

## Global Constraints

- **Convex deploys from `main`.** Do NOT run `npx convex dev`/`codegen`/deploy in the worktree. Verify with `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json`. `Doc` types derive from `schema.ts` at type-check time (no codegen needed).
- **Node 20+** for any CLI command.
- **Additive only — no wipe.** New fields are `v.optional`.
- **Two type sources stay in sync:** the schema validator (`convex/schema.ts`, used by publish via `Doc<"libraryModules">`) AND the mirror type (`convex/data/_shared/types.ts`, used by install via `ContentModule`).
- **`playback` stays the block/fluent discriminator** (`"sequence"`/`"fluent"`); no move to `kind`.
- Only **sentences** change — phrases (carry `words[]`) and fluent sentences (carry `text`) are untouched.
- Commit after each task; trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: Widen the sentence module-item type with `units` + `playback`

**Files:**
- Modify: `convex/schema.ts` (`libraryModuleSentenceItems` ~L206)
- Modify: `convex/data/_shared/types.ts` (add `CompositionWord`/`CompositionUnit` types; extend `LibraryPackSentence` ~L135)

**Interfaces:**
- Produces: module sentence items may carry `units?: CompositionUnit[]` and `playback?: "sequence" | "fluent"`. Consumed by Tasks 2 (publish) and 3 (install).

- [ ] **Step 1: Add the validators to `libraryModuleSentenceItems`**

In `convex/schema.ts`, inside `libraryModuleSentenceItems`, after the MOS-27 `variantGroupKey` line (or after `text:`), add — reusing the existing `compositionUnit` validator defined earlier in the file:

```ts
    // ADR-015 composition carried through the seed round-trip: block/sequence
    // sentences keep their per-language content in units[], stepped by playback.
    units: v.optional(v.array(compositionUnit)),
    playback: v.optional(v.union(v.literal("sequence"), v.literal("fluent"))),
```

- [ ] **Step 2: Add the mirror TS types to `_shared/types.ts`**

In `convex/data/_shared/types.ts`, add these types (mirror of `compositionWord`/`compositionUnit` in `schema.ts`; reuse the existing `LibraryPackSentenceSlotDisplay` for display props). Place them above `LibraryPackSentence`:

```ts
export type CompositionWord = {
  order: number;
  imagePath?: string;
  audioPath?: string;
  label?: LocalisedString;
  displayProps?: LibraryPackSentenceSlotDisplay;
};

export type CompositionUnit =
  | {
      kind: "word";
      order: number;
      imagePath?: string;
      audioPath?: string;
      label?: LocalisedString;
      displayProps?: LibraryPackSentenceSlotDisplay;
    }
  | {
      kind: "phrase";
      order: number;
      name: LocalisedString;
      audioPath?: string;
      recordedAudioPath?: string;
      librarySourceId?: string;
      words: CompositionWord[];
    };
```

Then extend `LibraryPackSentence` — after its `text?` line, add:

```ts
  units?: CompositionUnit[];
  playback?: "sequence" | "fluent";
```

- [ ] **Step 3: Typecheck**

Run: `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json`
Expected: clean. If it flags a mismatch between the `_shared` `CompositionUnit` and the schema `compositionUnit` (e.g. display-prop shape), align the `_shared` type to the validator in `schema.ts` (the validator is the source of truth) until clean.

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts convex/data/_shared/types.ts
git commit -m "feat(modules): carry units + playback on composed sentence module items"
```

---

### Task 2: Publish emits `units` + `playback`

**Files:**
- Modify: `convex/contentModules/publish.ts` (`publishFolderAsModule`, sentences branch — the `sentences.map((s, i) => ({ … }))`)

**Interfaces:**
- Consumes: Task 1's widened item type. Produces: published sentence items carry `units`/`playback`.

- [ ] **Step 1: Emit the fields**

In the `tree === "sentences"` branch, in the item object (after the MOS-27 `...(s.variantGroupId ? { variantGroupKey: s.variantGroupId } : {}),` line), add:

```ts
        ...(s.units ? { units: s.units } : {}),
        ...(s.playback ? { playback: s.playback } : {}),
```

- [ ] **Step 2: Typecheck**

Run: `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json`
Expected: clean (`s` is `Doc<"profileSentences">`, which has `units`/`playback`; targets are the Task-1 fields).

- [ ] **Step 3: Commit**

```bash
git add convex/contentModules/publish.ts
git commit -m "feat(publish): emit units + playback on published sentence items"
```

---

### Task 3: Install sets `units` + `playback`

**Files:**
- Modify: `convex/lib/contentModuleInstall.ts` (`insertSentence`, sentences branch ~L278)

**Interfaces:**
- Consumes: the widened items. Produces: seeded `profileSentences` rows carry `units`/`playback`, so block sentences render + play as authored.

- [ ] **Step 1: Set the fields on insert**

In `insertSentence`'s `ctx.db.insert("profileSentences", { … })`, after the MOS-27 `...(variantGroupId ? { variantGroupId } : {}),` line (before `folderId`), add:

```ts
        ...(sentence.units ? { units: sentence.units } : {}),
        ...(sentence.playback ? { playback: sentence.playback } : {}),
```

- [ ] **Step 2: Typecheck**

Run: `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json`
Expected: clean (`sentence` is `LibraryPackSentence` with the Task-1 fields; targets are `profileSentences.units`/`playback`).

- [ ] **Step 3: Commit**

```bash
git add convex/lib/contentModuleInstall.ts
git commit -m "feat(install): set units + playback when seeding composed sentences"
```

---

### Task 4: Capture block text — helper + wire into the units-write paths

**Files:**
- Create: `convex/lib/compositionText.ts`
- Modify: `convex/profileSentences.ts` (`createProfileSentence` ~L153, `createSentenceVariant` ~L211, `updateProfileSentenceUnits` ~L278)

**Interfaces:**
- Produces: `deriveCompositionText(units, lang): string`. Every path that writes `units` also writes `text = deriveCompositionText(units, authoredLanguage)` (a plain string, in the row's language — consistent with the fluent string-`text` convention; the reader normalises string → `{authoredLang: text}`).

- [ ] **Step 1: Create the helper**

Create `convex/lib/compositionText.ts`:

```ts
/**
 * Derive a composed sentence's whole-utterance caption from its units, mirroring
 * the client's `blocksFromUnits(...)` + join (SentencesModeContent.tsx:576-580):
 * each unit in order → phrase's `name` or word's `label`, resolved for `lang`
 * (3-tier fallback), joined by a space. Pure — used server-side to keep the
 * `text` column in sync with `units` so block sentences carry a localised string
 * (display/search + module round-trip). Empty-resolving units are skipped.
 */
import { displayString } from "../../lib/languages/displayValue";
import { DEFAULT_LOCALE } from "../../lib/languages/registry";

type TextUnit = {
  kind: "word" | "phrase";
  order: number;
  name?: Record<string, string>;
  label?: Record<string, string>;
};

export function deriveCompositionText(
  units: readonly TextUnit[],
  lang: string,
): string {
  return [...units]
    .sort((a, b) => a.order - b.order)
    .map((u) =>
      u.kind === "phrase"
        ? displayString(u.name, lang, DEFAULT_LOCALE)
        : displayString(u.label, lang, DEFAULT_LOCALE),
    )
    .filter((s) => s !== "")
    .join(" ");
}
```

- [ ] **Step 2: Import it in `profileSentences.ts`**

Add near the top of `convex/profileSentences.ts`:

```ts
import { deriveCompositionText } from "./lib/compositionText";
```

- [ ] **Step 3: Capture on `createProfileSentence`**

In `createProfileSentence`'s `ctx.db.insert("profileSentences", { … })`, replace the existing `...(args.units ? { units: args.units } : {}),` line with (derive `text` from units in the create's `authoredLanguage`, defaulting to `en`):

```ts
      ...(args.units
        ? {
            units: args.units,
            text: deriveCompositionText(args.units, args.authoredLanguage ?? "en"),
          }
        : {}),
```

- [ ] **Step 4: Capture on `updateProfileSentenceUnits`**

In `updateProfileSentenceUnits`'s `ctx.db.patch(args.profileSentenceId, { … })`, add a `text` line alongside `units`/`slots` (derive in the row's own `authoredLanguage`):

```ts
    await ctx.db.patch(args.profileSentenceId, {
      units:     args.units,
      slots:     flattenUnitsToSlots(args.units),
      text:      deriveCompositionText(args.units, sentence.authoredLanguage ?? "en"),
      updatedAt: Date.now(),
    });
```

- [ ] **Step 5: Capture on `createSentenceVariant`**

`createSentenceVariant` seeds the fork from `source.units` and currently seeds `text` from the source text record. When the source has `units`, prefer a derived caption in the NEW variant's language. In its `ctx.db.insert("profileSentences", { … })`, change the text/units handling so that, when `source.units` exists, `text` is `deriveCompositionText(source.units, args.authoredLanguage)`:

```ts
      ...(source.units
        ? {
            units: source.units,
            text: deriveCompositionText(source.units, args.authoredLanguage),
          }
        : text
          ? { text }
          : {}),
```

(Keep the existing `text` computation above for the no-units/fluent case; this only overrides when units are present.)

- [ ] **Step 6: Typecheck**

Run: `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json`
Expected: clean. If `args.units`/`source.units`'s generated type isn't structurally assignable to `TextUnit`, widen `TextUnit` minimally (it only reads `kind`/`order`/`name`/`label`).

- [ ] **Step 7: Commit**

```bash
git add convex/lib/compositionText.ts convex/profileSentences.ts
git commit -m "feat(sentences): capture block-sentence caption into text on units write"
```

---

### Task 5: Runtime acceptance — block sentence round-trip

No unit-test harness; this is the acceptance protocol (deploy, then verify). Steps marked **(user)** need the app UI / a signup.

**Files:** none.

- [ ] **Step 1: Deploy** — cherry-pick Tasks 1-4 to `main`; confirm `convex dev` push is green.
- [ ] **Step 2: (user)** In admin, confirm/author a **block** sentence (`playback: "sequence"`) with a **hi** variant (re-arranged units). Verify in the dashboard the row's `text` is now the derived Hindi caption (no longer `NO-TEXT`).
- [ ] **Step 3: (user)** Publish (Update) that sentence's module group.
- [ ] **Step 4:** Export + assert: `node scripts/export-library-modules.mjs`; the sentence JSON item carries `units`, `playback`, and `text`.
- [ ] **Step 5: (user)** Wipe `libraryModules` → restore (`seedLibraryModulesFromJSON`) → fresh signup.
- [ ] **Step 6:** Assert seeded rows: the block sentence has `units` + `playback: "sequence"`; on a **hi** board it collapses to the hi variant, **plays stepped** through the Hindi units, and shows the Hindi caption. A fluent sentence is unaffected.

---

### Task 6: Document the decision (ADR-015 addendum)

**Files:**
- Modify: `docs/4-builds/decisions/ADR-015-composition-primitive-and-phrase-tree.md`

- [ ] **Step 1: Append an addendum**

Append an addendum "Composition carried through the module seed round-trip", stating: sentence module items now carry `units` + `playback` (reusing the `compositionUnit` validator); publish emits and install sets them; the block caption is derived from units into `text` at authoring save via `deriveCompositionText` (mirrors `blocksFromUnits`); export/restore are passthroughs; builds on MOS-27 (metadata carry). Additive/optional — no migration. Note it on ADR-016 too (composed-content variants now fully seed).

- [ ] **Step 2: Commit**

```bash
git add docs/4-builds/decisions/ADR-015-composition-primitive-and-phrase-tree.md
git commit -m "docs(adr): ADR-015 addendum — composition carried through module seed round-trip"
```

---

## Notes for the tracker
- Second prerequisite to **Phase 4** (MOS-13), alongside MOS-27. Together they make block **and** fluent sentence defaults seed correctly.
- Deploys via `main` cherry-pick (schema widen is additive → safe push).
