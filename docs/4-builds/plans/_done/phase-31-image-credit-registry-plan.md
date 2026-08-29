# Phase 31 — Image Credit Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Standalone.** Written 2026-08-25 for a fresh session. Everything needed to start is in this file — no prior conversation required.

**Status:** not started
**Tickets:** MOS-34 (closes when Task 5 passes) · MOS-35, MOS-36, MOS-38 (**superseded by this design** — see "What this replaces")
**Follows:** Phase 30 (`docs/4-builds/plans/_done/phase-30-custom-imagery-scaffolding.md`), shipped 2026-08-25
**Blocks:** the live publish/install stress test, and therefore the return to phase-29

**Goal:** Make image attribution a single per-account registry keyed by the image itself, so every image an instructor uses is credited exactly once, in one findable place, no matter which surface it was added from.

**Architecture:** Phase 30 stored credit *per placement* — on category symbols, list items, sentence slots and phrase words. That is why the plumbing sprawls: every new surface that can hold an image becomes another field list that can forget a field, and Phase 30 shipped that exact bug twice. This phase inverts it. Credit is stored once per **R2 image key** in a new `imageCredits` table. Any surface that saves an image writes one row, deduplicated on the key. Publishing looks credits up by the keys the module already enumerates; installing writes them into the installing account's registry. Content rows never need to carry credit again.

**Tech Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Convex 1.x · next-intl v4 · Cloudflare R2

---

## Why this phase exists

### The obligation, in plain terms

An instructor building a "Musical Instruments" category finds no SymbolStix symbol they like for *guitar*, so they use Image Search and pick a photo from Wikimedia Commons.

That photo is Creative Commons. The licence is a deal: **use it freely, provided you name the photographer and state the licence.** The app fetches all three — photo, photographer, licence.

Where the fields exist we store all three. Where they don't, we store the photo and discard the rest on save. The app then redistributes someone's work under a licence whose one condition it can no longer meet, because it no longer knows who made it.

Three properties make this worse than it sounds:

1. **Nothing looks broken.** The image renders, the tile works, no error fires.
2. **It multiplies.** Publish the module, forty families install it, and that is forty unattributed copies from a single save.
3. **It is unrecoverable.** No script can repair it later. The photographer's name was never written down. The only remedy is re-authoring every affected item by hand.

Property 3 is why this phase runs **before** the live authoring/publish stress test. Content authored during that test becomes real content; authoring it against the current code bakes in permanent gaps.

### Why a registry rather than more per-row fields

The recurring defect is a **write path that rebuilds a row from an explicit field list**. It compiles, it looks tidy, and it silently drops every field the author did not name. Phase 30 hit it twice and needed a dedicated fix pass (`handleReorderSlots`, whole-list translate). Its review then found a third instance on the audio keys that its own scope table had missed.

Storing credit per placement means that risk recurs on every surface that can hold an image — covers, the talker bar, and whatever gets built next. Keying on the image instead removes the class:

- **A cover image has an R2 key.** That is enough. Nothing to plumb.
- **A talker slot has an R2 key** — the same key as the category tile it came from (`rawKey` at `PersistentTalker.tsx:36` only strips the `/api/assets?key=` prefix; no copy is made). Nothing to plumb.
- **A future surface has an R2 key.** Nothing to plumb.

### Scope note on which licences actually compel this

Of the four providers, **only Wikimedia's CC licences legally require attribution.** Unsplash, Pixabay and Pexels are attribution-optional. The hard compliance surface is narrower than it looks.

We still capture and display all four. A credits list with arbitrary gaps is harder to trust and harder to maintain than one that lists everything, and crediting photographers who did not demand it is the right default for this product.

### What gets recorded, and why

| Source | Recorded? | Reasoning |
|---|---|---|
| **SymbolStix** | No | Licensed to us wholesale, not credited per image. Excluding it is also what keeps the registry small and meaningful. |
| **Image Search** — Wikimedia, Unsplash, Pixabay, Pexels | **Yes, all four** | Only Wikimedia's CC licences legally compel attribution today. The other three are recorded anyway because **licence terms change and cannot be complied with retroactively** — Unsplash has already changed its terms twice — and because a takedown on any platform requires answering "which of our images came from there, and which modules shipped them?" |
| **AI-generated** | **Yes** | No licence obligation. Recorded for model provenance: when Google retired Imagen mid-2026 we could not distinguish Imagen-era from Gemini-era images because the cache key carried no model (MOS-31). Training-data litigation is live and model terms move; if output ever has to be identified and replaced, this is the only durable record. `aiImageCache` is a cache, not provenance — Phase 30 built a sweep that deletes from it. |
| **User uploads** | **No** | Owner decision 2026-08-25. No external provenance exists: no photographer, no licence, no source URL. The row would be nearly empty and nothing about it can be lost later. |

**The cost argument is not the deciding factor either way.** `recordImageCredit` fires once per image *save* and dedupes, so lifetime volume is in the hundreds per heavy author, plus a burst at install. Ten thousand writes is ~1% of the Starter free-tier call allowance and roughly 3 MB — a few pence at overage rates. Decide on risk, not on call count.

**Consequence of excluding uploads — accept knowingly.** Task 3's completeness check can no longer assert "every non-SymbolStix image has a row". It reports two buckets instead:

- **Definitely lost** — the content row says `imageSourceType: "imageSearch"` but no registry row exists.
- **Unknown, review manually** — no type is available on the row (folder/category covers and talker-built sentence slots carry none), so an absent registry row could be a legitimate upload or a lost credit.

The second list should stay short enough to eyeball. If it ever does not, recording uploads is the fix.

### Owner decisions, 2026-08-25

- **Credit never appears on a board tile.** On an AAC board, competing visual information degrades symbol recognition. The tile has one job. CC requires attribution "in a manner reasonable to the medium", and a credits screen is long-established practice for apps, games and film.
- **One source of truth, in `Settings → Credits`.** The earlier draft of this plan also put a per-module credits button on each module's page; that is what was forcing per-placement storage. Dropped.
- **Not inside Data & Privacy.** That section is about the instructor's own data. Third-party attribution is a different thing, and filing it there makes it harder to find and confusing to anyone reading it for privacy reasons. It gets its own tab.
- **Not hidden.** The whole basis on which a separate credits screen satisfies the attribution condition is that it is *reasonable for the medium*. Deliberate obscurity undercuts that, and costs nothing to avoid.
- **Rows carry a thumbnail.** A list of photographer names is unverifiable — you cannot tell which image you are being asked to credit.

---

## What this replaces

| Ticket | Was going to be | Now |
|---|---|---|
| **MOS-35** — covers discard credit | Add provenance fields to `profileFolders` + `profileCategories`, thread through two handlers, publish ×4, install | **Superseded.** A cover has an R2 key; the registry handles it with no new fields and no handler changes. |
| **MOS-36** — talker bar drops credit | Widen `TalkerSymbolItem` (×2 declarations), thread through `addToTalker` and 3 call sites, carry into `units[]`/`slots[]` | **Superseded.** A talker slot carries the same key as its source tile. |
| **MOS-38** — provenance shape declared 6× | Consolidate into one shared const | **Superseded.** One table, one shape, by construction. |
| **MOS-34** — attribution lost outside categories | Already fixed in Phase 30 | **Still open** until its Verification runs — that is Task 5. |

Close MOS-35, MOS-36 and MOS-38 as *superseded by design* when this ships, not as fixed.

### What is deliberately NOT undone

Phase 30's per-row credit fields (`imageSourceUrl`, `attribution`, `license` on list items, sentence slots, phrase words, category symbols) **stay exactly where they are.** Do not remove them in this phase.

- They are harmless, optional, and already reviewed.
- `SymbolEditorModal` reads them to rehydrate a tile's credit line when reopening an existing image (`SymbolEditorModal.tsx:412-420`).
- `imageSourceType` is doing separate work — it decides which tab the editor reopens on — and must stay regardless.

The registry is **additive**. It becomes the authority for reading and for publishing; the row fields become a redundant copy that costs nothing. Removing them is a tidy-up for a later phase once the registry has proven itself in production.

---

## Global Constraints

Carried from Phase 30 and still binding. Every task's requirements implicitly include this section.

- **Work on `main`.** No branch, no worktree — project standing convention.
- **The dev server is owner-run on port 3000.** Never `npm run dev`. It does **not** always hot-reload route handlers: if you measure anything against it, first change something trivially observable (e.g. a status code) and confirm it actually changes, or you may be measuring a stale compile.
- **Never `npx convex dev`** — it creates an anonymous local backend and rewrites `.env.local`. Use `--no-push` on every `npx convex run`, and read-only functions only unless a task explicitly says otherwise.
- Node 20.17.0 (Convex CLI requirement). If a command complains, prefix with `source ~/.nvm/nvm.sh && nvm use 20.17.0`.
- **No test framework exists and none may be added** (settled in phase-17). "Test" means a runnable command with a stated expected output. Do not write a test file; do not add a test runner. A missing test file is not a defect here — an unrun verification command is.
- **Verification baseline — compare against these, never against zero:**
  - `npx tsc -p convex/tsconfig.json --noEmit` → clean, exit 0. Any error is yours.
  - `npx tsc --noEmit` → **4** pre-existing unrelated errors (3 stale `.next/types/validator.ts` refs, 1 Stripe `apiVersion` in `lib/stripe.ts:8`).
  - `npm run lint` → exactly `✖ 66 problems (36 errors, 30 warnings)`, all pre-existing. Do not fix them; do not add to them.
- **Never hard-code UI copy.** New keys go in `messages/en.json` **only** — never `hi.json`/`es.json`/etc. `i18n/request.ts` merges each locale over `en.json` so missing keys fall back to English, and the translation pipeline only translates keys **absent** from a locale. A hand-added placeholder is treated as already-translated and ships forever.
- **Never hard-code colours, spacing, radii or font sizes.** Tailwind 4, no `tailwind.config.ts`. All `--theme-*` vars are declared in `:root` in `app/globals.css` and mapped via the `@theme inline` block in the same file. Use `bg-theme-*`, `text-theme-*`, `rounded-theme` / `rounded-theme-card`, `p-theme-*`, `gap-theme-*`. `ThemeContext` overwrites these at runtime per student profile — a hard-coded value breaks theme switching.
- **Components live in `app/components/{app|marketing|admin}/{sections|ui|modals}/`.** `page.tsx` files stay thin.
- **Convex schema changes must be additive and `v.optional(...)`** so existing rows stay valid.
- `isPersonalAssetKey` (delete-path) and `isPromotableAssetKey` (publish-path) must **stay separate** — see the doc comment at `convex/lib/contentModuleDelete.ts:41-77`. Do not merge, widen or "simplify" either. Nothing in this plan should touch them.
- **Never key a Convex query result or argument object by localised or user-supplied text.** Hindi crashes serialisation. Return arrays; rebuild lookups client-side.
- Take `npx convex export --path backups/<date>-<label>.zip` before anything destructive. Only Task 3 writes data, and it is guarded.

---

## The rule that matters most in this plan

**Sweep; do not trust the file lists below.**

Phase 30's §1 shipped a Critical bug precisely because its scope table enumerated four sites and there were more. Two of the four listed were not even live, and the two that were each had a second unguarded push directly underneath that nobody had written down.

Every task below names the sites I found. **Treat that as a starting point, not an inventory.** Each task ends with a sweep step, and finding a site the plan missed is a success, not a deviation — report it.

---

## File Structure

New files:

| File | Responsibility |
|---|---|
| `convex/imageCredits.ts` | The registry: schema-adjacent helpers, the dedupe-on-write mutation, and the read query. |
| `app/components/app/shared/ui/CreditList.tsx` | Presentational list of credit rows with thumbnails. No data fetching. |
| `app/components/app/settings/sections/CreditsPanel.tsx` | Settings tab panel. Fetches, renders `CreditList`, handles empty and loading states. |
| `scripts/backfill-image-credits.mjs` | Dry-run-by-default enumeration and backfill of existing credit into the registry. |

Modified (non-exhaustive — sweep):

| File | Change |
|---|---|
| `convex/schema.ts` | New `imageCredits` table + `by_account_and_key` index. |
| `app/components/app/shared/modals/symbol-editor/SymbolEditorModal.tsx` | Every image-save path also records a credit row. |
| `app/components/app/shared/modals/symbol-editor/ImagesTab.tsx` | Carry `title` from the search result onto the draft. |
| `app/components/app/shared/modals/symbol-editor/types.ts` | Draft gains `imageTitle`. |
| `convex/contentModules/publish.ts` | Embed credits for the module's keys into the artifact. |
| `convex/lib/contentModuleInstall.ts` | Write the artifact's credits into the installing account's registry. |
| `convex/contentModules/exportModules.ts` · `convex/migrations.ts` | Round-trip the artifact's credits. |
| `convex/data/_shared/types.ts` | Module artifact type gains a credits array. |
| `app/components/app/settings/sections/SettingsContent.tsx` | New `credits` tab id + panel case. |
| `messages/en.json` | All new copy. **en.json only.** |

---

## Task 1: The registry — table, write path, dedupe

**Files:**
- Create: `convex/imageCredits.ts`
- Modify: `convex/schema.ts`
- Modify: `app/components/app/shared/modals/symbol-editor/types.ts:24-26`, `ImagesTab.tsx:165`, `SymbolEditorModal.tsx` (the image-save paths)

**Interfaces produced** (every later task consumes these exact names):

```ts
// convex/schema.ts
imageCredits: defineTable({
  accountId:       v.id("users"),
  // The R2 object key this credit describes. THE dedupe key.
  imageKey:        v.string(),
  // Only sources with external provenance worth preserving. `upload` and
  // `symbolstix` are deliberately absent — see "What gets recorded" below.
  imageSourceType: v.union(
    v.literal("imageSearch"), v.literal("aiGenerated"),
  ),
  imageTitle:      v.optional(v.string()),
  attribution:     v.optional(v.string()),
  license:         v.optional(v.string()),
  imageSourceUrl:  v.optional(v.string()),
  // Best-effort label of what it was first used for. Display hint only —
  // never the dedupe key, and never trusted to stay accurate.
  firstUsedFor:    v.optional(v.string()),
}).index("by_account_and_key", ["accountId", "imageKey"]),
```

```ts
// convex/imageCredits.ts
export const recordImageCredit = mutation({ /* dedupe-on-write, see below */ });
export const getAccountImageCredits = query({ /* returns CreditRow[] */ });

export type CreditRow = {
  imageKey: string;
  imageSourceType: "imageSearch" | "aiGenerated";
  imageTitle?: string;
  attribution?: string;
  license?: string;
  imageSourceUrl?: string;
  firstUsedFor?: string;
};
```

**Rules for `recordImageCredit`:**
- **Dedupe on `(accountId, imageKey)`.** If a row exists, **skip** — do not update. The first record wins. This keeps the write idempotent and means re-saving an image is free.
- **Record `imageSearch` and `aiGenerated` only.** The union has no `symbolstix` or `upload` member, so this is enforced by the type rather than by a runtime check. See "What gets recorded, and why" below.
- **Auth-checked**, following the `resolveCallerAccountId` pattern in `convex/profileSymbols.ts`. An account writes only its own rows.
- **Never throws on a duplicate.** A save path calling this must not fail because the credit already exists.
- Fire-and-forget from the client's point of view: recording a credit must never block or fail an image save. If it errors, log and continue — a missing credit row is recoverable by the Task 3 backfill; a failed image save is not.

**`imageTitle` — where the data comes from:** `ImageSearchResult.title` already exists (`lib/image-providers/types.ts:7`) and is populated by all four providers — `wikimedia.ts:168`, `unsplash.ts:82`, `pixabay.ts:76`, `pexels.ts:80`. It is captured at search time and currently dropped at save. `ImagesTab.tsx:165` is where the other credit fields are copied onto the draft; `imageTitle` joins them there.

**Where the write goes.** Every path in `SymbolEditorModal` that persists an image to R2 and then saves. Phase 29 recorded three: `SymbolEditorModal.tsx:624`, `:653`, `:682`, `:741` write to `accounts/${accountId}/images/${uuid}`. Confirm the current line numbers yourself — **sweep, do not trust these.** The `imageOnly` mode (used by folder and category covers) goes through the same modal and must be covered.

- [ ] **Step 1: Add the table and index to `convex/schema.ts`**

- [ ] **Step 2: Write `recordImageCredit` and `getAccountImageCredits`**

`getAccountImageCredits` returns an **array**, sorted stably (by `firstUsedFor` then `imageKey`). Never key the result object by user text.

- [ ] **Step 3: Add `imageTitle` to the draft and populate it**

- [ ] **Step 4: Call `recordImageCredit` from every image-save path**

- [ ] **Step 5: Sweep for save paths this missed**

```bash
grep -rn "accounts/\${accountId}/images\|imagePath:" app/components/app/shared/modals/symbol-editor/ --include="*.tsx"
```
List every path found in your report, and for each state whether it now records a credit and why. A path that saves a `symbolstix` or `upload` image correctly records nothing — say so explicitly rather than omitting it, so a reader can tell a deliberate exclusion from an oversight. That distinction is the whole point of the sweep.

- [ ] **Step 6: Verify and commit**

```bash
npx tsc -p convex/tsconfig.json --noEmit   # clean, exit 0
npx tsc --noEmit                            # exactly 4 pre-existing errors
npm run lint                                # exactly 66 problems (36 errors, 30 warnings)
```

```bash
npx convex run imageCredits:getAccountImageCredits '{}' --no-push
```
Expected: `[]` — nothing has been recorded yet and the backfill is Task 3. An empty array here is a **pass**, not a failure. Paste the actual output.

```bash
git add -A && git commit -m "feat(credits): per-account image credit registry keyed by R2 object key"
```

---

## Task 2: Credits travel with a published module

**Files:**
- Modify: `convex/contentModules/publish.ts`
- Modify: `convex/lib/contentModuleInstall.ts`
- Modify: `convex/contentModules/exportModules.ts`, `convex/migrations.ts` (`seedLibraryModulesFromJSON`)
- Modify: `convex/data/_shared/types.ts`, `convex/schema.ts` (`libraryModules`)

**Interfaces consumed:** `CreditRow`, `recordImageCredit` (Task 1).

**Why this is needed.** The registry is per-account. An admin publishes a module; a family installs it. The installing account has never seen those images and has no registry rows for them — so the credits must ride along inside the module artifact and be written into the installer's registry on install.

**The join already exists.** `collectSourcePromotableKeys` (`convex/lib/personalAssetRefs.ts:259`) walks a publish source and returns exactly the R2 keys that module uses — categories, list items, sentence slots and units, phrase words, and the folder/category cover (`folderKeys:77`, `categoryKeys:71` both push `imagePath`). Publish already calls it to decide what to copy into R2. Look those same keys up in the publishing account's registry and embed the results.

**Critical ordering detail.** Publishing **promotes** assets — it copies them from `accounts/…` to `library_modules/<tree>/<slug>/<kind>/<filename>` (key format built at `app/api/admin/promote-module-assets/route.ts:108`; `<kind>` is `audio` if the old key contained `/audio/`, else `images`). So the artifact's credits must be keyed by the **promoted** key, not the source key, or install will write rows nobody can join to. `publish.ts` already holds the `assetPathMap` that maps old key → new key. Use it, and state in your report exactly where you applied it.

- [ ] **Step 1: Add a `credits: CreditRow[]` field to the module artifact type and the `libraryModules` table** (optional, defaulting to an empty array)

- [ ] **Step 2: Populate it at publish**, remapping each `imageKey` through `assetPathMap`

- [ ] **Step 3: Write them into the installing account's registry on install**, via the same dedupe-on-write path from Task 1

- [ ] **Step 4: Round-trip through export and restore**

Check whether the field passes through wholesale the way `items` does — `exportModules.ts:58` emits `items: m.items`, `migrations.ts:527` reads `items: mod.items` — or needs explicit carrying. State which, with the line you checked.

- [ ] **Step 5: Verify the round-trip**

```bash
node scripts/verify-module-roundtrip.mjs
```
Expected: the same result as before your change. Paste it. This proves you did not break export/restore; it cannot yet prove credits survive, because no published module has any. That proof is Task 5.

- [ ] **Step 6: Verify and commit**

Run the three baseline commands.

```bash
git add -A && git commit -m "feat(credits): carry image credits through publish, export, restore and install"
```

---

## Task 3: Backfill existing credit into the registry

**Files:**
- Create: `scripts/backfill-image-credits.mjs`

**Interfaces consumed:** `recordImageCredit` (Task 1).

**What exists to backfill.** Phase 30 and earlier stored credit per placement. Those rows are the only record of who made those images, so they must be lifted into the registry:

- `profileSymbols.imageSource` — the `imageSearch` member carries `attribution` / `license` / `imageSourceUrl` (`convex/schema.ts:609`). This is where essentially all existing credit lives.
- `profileLists` items, `profileSentences` slots, `profilePhrases` words — carry the fields as of Phase 30, but measured 2026-08-24 as **all SymbolStix**, so expect zero. Cover them anyway.
- `libraryModuleCategoryItems → symbols` (`convex/schema.ts:164`) — published module artifacts.
- `profileSymbols` rows whose `imageSource.type` is `aiGenerated` — these carry no attribution to lift, but still get a registry row recording the source type. Where an `aiPrompt` was persisted (Phase 29 fixed that), carry it into `firstUsedFor` or note in your report that it was dropped and why.

**Skip `upload` and `symbolstix` rows entirely** — they are out of the registry by design. Count them in the report so the totals reconcile, but create nothing.

**Rules:**
- **Dry-run by default.** No `--apply`, no writes, until the flag is passed. Follow the shape of `scripts/backfill-ai-image-sizes.mjs`, which is dry-run-by-default and prints what it would do.
- **Print the plan first**: how many credit rows would be created, how many skipped as already present, how many skipped as `upload`/`symbolstix` by design, and how many content rows carry an `imageSearch` image with **no** recoverable credit. That last group is permanently lost — Phase 29-era saves predating the attribution work — and must be reported as a number, not silently ignored. It is information for the owner, not a bug to fix.
- **Never delete anything.**
- Idempotent: running it twice creates nothing the second time, because `recordImageCredit` dedupes.

- [ ] **Step 1: Write the script, dry-run only**

- [ ] **Step 2: Run it dry and paste the actual output**

```bash
node --env-file=.env.local scripts/backfill-image-credits.mjs
```

- [ ] **Step 3: Add a completeness check**

A read-only query or script mode that lists image keys referenced by content rows which have **no** registry row, split into the two buckets described in "What gets recorded, and why":

- **Definitely lost** — the content row says `imageSourceType: "imageSearch"` but no registry row exists. Every entry here is a real gap.
- **Unknown, review manually** — no type is available on the row (folder/category covers and talker-built sentence slots carry none), so an absent row could be a legitimate upload or a lost credit.

This is the standing self-check that the registry has not drifted from reality — it is how a missed save path gets caught six months from now. Report both counts and the full second list, which should be short.

- [ ] **Step 4: Verify and commit. Do NOT run `--apply`.**

Applying the backfill against live data is the owner's call and belongs in Task 5's acceptance run, after a `npx convex export` snapshot.

Run the three baseline commands.

```bash
git add -A && git commit -m "feat(credits): dry-run backfill of existing attribution into the registry"
```

---

## Task 4: Settings → Credits

**Files:**
- Create: `app/components/app/shared/ui/CreditList.tsx`
- Create: `app/components/app/settings/sections/CreditsPanel.tsx`
- Modify: `app/components/app/settings/sections/SettingsContent.tsx` — `OWNER_SETTINGS_IDS`, `COLLABORATOR_SETTINGS_IDS`, and the `renderPanel` switch (`:56-62`)
- Modify: `messages/en.json`

**Interfaces consumed:** `getAccountImageCredits`, `CreditRow` (Task 1).

**Placement.** A new `credits` tab. The existing tabs are `instructor`, `profile`, `plan`, `invites`, `privacy`. Collaborators get it too — they author content and take on the same obligation. Deep-linking is automatic: the `?tab=<id>` handler at `SettingsContent.tsx:38-49` reads from `settingsIds`.

**The panel always exists**, including when the list is empty — it renders an empty state. A permanent, predictable location is what makes the credits discoverable, and discoverability is the basis on which a credits screen satisfies the attribution condition. Do not hide it and do not gate its existence on having content.

**Row shape:**

> `[thumbnail]`  **Classical Guitar, two views** — Georges Jansoone — CC BY-SA 4.0

- The **thumbnail** renders from `imageKey` through the existing asset route (`/api/assets?key=…`). Small, fixed size, `loading="lazy"`.
- The **whole row links** to `imageSourceUrl` where present, `target="_blank" rel="noopener noreferrer"`. The Commons page carries the full licence text and proves provenance, which is what someone checking a credit wants to land on.
- Missing fields collapse gracefully — render the thumbnail plus whatever is known rather than a row of dashes.
- **Group by kind so the list stays readable.** Third-party images (`imageSearch`) list in full, with thumbnail, title, artist and licence — these are the ones carrying an obligation. `aiGenerated` rows collapse under a single expandable line, "AI-generated images (N)", since they carry no attribution and would otherwise bury the credits that matter.
- `firstUsedFor` is a display hint only. If it is stale or absent, the row still renders.

**Theme tokens only.** No raw colour, spacing, radius or font-size classes — check every class string against `app/globals.css`. **All copy via `useTranslations`, keys in `messages/en.json` only.**

`CreditList` is presentational — props in, markup out, no `useQuery`. `CreditsPanel` does the fetching.

- [ ] **Step 1: `CreditList`**
- [ ] **Step 2: `CreditsPanel`** with loading and empty states
- [ ] **Step 3: Register the tab** in both id lists and the `renderPanel` switch

- [ ] **Step 4: Confirm no locale but `en` was touched**

```bash
git diff --name-only | grep messages/
```
Expected: `messages/en.json` and nothing else.

- [ ] **Step 5: Verify and commit**

Run the three baseline commands.

```bash
git add -A && git commit -m "feat(credits): image credits tab in settings"
```

---

## Task 5: Owner acceptance — the live authoring and publish test

**This task is owner-driven. A subagent cannot drive the authed app and must not try.** The implementer's job is to produce the script; the owner executes it.

This is simultaneously:
- MOS-34's stated Verification, outstanding since Phase 30
- Phase 29's Task 7 Step 9 (the ADR-022 promotion acceptance test)
- The mixed symbol / non-symbol stress test the owner asked for on 2026-08-25

**Files:**
- Create: `.superpowers/sdd/phase-31-acceptance.md`

Write a click-by-click script covering, with the exact value to look for at each hop:

0. **Snapshot first**: `npx convex export --path backups/<date>-pre-credit-backfill.zip`, then run the Task 3 backfill with `--apply` and confirm the counts match the dry run.
1. Author a **category** with mixed SymbolStix and Image Search tiles, plus an Image Search **cover image**.
2. Author a **list** and a **sentence** the same way, each in a folder with its own cover. Build at least one sentence **via the talker bar** — that path has no credit plumbing by design, and this proves the registry covers it.
3. Confirm the content rows landed in `profileCategories` / `profileSymbols`, `profileLists`, `profileSentences`, `profileFolders`.
4. Confirm **Settings → Credits** lists every Image Search image exactly once, with a working thumbnail — and that SymbolStix tiles and your own uploads produced **no** rows, by design. Add at least one AI-generated image and confirm it appears in the collapsed "AI-generated images (N)" group rather than among the third-party credits.
5. **Publish** each module from the admin account.
6. Confirm R2 keys land under **`library_modules/<tree>/<slug>/images/…`** and `…/audio/…`, cover included.
7. Confirm rows exist in **`libraryModules`**, that each carries a `credits` array, and that its `imageKey`s are the **promoted** `library_modules/…` keys — not the admin's `accounts/…` keys. This is the single most likely thing to be wrong.
8. Confirm the modules appear in the resource library.
9. **Install** on the test account.
10. Confirm the test account's **Settings → Credits** now lists the same images, with working thumbnails resolving from `library_modules/…`.
11. **The highest-consequence check:** uninstall one module and confirm the shared `library_modules/` objects **still exist** in R2. This is Phase 30 §1's fix under live conditions.
12. Run the Task 3 completeness check and confirm zero content images lack a credit row.

Include a teardown section: which test folders and R2 prefixes to remove afterwards, and which to leave.

- [x] **Step 1: Write the script** — `.superpowers/sdd/phase-31-acceptance.md` (13 checkpoints, 0–12, plus pre-flight and teardown).
- [x] **Step 2: Hand it to the owner and stop.** Nothing in steps 0–12 was executed.

---

## Self-review against the spec

- Registry keyed by R2 key, dedupe-on-write, skip-if-exists → Task 1.
- Credit recorded from both the symbol editor and module install → Tasks 1 and 2.
- Thumbnail + link-to-source on each row → Task 4.
- Single source of truth in `Settings → Credits`, no per-module button → Task 4; the module button from the earlier draft is dropped, and "What this replaces" records why.
- Credit stays **off the tiles** → satisfied: nothing in this plan renders credit on a board.
- `imageTitle` → Task 1, a column rather than a chain.
- MOS-35 / MOS-36 / MOS-38 → superseded, see "What this replaces". MOS-34 → Task 5.
- Type consistency: `CreditRow`, `recordImageCredit`, `getAccountImageCredits` (Task 1) are consumed by name in Tasks 2, 3, 4; `CreditList` (Task 4) by `CreditsPanel` (Task 4).
- **Known trade, accepted:** deleting the last item that used an image leaves its credit row behind. Over-crediting is never a licence violation, and reference-counting would mean scanning every content row on every delete — the expensive join this design exists to avoid. Revisit only if the list becomes cluttered in practice.
- **Known trade, accepted:** excluding uploads means the completeness check reports an "unknown, review manually" bucket rather than a clean invariant. Recording uploads is the fix if that list ever grows unwieldy.
- **Known trade, accepted:** AI images are recorded for model provenance despite carrying no attribution obligation, and are grouped away from the third-party credits in the UI so they do not bury them.
- **Known gap, not in scope:** MOS-37 (`translate-modules` skips custom-image symbol labels). Does not touch credit or this test.
- **Known gap, not in scope:** `displayPropsSchema` is duplicated across `profileLists.ts` / `profileSentences.ts` / `profilePhrases.ts` the same way the provenance shape was. Ticket it; do not bundle it.

## When this phase is done

Close **MOS-35**, **MOS-36** and **MOS-38** as *superseded by design*. Close **MOS-34** only once Task 5 has actually been run and passed.

Then return to **phase-29** (`docs/4-builds/plans/phase-29-module-artifact-restore-and-dr-test.md`), paused mid-Task-8 with Tasks 1–7 complete. Task 7 Step 9 there is discharged by this plan's Task 5.

After that, the `library_packs/` retirement: re-publish `space` onto `library_modules/`, verify it renders, **reinstall it so the installed copy repoints too**, re-export the artifacts (`node scripts/export-library-modules.mjs`, commit `convex/data/**`, then `node scripts/verify-module-roundtrip.mjs` → exit 0), and only then delete the folder.

> **Amended by the whole-phase review, 2026-08-25 (Finding 3a).** The step used to read "backfill `space`" first. It must NOT be backfilled first. The backfill would write its 15 credits under the dead `library_packs/…` keys, and `mergeModuleCredits` is existing-wins by `imageKey` — so on the re-publish the 15 dead keys would survive ALONGSIDE the 15 new ones, and every account that installed or reinstalled `space` afterwards would get both sets: each space photo listed twice on the Credits screen, one copy with a 404 thumbnail, permanently, because the artifact's `credits` array is append-only. `planLibraryModuleCredits` therefore skips every `library_packs/` key and reports them in a `legacyPrefixSkipped` bucket. Nothing is lost: `collectModuleCredits` now falls back to the source rows' own `attribution` / `license` / `imageSourceUrl` when the registry misses (Finding 1), so the re-publish alone embeds all 15 credits correctly keyed to the new objects.
>
> **Amended again, fix pass 2, 2026-08-25 (account-side twin of Finding 3a).** The same collision is live one level down: an installed copy of `space` points at the identical shared `library_packs/space/images/…` objects the admin's own `space` category does, so `planAccountImageCredits` walks straight into them too. It now carries the same `isLegacySharedModuleAssetKey` skip, in its own `legacyPrefixSkipped` bucket, and `checkAccountImageCreditCompleteness` reports them as a fourth `deferredLegacyPrefix` bucket — labelled "deferred until `space` is re-keyed," never "lost" — so the standing self-check does not raise a permanent false alarm over a deliberate, temporary gap.
>
> **Before deleting the prefix**, `scripts/backfill-image-credits.mjs --check` must report `MODULE ARTIFACTS — missing credit: 0` and `legacy \`library_packs/\` keys: 0`.
>
> **Self-healing condition (do this after the re-publish + reinstall, before deleting the prefix):** re-run `node --env-file=.env.local scripts/backfill-image-credits.mjs --apply` so the images that were deferred get recorded under their new `library_modules/categories/space/images/…` keys — both the module artifact (already covered by Finding 3a's checklist above) and every account's registry. Then confirm `--check` reports the deferred bucket at zero: `deferred until \`space\` is re-keyed: 0` in the COMPLETENESS CHECK SUMMARY, and no per-account `deferred until \`space\` is re-keyed (…): N` line above zero. Only once both that line and `legacy \`library_packs/\` keys: 0` read zero is it safe to delete the `library_packs/` folder.

### After any `--apply`: re-export the committed artifacts

`--apply` patches `libraryModules.credits` in the LIVE table; the committed disaster-recovery copies under `convex/data/<tree>/<slug>.json` do not have those credits, so `scripts/verify-module-roundtrip.mjs` reports drift and a restore via `seedLibraryModulesFromJSON` would republish the module with its credits **stripped** — landing straight in phase-29's paused wipe/restore DR test. Run `node scripts/export-library-modules.mjs`, commit `convex/data/**`, then `node scripts/verify-module-roundtrip.mjs` and confirm exit 0. The backfill script prints this reminder itself at the end of every `--apply` run.
