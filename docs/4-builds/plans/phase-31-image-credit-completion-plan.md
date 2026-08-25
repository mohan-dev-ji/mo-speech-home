# Phase 31 — Image Credit Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Standalone.** Written 2026-08-25 for a fresh session. Everything needed to start is in this file — no prior conversation required.

**Status:** not started
**Tickets:** MOS-34 (In Progress — closes when Task 7 passes) · MOS-35 · MOS-36 · MOS-38
**Follows:** Phase 30 (`docs/4-builds/plans/_done/phase-30-custom-imagery-scaffolding.md`), shipped 2026-08-25
**Blocks:** the live publish/install stress test, and therefore the return to phase-29

**Goal:** Finish the image-credit chain so that every image a user can pick from Image Search keeps its attribution from authoring through publish, install and display — and give instructors one place to read those credits.

**Architecture:** Phase 30 carried credit through list items, sentence slots and phrase words. Three authoring surfaces still discard it (folder covers, category covers, the talker bar), the shape is declared in six places so a fourth gap is likely, and nothing displays credit anywhere outside the symbol editor. This phase consolidates the shape to one declaration, extends it with the image title, closes the three remaining capture gaps, and adds a read-only credits view on the module's own page plus an account-level list in Settings.

**Tech Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Convex 1.x · next-intl v4 · Cloudflare R2

---

## Why this phase exists

### The obligation, in plain terms

An instructor building a "Musical Instruments" category finds no SymbolStix symbol they like for *guitar*, so they use Image Search and pick a photo from Wikimedia Commons.

That photo is Creative Commons. The licence is a deal: **use it freely, provided you name the photographer and state the licence.** The app fetches all three — photo, photographer, licence.

Where the fields exist we now store all three. Where they don't, we store the photo and discard the other two on save. The app then redistributes someone's work under a licence whose one condition it can no longer meet, because it no longer knows who made it.

Three properties make this worse than it sounds:

1. **Nothing looks broken.** The image renders, the tile works, no error fires.
2. **It multiplies.** Publish the module, forty families install it, and that is forty unattributed copies from a single save.
3. **It is unrecoverable.** No script can repair it later. The photographer's name was never written down. The only remedy is re-authoring every affected item by hand.

Property 3 is why this phase runs **before** the live authoring/publish stress test rather than after it. Content authored during that test becomes real content; authoring it against the current code bakes in permanent gaps.

### Scope note on which licences actually compel this

Of the four providers, **only Wikimedia's CC licences legally require attribution.** Unsplash, Pixabay and Pexels are attribution-optional. The hard compliance surface is narrower than it looks.

We still capture and display all four. A credits list with arbitrary gaps is harder to trust and harder to maintain than one that lists everything, and crediting photographers who did not demand it is the right default for this product.

---

## Global Constraints

Copied from Phase 30 and still binding. Every task's requirements implicitly include this section.

- **Work on `main`.** No branch, no worktree — project standing convention.
- **The dev server is owner-run on port 3000.** Never `npm run dev`. It does **not** always hot-reload route handlers: if you measure anything against it, first change something trivially observable (e.g. a status code) and confirm it actually changes, or you may be measuring a stale compile.
- **Never `npx convex dev`** — it creates an anonymous local backend and rewrites `.env.local`. Use `--no-push` on every `npx convex run`, and read-only functions only.
- Node 20.17.0 (Convex CLI requirement). If a command complains, prefix with `source ~/.nvm/nvm.sh && nvm use 20.17.0`.
- **No test framework exists and none may be added** (settled in phase-17). "Test" means a runnable command with a stated expected output. Do not write a test file; do not add a test runner. A missing test file is not a defect here — an unrun verification command is.
- **Verification baseline — compare against these, never against zero:**
  - `npx tsc -p convex/tsconfig.json --noEmit` → clean, exit 0. Any error is yours.
  - `npx tsc --noEmit` → **4** pre-existing unrelated errors (3 stale `.next/types/validator.ts` refs, 1 Stripe `apiVersion` in `lib/stripe.ts:8`).
  - `npm run lint` → exactly `✖ 66 problems (36 errors, 30 warnings)`, all pre-existing. Do not fix them; do not add to them.
- **Never hard-code UI copy.** New keys go in `messages/en.json` **only** — never `hi.json`/`es.json`/etc. `i18n/request.ts` merges each locale over `en.json` so missing keys fall back to English, and the translation pipeline only translates keys **absent** from a locale. A hand-added placeholder is treated as already-translated and ships forever.
- **Never hard-code colours, spacing, radii or font sizes.** Tailwind 4, no `tailwind.config.ts`. All `--theme-*` vars are declared in `:root` in `app/globals.css` and mapped via the `@theme inline` block in that same file. Use `bg-theme-*`, `text-theme-*`, `rounded-theme` / `rounded-theme-card`, `p-theme-*`, `gap-theme-*`. `ThemeContext` overwrites these at runtime per student profile — a hard-coded value breaks theme switching.
- **Components live in `app/components/{app|marketing|admin}/{sections|ui|modals}/`.** `page.tsx` files stay thin.
- **Convex schema changes must be additive and `v.optional(...)`** so existing rows stay valid. A required field breaks every row already written.
- `isPersonalAssetKey` (delete-path) and `isPromotableAssetKey` (publish-path) must **stay separate** — see the doc comment at `convex/lib/contentModuleDelete.ts:41-77`. Do not merge, widen or "simplify" either.
- Take `npx convex export --path backups/<date>-<label>.zip` before anything destructive. Nothing in this plan should be destructive.

---

## The rule that matters most in this plan

**Sweep; do not trust the file lists below.**

Phase 30's §1 shipped a Critical bug precisely because its scope table enumerated four sites and there were more. Two of the four listed were not even live, and the two that were each had a second unguarded push directly underneath that nobody had written down.

Every task below names the sites I found. **Treat that as a starting point, not an inventory.** Each task ends with a sweep step, and finding a site the plan missed is a success, not a deviation — report it.

The recurring defect shape to hunt for is a **write path that rebuilds a row from an explicit field list**. It compiles, it looks tidy, and it silently drops every field the author did not think to name. Phase 30 had to fix two of these after review (`handleReorderSlots`, whole-list translate). Prefer `{ ...source, order: i }` to a hand-written literal wherever the destination validator allows it.

---

## File Structure

New files:

| File | Responsibility |
|---|---|
| `convex/lib/imageProvenance.ts` | The single declaration of the provenance field set — Convex validator shape + TS type. Imported by every table and mutation that carries credit. |
| `convex/imageCredits.ts` | Read-only queries returning credit lists: one per module source, one per account. |
| `app/components/app/shared/ui/CreditList.tsx` | Presentational list of credit rows. No data fetching. Shared by the modal and the settings panel. |
| `app/components/app/shared/modals/ImageCreditsModal.tsx` | Dialog wrapper around `CreditList` for the module's own page. |
| `app/components/app/settings/sections/CreditsPanel.tsx` | Settings tab panel — account-wide credits, reuses `CreditList`. |

Modified (non-exhaustive — sweep):

| File | Change |
|---|---|
| `convex/schema.ts` | Import the shared shape; add cover-image provenance to `profileFolders` + `profileCategories` + the `libraryModules` cover shape; add `imageTitle`. |
| `convex/profileLists.ts` · `convex/profileSentences.ts` · `convex/profilePhrases.ts` | Delete the three local `imageProvenanceSchema` copies; import the shared one. |
| `convex/data/_shared/types.ts` | `ImageProvenance` re-exports or mirrors the shared type; add `imageTitle`. |
| `convex/contentModules/publish.ts` | Carry cover provenance at the four `coverImagePath` sites; carry `imageTitle` everywhere credit already flows. |
| `convex/lib/contentModuleInstall.ts` | `installCredit` reads the shared type; materialise cover provenance. |
| `app/components/app/shared/modals/symbol-editor/types.ts` | Add `imageTitle` to the draft. |
| `app/components/app/shared/modals/symbol-editor/ImagesTab.tsx` | Populate `imageTitle` from `result.title`. |
| `app/components/app/shared/modals/symbol-editor/SymbolEditorModal.tsx` | `creditFor()` carries `imageTitle`. |
| `app/components/app/shared/sections/GroupsView.tsx` · `app/components/app/categories/sections/CategoriesContent.tsx` | Cover handlers stop discarding credit. |
| `app/contexts/TalkerContext.tsx` · `app/components/app/shared/ui/TalkerBar.tsx` | `TalkerSymbolItem` carries provenance (declared twice — collapse if practical). |
| `app/components/app/shared/sections/PersistentTalker.tsx` | Carry provenance into `units[]` and `slots[]`. |
| `app/components/app/shared/ui/PageBanner.tsx` (consumers) | Credits button in the banner action slot. |
| `app/components/app/settings/sections/SettingsContent.tsx` | New `credits` tab id + panel case. |
| `messages/en.json` | All new copy. **en.json only.** |

---

## Task 1: Consolidate the provenance shape and add `imageTitle`

**Why first:** the shape is currently declared in six places. Every later task extends it. Consolidating first turns "add a field in six places and hope" into a one-line edit, and adding `imageTitle` immediately afterwards proves the consolidation actually works.

**Files:**
- Create: `convex/lib/imageProvenance.ts`
- Modify: `convex/schema.ts:162` (`imageProvenanceFields`), `convex/data/_shared/types.ts:41` (`ImageProvenance`), `convex/profileLists.ts:18`, `convex/profileSentences.ts:13`, `convex/profilePhrases.ts:21`, `convex/lib/contentModuleInstall.ts:122` (`installCredit`'s inline shape)
- Modify: `app/components/app/shared/modals/symbol-editor/types.ts:24-26`, `ImagesTab.tsx:165`, `SymbolEditorModal.tsx:648` (`creditFor`)

**Interfaces produced** (later tasks depend on these exact names):

```ts
// convex/lib/imageProvenance.ts
export const imageProvenanceFields = {
  imageSourceType: v.optional(v.union(
    v.literal("symbolstix"), v.literal("upload"),
    v.literal("imageSearch"), v.literal("aiGenerated"),
  )),
  imageSourceUrl: v.optional(v.string()),
  imageTitle:     v.optional(v.string()),
  attribution:    v.optional(v.string()),
  license:        v.optional(v.string()),
};

export type ImageProvenance = {
  imageSourceType?: "symbolstix" | "upload" | "imageSearch" | "aiGenerated";
  imageSourceUrl?: string;
  imageTitle?: string;
  attribution?: string;
  license?: string;
};
```

**The current six declarations** (verified 2026-08-25 — sweep for more):

| Declaration | Location |
|---|---|
| `imageProvenanceFields` (validator) | `convex/schema.ts:162` |
| `ImageProvenance` (TS type) | `convex/data/_shared/types.ts:41` |
| `imageProvenanceSchema` copy 1 | `convex/profileLists.ts:18` |
| `imageProvenanceSchema` copy 2 | `convex/profileSentences.ts:13` |
| `imageProvenanceSchema` copy 3 | `convex/profilePhrases.ts:21` |
| inline shape in `installCredit` | `convex/lib/contentModuleInstall.ts:122` |

The three `imageProvenanceSchema` copies are byte-identical and each carries a comment saying it mirrors `imageProvenanceFields`.

**Judgement calls, decided here so the implementer does not have to:**
- `convex/schema.ts` should **import** from `convex/lib/imageProvenance.ts`, not be the source. Watch for a circular import and report immediately if one appears.
- `installCredit`'s inline shape is a *reader* of the shape, not a declaration of it. Retype its parameter as `ImageProvenance` rather than leaving a hand-written duplicate.
- **Leave `displayPropsSchema` alone.** It has the same duplication and the same risk, but bundling it doubles the blast radius of this task for no benefit to the phase's goal. Note it for a follow-up ticket instead.

**`imageTitle` — where the data comes from:** `ImageSearchResult.title` already exists on every provider (`lib/image-providers/types.ts:7`) and is populated by all four — `wikimedia.ts:168` (`p.title`), `unsplash.ts:82`, `pixabay.ts:76`, `pexels.ts:80`. It is captured at search time and currently dropped at save. `ImagesTab.tsx:165` is where the other credit fields are copied onto the draft; `imageTitle` joins them there.

- [ ] **Step 1: Create the shared module**

Create `convex/lib/imageProvenance.ts` with the exact `imageProvenanceFields` and `ImageProvenance` shown above, plus a doc comment stating: this is the single declaration; adding a field here requires carrying it through save → publish → export → restore → install, and the sweep command in Step 5 finds the carry sites.

- [ ] **Step 2: Point all six declarations at it**

Replace each of the six with an import. `convex/data/_shared/types.ts` re-exports the type so existing `& ImageProvenance` intersections keep working unchanged.

- [ ] **Step 3: Verify the consolidation changed nothing**

```bash
npx tsc -p convex/tsconfig.json --noEmit
```
Expected: clean, exit 0. Because the six declarations were identical, a type error here means one of them was **not** identical — investigate and report rather than forcing it.

- [ ] **Step 4: Add `imageTitle` and carry it**

Add to the shared shape, then to the draft (`symbol-editor/types.ts`), populate at `ImagesTab.tsx:165`, carry in `creditFor()` (`SymbolEditorModal.tsx:648`), and through publish/install wherever the other four already flow.

- [ ] **Step 5: Sweep for carry sites the above missed**

```bash
grep -rn "attribution" app convex --include="*.ts" --include="*.tsx" | grep -v "_generated"
```
Every site that names `attribution` must also name `imageTitle`, or must be a spread. List in your report each site found, and for each: spread (fine) or explicit list (must include the new field).

- [ ] **Step 6: Verify and commit**

```bash
npx tsc -p convex/tsconfig.json --noEmit   # clean, exit 0
npx tsc --noEmit                            # exactly 4 pre-existing errors
npm run lint                                # exactly 66 problems (36 errors, 30 warnings)
```

```bash
git add -A && git commit -m "refactor(provenance): one declaration of the image-credit shape; add imageTitle"
```

---

## Task 2: Cover images carry credit (MOS-35)

**Files:**
- Modify: `convex/schema.ts` — `profileFolders` (`:881`, cover is `imagePath` at `:893`), `profileCategories`, and the `libraryModules` cover shape (`:1039`, `:1156`)
- Modify: `app/components/app/shared/sections/GroupsView.tsx:338`, `app/components/app/categories/sections/CategoriesContent.tsx:398`
- Modify: `convex/contentModules/publish.ts:367`, `:388`, `:587`, `:609`
- Modify: `convex/lib/contentModuleInstall.ts`
- Check: `convex/contentModules/exportModules.ts`, `convex/migrations.ts:527`

**Interfaces consumed:** `imageProvenanceFields` / `ImageProvenance` from `convex/lib/imageProvenance.ts` (Task 1).

**The gap.** The symbol editor's `imageOnly` mode offers all four image tabs unconditionally, Image Search included (`SymbolEditorModal.tsx:982`). So a folder or category cover can be a CC BY-SA photo. Both cover handlers then take only the path:

```tsx
onImageOnlySave={(r) => { if (r.imagePath) handleFolderImageSave(r.imagePath); }}
```

Phase 30 made the editor carry `imageAttribution` / `imageLicense` / `imageSourceUrl` into `r`, so the values genuinely arrive and are then dropped. `profileFolders.imagePath` and `profileCategories.imagePath` have no provenance fields to receive them anyway.

**Covers do publish and install.** `folderKeys` (`convex/lib/personalAssetRefs.ts:77`) and `categoryKeys` (`:71`) both push `imagePath`, so the cover **file** already promotes correctly to `library_modules/<tree>/<slug>/images/<filename>`. Only its credit is lost. This task changes no R2 behaviour — do not touch the promotion path.

**Live state:** 36 committed module artifacts carry a `coverImagePath`; exactly one is non-SymbolStix (`categories/space.json` → a legacy `library_packs/space/images/…jpg`). Its provenance is unknown and unrecoverable; do not attempt to backfill it.

- [ ] **Step 1: Schema**

Spread `imageProvenanceFields` onto `profileFolders` and `profileCategories` beside `imagePath`, and onto the `libraryModules` cover shape. All optional.

- [ ] **Step 2: The two handlers**

Widen `handleFolderImageSave` (and the category equivalent) to accept the credit, and pass the whole result through rather than destructuring `imagePath` alone. Match the clearing semantics `creditFor()` already uses in `SymbolEditorModal.tsx:648` — swapping the image clears stale credit; re-saving an untouched image preserves it.

- [ ] **Step 3: Publish**

Carry the fields beside `coverImagePath` at all four sites in `publish.ts`.

- [ ] **Step 4: Export / restore / install**

Check whether the cover round-trips wholesale the way `items` does (`exportModules.ts:58` emits `items: m.items`; `migrations.ts:527` reads `items: mod.items`) or needs explicit carrying. State which in your report, with the line you checked.

- [ ] **Step 5: Sweep**

Find every write to `profileFolders` / `profileCategories` that touches `imagePath`, and confirm none rebuilds the row from an explicit field list that omits the new fields:

```bash
grep -rn "imagePath" app convex --include="*.ts" --include="*.tsx" | grep -v "_generated" | grep -iE "folder|categor|cover"
```

- [ ] **Step 6: Verify and commit**

Run the three baseline commands. Then trace and report the full chain for a cover image: save site → profile row → publish → export → restore → install, with file:line for each hop.

```bash
git add -A && git commit -m "feat(attribution): carry image credit on folder and category covers (MOS-35)"
```

---

## Task 3: Talker bar carries credit (MOS-36)

**Files:**
- Modify: `app/contexts/TalkerContext.tsx:24` (`TalkerSymbolItem`), `:44` + `:74` (`addToTalker`)
- Modify: `app/components/app/shared/ui/TalkerBar.tsx:40` — a **second** declaration of `TalkerSymbolItem`
- Modify: `app/components/app/shared/sections/PersistentTalker.tsx:160` (`units[]`), `:188` (`slots[]`), `:206` (`createProfileSentence`), `:231` (an `addToTalker` call)
- Modify: `app/components/app/search/sections/SearchContent.tsx:177`, `app/components/app/categories/sections/CategoryDetailContent.tsx:505` — the other `addToTalker` call sites

**Interfaces consumed:** `ImageProvenance` from `convex/lib/imageProvenance.ts` (Task 1).

**The gap.** `TalkerSymbolItem` carries only `symbolId`, `label`, `imagePath`, `audioPath`. So tapping a category symbol whose image came from Image Search into the talker bar and saving it as a sentence produces a sentence with the photo and no attribution.

This is **not** the strip-site defect class — the credit never arrives. It is missing plumbing.

`PersistentTalker` builds:

```ts
const slots: { order: number; imagePath?: string }[] = [];
```

**The receiving end already works.** `createProfileSentence`'s validator and the `profileSentences` schema both carry the fields after Phase 30 — nothing backend-side needs changing. Confirm this rather than assuming it, and say so in your report.

- [ ] **Step 1: Widen both `TalkerSymbolItem` declarations**

Add the provenance fields to `app/contexts/TalkerContext.tsx:24` and `app/components/app/shared/ui/TalkerBar.tsx:40`. If one can import from the other without a cycle, collapse them and say so; if not, leave both and note it.

- [ ] **Step 2: Thread through `addToTalker` and its three call sites**

Each call site reads the credit from the source symbol it is adding. `CategoryDetailContent.tsx:505` has a `profileSymbols` row (credit lives on `imageSource`); `SearchContent.tsx:177` and `PersistentTalker.tsx:231` — check what each has in hand and report if a site cannot reach the credit.

- [ ] **Step 3: Carry into `units[]` and `slots[]`**

Widen the local slot type and carry the fields at `PersistentTalker.tsx:160` and `:188`.

- [ ] **Step 4: Sweep**

```bash
grep -rn "addToTalker\|TalkerSymbolItem" app --include="*.tsx" | grep -v "_generated"
```
Confirm you found every call site. Report the count.

- [ ] **Step 5: Verify and commit**

Run the three baseline commands.

```bash
git add -A && git commit -m "feat(attribution): carry image credit through the talker bar (MOS-36)"
```

---

## Task 4: Credits query

**Files:**
- Create: `convex/imageCredits.ts`

**Interfaces produced** (Tasks 5 and 6 consume these exact names):

```ts
export type CreditRow = {
  unitName: string;        // the tile/item/slot label this image belongs to
  imageTitle?: string;
  attribution?: string;
  license?: string;
  imageSourceUrl?: string;
  imageSourceType: "upload" | "imageSearch" | "aiGenerated";
};

// Credits for one module source. `tree` + `sourceId` match
// `collectSourcePromotableKeys` (convex/lib/personalAssetRefs.ts:259).
export const getModuleImageCredits = query({
  args: {
    tree: v.union(v.literal("categories"), v.literal("lists"),
                  v.literal("sentences"), v.literal("phrases")),
    sourceId: v.string(),
  },
  handler: async (ctx, args): Promise<CreditRow[]> => { /* ... */ },
});

// Every credited image across the caller's account.
export const getAccountImageCredits = query({
  args: {},
  handler: async (ctx): Promise<CreditRow[]> => { /* ... */ },
});
```

**Rules:**
- **Read-only.** Queries, never mutations. No writes of any kind.
- **Auth-checked**, following the pattern `resolveCallerAccountId` establishes in `convex/profileSymbols.ts`. An account may only read its own credits.
- **Exclude `symbolstix`.** SymbolStix is licensed to us wholesale and is not credited per-image. Rows whose `imageSourceType` is `symbolstix` or absent are omitted — that exclusion is what makes "does this module have credits?" answerable in Task 5.
- **Include `upload` and `aiGenerated`**, even though neither carries a third-party obligation. An instructor asking "where did these images come from?" is served by a complete answer, and the type field distinguishes them.
- **Walk the same shapes `collectSourcePromotableKeys` walks** (`convex/lib/personalAssetRefs.ts:259`) — category symbols, list items, sentence slots and units, phrase words, plus the folder/category cover from Task 2. That function is the closest thing to a canonical traversal of a module's assets; mirror its structure so the two cannot drift.
- **`unitName`** is the localised label already on the row. Return it resolved for the caller's language; follow `displayString` usage in `CategoryDetailContent.tsx:612`.
- **Never key the returned object by user text.** Return an **array**. Convex cannot serialise objects keyed by localised strings (Hindi crashes it) — return a list and let the client group.
- **De-duplicate** by `imageSourceUrl` where present. The same photo used on three tiles is one credit, and its `unitName` should list all three (comma-joined at the client, not here).

- [ ] **Step 1: Write the queries**

- [ ] **Step 2: Exercise them read-only**

```bash
npx convex run imageCredits:getAccountImageCredits '{}' --no-push
```
Expected: an array. Today it will be empty or near-empty — zero custom imagery has gone through lists/sentences/phrases. Paste the actual output. An empty array is a valid result here, not a failure; say so plainly rather than treating it as a bug.

- [ ] **Step 3: Verify and commit**

Run the three baseline commands.

```bash
git add -A && git commit -m "feat(credits): read-only image-credit queries per module and per account"
```

---

## Task 5: Credits button and modal on the module's own page

**Files:**
- Create: `app/components/app/shared/ui/CreditList.tsx`
- Create: `app/components/app/shared/modals/ImageCreditsModal.tsx`
- Modify: the `PageBanner` consumers that render a module's own page — `app/components/app/categories/sections/CategoryDetailContent.tsx`, `app/components/app/lists/sections/ListDetailContent.tsx`, `app/components/app/sentences/sections/SentencesModeContent.tsx` (sweep — `PageBanner` has more consumers than this)
- Modify: `messages/en.json`

**Interfaces consumed:** `getModuleImageCredits`, `CreditRow` (Task 4).

**Placement decision (owner, 2026-08-25):** the module's **own view**, not the resource-library entry. That is where an instructor is standing when they wonder about an image.

**`PageBanner` is the insertion point.** `app/components/app/shared/ui/PageBanner.tsx` takes `children` as its action slot and already hides children in student-view unless `student_can_edit` or `student_can_filter` is granted (`:32-36`). That gating is exactly right — credits are an instructor concern and must not add visual noise to a student's board.

**Visibility rule:** the button renders only when `getModuleImageCredits` returns a non-empty array. No empty modal, no button on an all-SymbolStix module.

**`CreditList` is presentational only** — props in, markup out, no `useQuery`. Both this modal and Task 6's settings panel render it.

**Row format:**

> **guitar** — *Classical Guitar, two views* — Georges Jansoone — CC BY-SA 4.0

Each row links to `imageSourceUrl` where present (`target="_blank"`, `rel="noopener noreferrer"`). Missing fields collapse gracefully — an `upload` row has no title, artist or URL and should render as the unit name plus a "your own upload" label rather than a row of dashes.

**Copy:** all strings via `useTranslations`, keys added to `messages/en.json` **only**. Needed at minimum: button label, modal title, a one-line explanation of what the list is, the `upload` / `aiGenerated` source labels, and an empty-state string (used by Task 6, which unlike this task can legitimately be empty).

**Theme tokens only.** No raw colour, spacing, radius or font-size classes. Check every class string you write against `app/globals.css`.

- [ ] **Step 1: `CreditList`**

- [ ] **Step 2: `ImageCreditsModal`** — follow an existing dialog in `app/components/app/shared/modals/` for shell, focus handling and close behaviour rather than inventing one.

- [ ] **Step 3: Wire the button into the banner action slot on each module page**

- [ ] **Step 4: Sweep for `PageBanner` consumers**

```bash
grep -rln "PageBanner" app --include="*.tsx"
```
For each, state in your report whether it is a module's own page (gets the button) or not (does not), and why.

- [ ] **Step 5: Confirm no copy is hard-coded and no locale but `en` was touched**

```bash
git diff --name-only | grep messages/
```
Expected: `messages/en.json` and nothing else.

- [ ] **Step 6: Verify and commit**

Run the three baseline commands.

```bash
git add -A && git commit -m "feat(credits): image-credits button and modal on the module page"
```

---

## Task 6: Account-level credits in Settings

**Files:**
- Create: `app/components/app/settings/sections/CreditsPanel.tsx`
- Modify: `app/components/app/settings/sections/SettingsContent.tsx` — `OWNER_SETTINGS_IDS`, `COLLABORATOR_SETTINGS_IDS`, and the `renderPanel` switch (`:56-62`)
- Modify: `messages/en.json`

**Interfaces consumed:** `getAccountImageCredits`, `CreditRow` (Task 4); `CreditList` (Task 5).

**Placement decision (owner, 2026-08-25):** a **new `credits` tab**, not inside Data & Privacy. That section is about the instructor's own data; third-party attribution is a different thing, and filing it there makes it both harder to find and confusing to anyone reading it for privacy reasons.

**This panel always exists**, including when the list is empty — it renders the empty state from Task 5's copy. A permanent, predictable location is what makes the credits discoverable, and discoverability is the entire basis on which a separate credits screen satisfies the attribution condition instead of on-image credit. **Do not hide it, and do not gate its existence on having content.** This differs deliberately from Task 5's conditional button, where an empty modal would just be bad UX.

The existing tabs are `instructor`, `profile`, `plan`, `invites`, `privacy` (`SettingsContent.tsx:56-62`). Collaborators should see this tab too — they author content and take on the same obligation.

- [ ] **Step 1: `CreditsPanel`** — fetch with `getAccountImageCredits`, render `CreditList`, handle loading and empty states.

- [ ] **Step 2: Register the tab** in both id lists and the `renderPanel` switch. Deep-linking is automatic — the `?tab=<id>` handler at `:38-49` reads from `settingsIds`.

- [ ] **Step 3: Confirm the tab label came from `en.json` only**

- [ ] **Step 4: Verify and commit**

Run the three baseline commands.

```bash
git add -A && git commit -m "feat(credits): account-wide image credits tab in settings"
```

---

## Task 7: Owner acceptance — the live authoring and publish test

**This task is owner-driven. A subagent cannot drive the authed app and must not try.** The implementer's job is to produce the script; the owner executes it.

This is simultaneously:
- MOS-34's stated Verification, outstanding since Phase 30
- Phase 29's Task 7 Step 9 (the ADR-022 promotion acceptance test)
- The stress test the owner asked for on 2026-08-25

**Files:**
- Create: `.superpowers/sdd/phase-31-acceptance.md`

Write a click-by-click script covering, with the exact value to look for at each hop:

1. Author a **category** with mixed SymbolStix and Image Search tiles, plus an Image Search **cover image**.
2. Author a **list** and a **sentence** the same way, each in a folder with its own cover.
3. Confirm the rows landed: `profileCategories` / `profileSymbols`, `profileLists`, `profileSentences`, `profileFolders` — and that each carries `attribution`, `license`, `imageTitle`, `imageSourceUrl`.
4. Open each module's page and confirm the **credits button appears** and lists the right images against the right unit names.
5. Confirm the **Settings → Credits** tab lists the same images.
6. **Publish** each from the admin account.
7. Confirm R2 keys land under **`library_modules/<tree>/<slug>/images/…`** and `…/audio/…`, cover included. The key format is built at `app/api/admin/promote-module-assets/route.ts:108`; `<kind>` is `audio` when the old key contained `/audio/`, else `images` (`:39`).
8. Confirm rows exist in the **`libraryModules`** table and the modules appear in the resource library.
9. **Install** on the test account.
10. Confirm the credits survived the install — the installed copy's credits button shows the same attribution.
11. Sanity-check the delete guard: uninstall one module and confirm the **shared `library_modules/` objects still exist** in R2. This is Phase 30 §1's fix under live conditions and is the single highest-consequence check in the list.

Include a teardown section: which test folders and R2 prefixes to remove afterwards, and which to leave.

- [ ] **Step 1: Write the script**
- [ ] **Step 2: Hand it to the owner and stop.** Do not execute steps 1–11.

---

## Self-review against the spec

- **MOS-35** → Task 2. **MOS-36** → Task 3. **MOS-38** → Task 1. **MOS-34 verification** → Task 7.
- `imageTitle` (owner decision 2026-08-25) → Task 1, consumed by Tasks 4–6.
- Credits on the module's own view (owner decision) → Task 5. Account-level backstop → Task 6.
- Credit stays **off the tiles** → satisfied: nothing in this plan renders credit on a board tile; `PageBanner`'s existing student-view gating keeps the button out of a student's way.
- Type consistency: `imageProvenanceFields` / `ImageProvenance` (Task 1) are consumed by name in Tasks 2, 3, 4; `CreditRow`, `getModuleImageCredits`, `getAccountImageCredits` (Task 4) by name in Tasks 5, 6; `CreditList` (Task 5) in Task 6.
- Known gap **not** in scope: `displayPropsSchema` has the same duplication as the provenance shape (Task 1 notes it for a follow-up ticket rather than bundling it).
- Known gap **not** in scope: MOS-37 (`translate-modules` skips custom-image symbol labels). It does not touch this test and does not affect credit.

## When this phase is done

Close **MOS-35**, **MOS-36**, **MOS-38**, and — only once Task 7 has actually been run and passed — **MOS-34**.

Then return to **phase-29** (`docs/4-builds/plans/phase-29-module-artifact-restore-and-dr-test.md`), paused mid-Task-8 with Tasks 1–7 complete. Task 7 Step 9 there is discharged by this plan's Task 7.

After that, the `library_packs/` retirement: backfill `space`, re-publish it onto `library_modules/`, verify it renders, **reinstall it so the installed copy repoints too**, and only then delete the folder.
