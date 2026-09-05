# Phase 36 — My Images Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every image the account has ever generated or uploaded lives in a browsable library inside the symbol editor, and is destroyed only when the user says so.

**Architecture:** Every AI generation is written to R2 and indexed by a new Convex table. A fifth symbol-editor tab renders that index as a grid. The single biggest change is not the grid — it is inverting the delete model: removing a symbol, list item or sentence slot stops deleting the image, and the gallery's own Delete button becomes the only path that removes an image object from R2.

**Tech Stack:** Convex 1.x · Next.js 16 route handler · Cloudflare R2 · next-intl v4 · Tailwind CSS 4

## Context a fresh session will not have

This plan was written after a long design conversation. Everything it needs is here, but the *reasoning* behind the decisions — and the four designs that were tried and rejected on the way — lives in **MOS-52**, and it is worth reading before changing anything the plan specifies. In particular the ticket records why the gallery is a symbol-editor tab rather than a Settings page, why there is no "Generate again" button, why actions sit outside the grid, and why a storage fee was rejected.

Two numbers this plan quotes as of 2026-09-04, which will drift: the owner's account held **99** objects under `accounts/<id>/images/` (25.3 MB), and lint sits at **65 problems**. Re-measure rather than trusting them.

## Global Constraints

- **All UI copy via `useTranslations`; new keys in `messages/en.json` ONLY.** Never hand-add to another locale — the pipeline only translates keys *absent* from a locale, so a hand-added placeholder ships forever.
- **Theme tokens only** — no hard-coded colours, spacing, radii or font sizes. `--theme-*` vars are rewritten at runtime per student profile.
- **No test framework exists** and the plan forbids adding one. Verification is `npx tsc --noEmit` (baseline **0 errors**), `npm run lint` (baseline **65 problems**), `npm run build` (exits 0), and driving the real app.
- **Work on `main`.** Never run `npm run dev` or `npx convex dev` — the owner runs both, and `convex dev` auto-pushes so schema edits deploy on save.
- **Take `npx convex export` before the schema change** (CLAUDE.md rule for migrations).
- Ticket: MOS-52. Decision record: ADR-023 (which this partly reverses — see Task 8). Related: MOS-47, MOS-48, MOS-50, MOS-49.

## THE RULE this phase implements

**One hard delete, everything else soft — for images.**

The gallery's Delete button is the only thing in the product that removes an *image* from R2. Removing a symbol, list item, sentence slot or student profile removes the placement and leaves the image.

**Recorded audio is the deliberate exception: it still hard-deletes.** The principle is not "images vs audio", it is **cost of recreation**. An AI image costs ~4p and 8 seconds of provider time and cannot be reproduced identically; a voice recording costs ten seconds of a parent's time and has no library to live in. Anything added later gets sorted by the same question: *is this expensive to recreate?*

## What is already done and must NOT be rebuilt

- **Account deletion already wipes the whole `accounts/<id>/` and `profiles/<id>/` prefixes** (`app/api/delete-account/route.ts`, listing + `DeleteObjectsCommand` per prefix). Gallery images go with them. **No work, no GDPR gap.** Do not add a special case.
- `convex/lib/personalAssetRefs.ts` → `countRowsReferencingKeys` already answers "is this key referenced?" across symbols, lists, sentences, phrases and covers. It is the shared predicate; do not write a second one.
- `isPersonalAssetKey` already gates deletion to `accounts/` and `profiles/`.
- An image promoted into a published module was **copied** to `library_modules/` at publish (ADR-022), so the account copy is deletable even while the module still displays it.

## File Structure

| file | change |
|---|---|
| `convex/schema.ts` | new `accountImages` table |
| `convex/accountImages.ts` | **new** — list (paginated), record, delete-if-unused |
| `app/api/ai-generate/imagen/route.ts` | writes the generation to R2 + records a row |
| `app/components/app/shared/modals/symbol-editor/MyImagesTab.tsx` | **new** — the grid |
| `…/SymbolEditorModal.tsx` | fifth tab; auto-switch on generation success |
| `…/AiGenerateTab.tsx` | spinner copy; reel retired |
| `convex/profileSymbols.ts`, `convex/profileCategories.ts`, `convex/contentModules/categories.ts` | images stop being collected for deletion; audio still is |
| `scripts/sweep-cache-orphans.mjs` | library images are not orphans |
| `scripts/backfill-account-images.mjs` | **new** — one-off, indexes the objects already in R2 |
| `messages/en.json` | tab label, delete warnings, spinner |
| `docs/4-builds/decisions/ADR-024-*.md` | **new** — why the per-generation R2 write came back |

**Tasks 2 and 5 must ship together.** The gallery promises images are kept; until the soft-delete conversion lands, deleting a symbol still destroys one. A gallery that quietly loses entries is worse than no gallery. Do not merge one without the other.

---

### Task 1: The index — schema, write path, and backfill

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/accountImages.ts`
- Modify: `app/api/ai-generate/imagen/route.ts`
- Create: `scripts/backfill-account-images.mjs`

**Interfaces:**
- Produces: `accountImages` table, `api.accountImages.listMine`, `api.accountImages.record`

- [ ] **Step 1: Back up the deployment (owner action)**

```bash
source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx convex export --path backups/2026-09-04-pre-account-images.zip
```

Do not proceed without it — this adds a table and a backfill writes to it.

- [ ] **Step 2: Add the table**

In `convex/schema.ts`, beside `imageCredits`:

```ts
  /**
   * The account's image library — every image it has generated or uploaded,
   * whether or not anything currently uses it (MOS-52).
   *
   * WHY A TABLE AND NOT AN R2 LISTING: the grid needs newest-first order and
   * cursor pagination. S3/R2 lists lexicographically by key with no metadata,
   * so ordering by recency would mean fetching every object every time.
   * `_creationTime` gives the order for free.
   *
   * DELIBERATELY NOT `imageCredits`. That table records attribution for images
   * IN USE; mixing never-used rows into it would muddy every credit report
   * that reads it. Two tables, two questions.
   *
   * `imageKey` is the R2 object key and the dedupe key — one row per object.
   */
  accountImages: defineTable({
    accountId: v.id("users"),
    imageKey: v.string(),
    source: v.union(
      v.literal("aiGenerated"),
      v.literal("userUpload"),
      v.literal("imageSearch"),
    ),
    // For AI images: what the user asked for. Display hint only — it is shown
    // in the grid as a caption and is never a lookup key.
    prompt: v.optional(v.string()),
  })
    .index("by_account", ["accountId"])
    .index("by_account_and_key", ["accountId", "imageKey"]),
```

- [ ] **Step 3: Write the Convex functions**

Create `convex/accountImages.ts`:

```ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { resolveCallerAccountId, requireCallerAccountId } from "./lib/auth";

/**
 * The account's library, newest first. Paginated because an active account
 * accumulates one row per generation and the grid loads ~10 at a time.
 */
export const listMine = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const resolved = await resolveCallerAccountId(ctx);
    if (!resolved) return { page: [], isDone: true, continueCursor: "" };
    return await ctx.db
      .query("accountImages")
      .withIndex("by_account", (q) => q.eq("accountId", resolved.accountId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

/**
 * Index an image the account now owns. Idempotent on `imageKey` — the same
 * object must never produce two rows, because the grid would show it twice
 * and a delete would leave one behind.
 */
export const record = mutation({
  args: {
    imageKey: v.string(),
    source: v.union(
      v.literal("aiGenerated"),
      v.literal("userUpload"),
      v.literal("imageSearch"),
    ),
    prompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { accountId } = await requireCallerAccountId(ctx);
    const existing = await ctx.db
      .query("accountImages")
      .withIndex("by_account_and_key", (q) =>
        q.eq("accountId", accountId).eq("imageKey", args.imageKey)
      )
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert("accountImages", { accountId, ...args });
  },
});
```

The helpers live in **`convex/lib/account.ts`** — `profileSymbols.ts:3` imports them as `import { requireCallerAccountId, resolveCallerAccountId } from "./lib/account";`. Copy that import line rather than guessing the path.

- [ ] **Step 4: Persist the generation in the route**

`app/api/ai-generate/imagen/route.ts` currently returns the PNG bytes and touches R2 not at all — ADR-023 removed the upload because nothing read it. Something reads it now.

After a successful `generateImage(...)`, before the response, upload and record:

```ts
  // THE R2 WRITE IS BACK, for a different reason than the one ADR-023
  // removed. That write fed a global shared cache; this one puts the image in
  // the USER'S OWN library, account-scoped, because they paid for it and it is
  // theirs to keep (MOS-52). See ADR-024.
  const imageKey = `accounts/${access.accountId}/images/${randomUUID()}.png`;
  await uploadBuffer(imageKey, pngBuffer, "image/png");
  await convex.mutation(api.accountImages.record, {
    imageKey,
    source: "aiGenerated",
    prompt: rawPrompt,
  });
```

Re-add the `uploadBuffer` and `randomUUID` imports removed in phase-34. Return `imageKey` in a response header (`X-Image-Key`) so the client can highlight the new row after the tab switch — **and unlike the `X-R2-Key` header ADR-023 deleted, this one has a consumer; if Task 3 ends up not using it, delete it rather than leaving it.**

Confirm how the route obtains `accountId` — it currently reads `api.users.getMyAccess`; if that does not expose the account id, get it from the same Convex call the `record` mutation uses rather than inventing a second path.

- [ ] **Step 5: Backfill the objects already in R2**

Create `scripts/backfill-account-images.mjs`, modelled on `scripts/backfill-ai-image-sizes.mjs`. It lists `accounts/<id>/images/` for every account and calls `record` for each object that has no row.

**Source for a backfilled row:** the object alone does not say where it came from. Resolve it by looking for a `profileSymbols` row referencing that key and taking its `imageSource.type`; fall back to `userUpload` for anything unreferenced, and say so in the script's output. Getting this slightly wrong is cosmetic — `source` is a display hint, not a lookup key — but the script must state its guess rate rather than hide it.

Run it read-only first and print what it *would* write. There were **99 objects** under the owner's account prefix on 2026-09-04.

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit -p convex/tsconfig.json && npx tsc --noEmit && npm run lint
```

Expected: 0 typecheck errors, lint no worse than 65.

```bash
source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx convex run accountImages:listMine '{"paginationOpts":{"numItems":5,"cursor":null}}' --no-push
```

Expected: an empty page — the CLI is unauthenticated, so `resolveCallerAccountId` returns null. That empty result IS the pass: it proves the function deployed. A "could not find function" error means `convex dev` has not pushed yet.

- [ ] **Step 7: Commit**

```bash
git add convex/schema.ts convex/accountImages.ts app/api/ai-generate/imagen/route.ts scripts/backfill-account-images.mjs
git commit -m "feat(images): index every account image in accountImages

The library needs newest-first order and cursor pagination; R2 lists
lexicographically with no metadata, so the index is a Convex table and
_creationTime is the ordering.

Deliberately not imageCredits — that records attribution for images IN USE,
and mixing never-used rows in would muddy every credit report reading it.

The per-generation R2 write returns, for a different reason than the one
ADR-023 removed: that fed a global shared cache, this fills the user's own
account-scoped library.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The My Images tab

**Files:**
- Create: `app/components/app/shared/modals/symbol-editor/MyImagesTab.tsx`
- Modify: `…/SymbolEditorModal.tsx` (tab config + render)
- Modify: `messages/en.json`

**Interfaces:**
- Consumes: `api.accountImages.listMine` (Task 1)
- Produces: `<MyImagesTab onImageSelected={(blob, previewUrl) => void} />` — the same contract every other source tab uses

**Layout reference:** [Figma — the gallery tab](https://www.figma.com/design/3DAZYuK3A1TrkeZnyGwE1o/Mo-Speech---Finals?node-id=3333-7042). It is a **wireframe** — take the layout and control count from it, take every colour, radius and font size from the theme tokens. Note it was originally drawn as "AI Generate, state 2"; the image region becomes the grid and the two actions become Add to symbol / Delete.

**Follow `ImagesTab.tsx`, which is already this component.** It holds `selectedKey` state, renders a grid of image tiles, and on click fetches the bytes and calls `onImageSelected(blob, previewUrl)`. Copy that structure rather than inventing one; the differences are the grid shape (below), that the source is `usePaginatedQuery` instead of a search API, and that this tab also has a Delete action.

### Grid shape and page size — decided together, on purpose

**`grid grid-cols-2 sm:grid-cols-4`, page size 8.**

> Owner: *"The My images tab pagination should be in 8s because of the 4 col grid"*

Right principle: the page size must be a multiple of the column count, or every "Show more" leaves a ragged part-row and the grid looks broken rather than paginated.

Which is why the breakpoint is **2 → 4 and not 3 → 4**. The obvious precedent is `SymbolStixTab.tsx:146` (`grid-cols-3 sm:grid-cols-4`) — the closest thing in the editor to this tab — but **8 does not divide by 3**, so that breakpoint would be ragged on tablets, the primary device. Two options, and only these two:

| grid | clean page size |
| -- | -- |
| `grid-cols-2 sm:grid-cols-4` | **8** (4 rows / 2 rows) ← use this |
| `grid-cols-3 sm:grid-cols-4` | 12 (4 rows / 3 rows) |

Do not mix: `grid-cols-3` with a page of 8 is the one combination to avoid.

- [ ] **Step 1: Copy keys**

```json
    "tabMyImages": "My Images",
    "myImagesEmpty": "Images you generate or upload will collect here, ready to use again on any symbol.",
    "myImagesAdd": "Add to symbol",
    "myImagesDelete": "Delete",
    "myImagesDeleteBlocked": "This image is used by {count} other items. Remove it from those first.",
    "myImagesLoadMore": "Show more",
```

`en.json` only.

- [ ] **Step 2: Build the grid**

`usePaginatedQuery(api.accountImages.listMine, {}, { initialNumItems: 8 })`, newest first, `loadMore(8)` on the Show-more control.

**A button, not infinite scroll.** MOS-52 says "fetch more on scroll"; a button is the better call inside a modal — scroll-triggered loading fights the modal's own scroll container, has no keyboard equivalent, and gives no way to stop. If the owner prefers infinite scroll, that is a deliberate change, not an implementation detail.

Requirements the markup must satisfy — take colours, radii and spacing from `--theme-*` tokens throughout:

- One tile per image; **every tile identical**. No per-tile action icons — see the action bar below.
- Tapping a tile **selects** it (ring in `--theme-brand-primary`, `aria-pressed`), it does not immediately act. Selection is what the action bar operates on.
- Images load from the same proxy/asset route the other tabs use for `accounts/…` keys — find how `PropertiesPanel` or the modal renders an existing account image and reuse it rather than inventing a URL scheme.
- Empty state uses `myImagesEmpty`.
- `loading="lazy"` on tiles.

- [ ] **Step 3: The action bar, outside the grid**

Two actions, both operating on the current selection, in one bar below the grid — **not on the tiles**. A tappable Delete on every thumbnail is a mis-tap waiting to happen in an app families use on tablets, and hover does not exist there.

- **Add to symbol** — fetch the bytes, `onImageSelected(blob, URL.createObjectURL(blob))`. **Mint a fresh object URL for the handoff**; `SymbolEditorModal.handleImageSelected` takes ownership of what it is given and revokes it on the modal's unmount. This is the exact contract that broke in phase-34 (`29fdf18`) — `UploadTab.tsx:27-28` and `ImagesTab.tsx:155-156` both do it correctly; copy them.
- **Delete** — Task 4 wires it. For now render it disabled.

No quota counts in this tab: nothing here spends the allowance, so "N left today · N left this month" stays in AI Generate.

- [ ] **Step 4: Register the tab**

In `SymbolEditorModal.tsx`, add to `imageTabConfig`:

```ts
    { value: 'my-images', label: t('tabMyImages') },
```

Add `'my-images'` to the `ImageSourceTab` union in `./types`, and render `<MyImagesTab …/>` alongside the others. **Mount it the way `AiGenerateTab` is now mounted** — always rendered, hidden with `hidden` when not selected — so scroll position and pagination survive a tab switch. Conditional rendering would reset the grid to page 1 every time.

- [ ] **Step 5: Verify**

Typecheck, lint, build. Then in the app: the tab appears fifth, shows the backfilled images newest-first, Show more pages, selecting a tile rings it, Add to symbol puts it on the symbol and it saves.

- [ ] **Step 6: Commit**

```bash
git add app/components/app/shared/modals/symbol-editor/MyImagesTab.tsx app/components/app/shared/modals/symbol-editor/SymbolEditorModal.tsx app/components/app/shared/modals/symbol-editor/types.ts messages/en.json
git commit -m "feat(images): My Images, a fifth symbol-editor source tab

The four existing tabs answer 'where does this image come from'; the account's
own library is a fifth. Grid follows ImagesTab's selection pattern; actions sit
in one bar outside the grid so every tile stays identical and nothing depends
on hover, which tablets do not have.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The handover from AI Generate

**Files:** `…/AiGenerateTab.tsx`, `…/SymbolEditorModal.tsx`, `messages/en.json`

- [ ] **Step 1: Spinner copy that pre-announces the destination**

The generation ends by moving the user to a different tab. That must read as intended, not as the app grabbing the wheel — so the loading state says where it is going *before* it goes:

```json
    "aiGeneratingToLibrary": "Generating… this takes a few seconds. Your image will be saved to My Images.",
```

Replace the current bare `aiGenerating` in the spinner branch.

- [ ] **Step 2: Switch tabs on success, not on failure**

On a successful generation, set the modal's active tab to `my-images` and highlight the new row (the `imageKey` from Task 1's response header).

**On failure, do NOT switch.** A refusal (422) or provider error (502) keeps the user in AI Generate: there is nothing to show in the gallery, and the thing they need to change — the prompt — is on the tab they are already on. Both meters refund server-side, so the existing "hasn't cost you a generation" copy stays true.

The highlight should **persist until the user interacts** rather than fading on a timer — an instructor who looked away for the 8 seconds should still see which one is new.

- [ ] **Step 3: Retire the session reel**

Everything the reel protected is now persisted, so it is dead complexity. Remove `reel`, `reelIndex`, `reelRef`, `REEL_MAX`, `current`, the object-URL revocation effects, `handleDiscard`, and the Discard / Add-to-symbol result view from `AiGenerateTab`. The tab becomes create-only: blurb, prompt preview, thumbnails, styles, prompt field, Generate, spinner.

Also remove `ai_generate_abandoned` from `lib/analytics.ts` and its firing site — nothing is abandoned once everything is kept. **Keep `ai_generate_adopted.attempts`**: it is still the number MOS-49's allowance gets retuned against, and `attemptsRef` still feeds it.

- [ ] **Step 4: Verify**

Generate: spinner names My Images, then the tab switches with the new image highlighted in slot 1, and the AI tab has no result view. Force a refusal (a prompt the model declines) and confirm the tab does **not** switch and the refusal copy shows.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ai-generate): generations land in My Images

The spinner names the destination before the switch happens, so arriving there
is confirmation rather than surprise. Failures stay put — there is nothing to
show in the gallery and the prompt they need to change is on this tab.

Retires the session reel: everything it protected is now persisted. Also drops
ai_generate_abandoned, which cannot mean anything once nothing is abandoned.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Delete — the one hard delete

**Files:** `convex/accountImages.ts`, `…/MyImagesTab.tsx`, `messages/en.json`

- [ ] **Step 1: The mutation, gated on the SHARED predicate**

Add to `convex/accountImages.ts`:

```ts
/**
 * How many other things still use this image. The gallery's Delete button is
 * enabled only at 0.
 *
 * MUST use `countRowsReferencingKeys` — the same predicate the orphan sweep
 * uses. These are the same question asked in two places, and if they drift the
 * UI refuses to delete something the sweep reports as garbage, or the sweep
 * flags images the UI is protecting. One writer, many readers.
 */
export const usageCount = query({
  args: { imageKey: v.string() },
  handler: async (ctx, { imageKey }) => {
    const resolved = await resolveCallerAccountId(ctx);
    if (!resolved) return 0;
    return countRowsReferencingKeys(ctx, resolved.accountId, new Set([imageKey]), {});
  },
});
```

Check `countRowsReferencingKeys`'s real signature in `convex/lib/personalAssetRefs.ts` before writing this — the fourth argument is an exclusions object and the shape matters.

Then the delete. It removes the row; the R2 object is deleted by the API route, because **a Convex mutation cannot do R2 work** — this repo's established pattern is route-collects → mutation → route-deletes (see `app/api/delete-profile-symbol/route.ts`).

```ts
/**
 * THE ONLY PATH IN THE PRODUCT THAT DELETES AN IMAGE FROM R2 (MOS-52).
 * Everything else — removing a symbol, a list item, a sentence slot, a student
 * profile — is a soft delete that leaves the object alone.
 *
 * Refuses when anything still references the key, so a user cannot break their
 * own boards from here.
 */
export const deleteIfUnused = mutation({ /* … returns the key to delete, or throws IN_USE */ });
```

- [ ] **Step 2: Wire the button**

Enabled only when `usageCount` is 0. When it is not, show `myImagesDeleteBlocked` with the count rather than a silently disabled control — a disabled button with no explanation is the worst of both.

Deleting removes the tile from the grid immediately (the paginated query is reactive).

- [ ] **Step 3: Verify — count R2, do not trust the dashboard**

The Cloudflare dashboard shows date-modified but no object count, so a new object is invisible among a hundred others and a deleted one cannot be confirmed gone. Use the committed script:

```bash
source ~/.nvm/nvm.sh && nvm use 20.17.0
node --env-file=.env.local scripts/count-r2-objects.mjs accounts/<accountId>/images/
```

1. Count objects under `accounts/<id>/images/`.
2. Delete an unused image from the gallery.
3. Count again — **exactly one fewer**, and the specific key gone.
4. Select an image that IS used by a symbol; confirm Delete is blocked and names the count.

- [ ] **Step 4: Commit**

---

### Task 5: The soft-delete conversion — SHIPS WITH TASK 2

**Files:** `convex/profileSymbols.ts`, `convex/profileCategories.ts`, `convex/contentModules/categories.ts`, `messages/en.json`

This is the inversion, and it **reverses half of MOS-50** (`4b2673b`), which shipped on 2026-09-04 and made symbol deletion delete the image. That was correct for a world with no library. There is a library now.

- [ ] **Step 1: Stop collecting image keys for deletion**

At all three delete-orphan sites, remove images from the collected keys entirely — not just `aiGenerated`. Uploads and image-search picks are in the library too, and the rule is about the library, not about provenance.

**Keep collecting recorded audio.** It still hard-deletes: it has no library to live in, and re-recording costs ten seconds of a parent's time rather than 4p and a provider round-trip. That asymmetry — *cost of recreation* — is the actual principle, and it belongs in the comment at each site so nobody "tidies up" the inconsistency later.

**Do not touch `getProfileSymbolUsageCount`.** It counts references to drive a warning and is not a delete path; MOS-50 fixed it and it stays fixed.

- [ ] **Step 2: Change what the delete warnings say**

They currently imply the image is destroyed. It is not. Owner's wording:

> You are just deleting the symbol in the category. The image can still be accessed in My Images in the symbol editor.

Needs a copy pass for tone and for the list / sentence / phrase variants, but the substance is right: name what is being removed (the placement), and name where the image still lives. `en.json` only.

- [ ] **Step 3: Verify — the count must NOT move**

The mirror image of Task 4's check, and the one that proves the inversion. Same script — `node --env-file=.env.local scripts/count-r2-objects.mjs accounts/<accountId>/images/`:

1. Count objects under `accounts/<id>/images/`.
2. Create a symbol with an AI image, save it. Count → **+1**.
3. **Delete the symbol.** Count → **unchanged**. The image is still in My Images.
4. Delete a symbol that has a **recorded audio** clip. Confirm the audio object IS gone.

Step 3 is the exact opposite of what MOS-50 verified two commits earlier (99 → 100 → 99). That is intended, and if it still drops to 99 the conversion has not taken.

- [ ] **Step 4: Commit**

---

### Task 6: Teach the orphan sweep about the library

**Files:** `scripts/sweep-cache-orphans.mjs`

- [ ] **Step 1: Stop reporting library images as garbage**

The sweep finds R2 objects nothing references and reports them as deletable. **An unused library image is, by definition, unreferenced** — so without this change the sweep lists a user's entire library as garbage, and anyone acting on that report destroys images they paid for.

Any key with a row in `accountImages` is **deliberately kept**, not an orphan. Give it its own KEEP section with that reason stated, the way the script already keeps `ai-cache/` objects.

Until this ships the sweep is actively dangerous to run. It is read-only and has no delete path, so nothing breaks on its own — but say so in the script header.

- [ ] **Step 2: Verify**

Run it. The owner's ~99 account images should appear under KEEP with the library reason, not under DELETE candidates.

- [ ] **Step 3: Commit**

---

### Task 7: ADR and close out

**Files:** `docs/4-builds/decisions/ADR-024-*.md`, `docs/4-builds/features/FEAT-008-*.md`

- [ ] **Step 1: Write ADR-024**

ADR-023 removed the per-generation R2 write because nothing read it. This phase puts one back. **Without a record saying why, a future reader diffing the two will conclude ADR-023 was quietly reverted.** It was not — the difference is ownership:

- ADR-023 removed a write that fed a **global shared cache**, serving one family's image to another.
- ADR-024 adds a write that fills the **user's own account-scoped library**, because they paid for the image and it is theirs.

The ADR should also record the one-hard-delete rule and the cost-of-recreation principle behind the audio exception, since those govern code far outside this phase.

- [ ] **Step 2: Update FEAT-008**

§3 describes the session reel and what the shipped UI can reach. The reel is gone and the regression ADR-023 accepted — "an image generated and not adopted is gone permanently" — is **retired**. Rewrite that section rather than appending to it; a spec that describes two contradictory models is worse than one that is merely out of date.

- [ ] **Step 3: Close out**

Move MOS-52 to Done with a comment covering the delete-model inversion. Retire this plan to `docs/4-builds/plans/_done/`.

---

## Notes for whoever executes this

- **Tasks 2 and 5 ship together.** A gallery that silently loses entries when a symbol is deleted is worse than no gallery.
- **Do not add a special case for account deletion.** It already wipes both personal prefixes wholesale.
- **Do not write a second "is this in use" predicate.** `countRowsReferencingKeys` exists; the sweep and the Delete button both call it. Today's MOS-50 work found that question already being asked in four places, having drifted in two.
- **Verify R2 by counting objects, never by the Cloudflare dashboard**, which shows date-modified and no count.
- **Audio hard-deletes on purpose.** If the inconsistency looks like an oversight, re-read the cost-of-recreation reasoning before "fixing" it.
- If a step's code does not match what is on disk, the file has moved on since 2026-09-04 — stop and re-read rather than forcing the patch.
