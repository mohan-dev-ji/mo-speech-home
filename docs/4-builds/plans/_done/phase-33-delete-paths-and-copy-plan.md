# Phase 33 — One delete verb, four unguarded paths

> **Standalone.** Written 2026-08-29 for a fresh session. Everything needed to start is here.

**Status:** Shipped 2026-08-29 (`a494483`, MOS-41 closed 2026-08-30), retired to `_done/` 2026-09-05. Verified live on a real account: four delete paths, shared-key survival, `library_modules/` untouched. Note phase 36 (ADR-024) later narrowed what these paths delete: images are now left in place and only recorded audio is collected — see `phase-36-my-images-library-plan.md` beside this file. Unticked boxes are the plan as written.
**Follows:** Phase 32 (`phase-32-collection-buildout-and-dr-plan.md`) — Tasks 1–3 done, MOS-25 DR test passed.
**Ticket:** MOS-41 (In Progress). Related: MOS-42 (stale credits), MOS-44 (edit-time orphans).

---

## Starting prompt for the next session

Paste this:

> Read `docs/4-builds/plans/phase-33-delete-paths-and-copy-plan.md`. Execute it.
> The owner's delete model is settled and is recorded in the plan — do not re-open it.
> Four client paths delete content without any R2 cleanup; the plan names all four with
> their call sites. This is a delete path: work it with a review cycle, not as a wiring job.
> Start by re-running the audit in Task 0 to confirm the four are still the four.

---

## The owner's decision — the governing spec (settled 2026-08-29)

Quoted, because everything below follows from it:

> "The way I want the delete module to work is as a permanent delete of all the user's
> assets in accounts. Never delete a file from the R2 `library_modules`. I like the way we
> can install a module and edit it with the path changing in the `profile_*` table. When it
> comes to deleting just delete the row and file except original module assets in R2
> `library_modules`. This ensures no orphans in the R2 accounts folder. **There is no
> uninstall — it is just a straight delete** as modules can change once installed. Deleting
> an unchanged module is like an uninstall but let's just call every delete function
> 'delete' as it has the possibility of being edited."

### What this settles

| Question the ticket asked | Answer |
|---|---|
| Case 3 — personalised module removed | Edits are destroyed, permanently. No divergence detection, no copy-on-write, no detach-and-keep. |
| Uninstall vs delete wording | **There is only "Delete."** The word *uninstall* leaves the product — UI copy, route names, function names. |
| What happens to R2 | Personal assets (`accounts/…`, `profiles/…`) are deleted. `library_modules/…` is **never** touched by any delete. |
| Reinstalling afterwards | Still possible — the published module is untouched. It returns pristine, not personalised. |

### Two things it does NOT change

1. **No predicate changes.** `isPersonalAssetKey` already means exactly `accounts/` + `profiles/`;
   every shared namespace including `library_modules/` already answers NO
   (`convex/lib/contentModuleDelete.ts:41-77`). The owner's rule is already the guard.
   **Do not modify `isPersonalAssetKey` or `isPromotableAssetKey`** — carried from phase 32.
2. **Reference-counting stays.** "Delete the file" means *unless another row in this account
   still references it*. `collectReferencedPersonalKeys` (`convex/lib/personalAssetRefs.ts:116`)
   already implements this and is deliberately **over-inclusive**: where "no orphans" and "never
   break a live asset" conflict, it keeps the orphan. That bias is correct and stays — a stray
   object costs bytes, a wrongly-deleted one blanks a child's board.

---

## What the audit found (2026-08-29)

MOS-41 was written naming **one** orphaning path. There are **four**. All four call a Convex
mutation directly from the client; only an API route can delete from R2, so none of them clean up.

| # | Surface | Client call site | Mutation | Orphans on delete |
|---|---|---|---|---|
| 1 | Category | `app/components/app/categories/sections/CategoriesContent.tsx:107` | `profileCategories.deleteCategory` | symbol images + recorded audio |
| 2 | Folder (group) | `app/components/app/shared/sections/GroupsView.tsx:103` | `profileFolders.deleteFolder` | folder cover + **every list/sentence inside it** |
| 3 | List | `app/components/app/lists/sections/ListsModeContent.tsx:331` | `profileLists.deleteProfileList` | every item image + `audioPath` / `recordedAudioPath` / `generatedAudioPath` |
| 4 | Student profile | `app/components/app/settings/sections/StudentProfilesPanel.tsx:114` | `studentProfiles.deleteStudentProfile` | `profiles/…` profile photo |

**These four already clean up correctly** and are the pattern to copy:
`/api/delete-profile-symbol`, `/api/delete-composed` (sentences + phrases),
`/api/uninstall-content-module` (module folders), `/api/delete-account`.

### Not hypothetical

- Path 1 has a **confirmed live orphan**: `accounts/j578wzn…/images/faf830fb-….webp`, still in R2
  on the test account, referenced by nothing. It is the only object under that account's prefix.
- Path 3 would orphan **6 uploaded images** today if the owner deleted their own `Playdoh` list.
- Path 2 cascades: `deleteFolder` (`convex/profileFolders.ts:135`) deletes every `profileLists` /
  `profileSentences` row inside the folder. `FOLDERED_TREE` is `lists | sentences` only, so both
  branches are covered — there is no phrases gap. Deleting one folder can orphan dozens of objects.

### A small pre-existing gap in the collector

`collectReferencedPersonalKeys` documents itself as scanning "every table and every field that can
hold a personal key", and walks six: symbols, lists, sentences, phrases, categories, folders. It
does **not** walk `studentProfiles.profilePhoto`, which is a `profiles/…` personal key. The
practical risk is near-zero (a photo key is never shared with content), but the docblock currently
overstates its coverage. Fix it in Task 1 while adding path 4, or amend the docblock — do not
leave the claim and the behaviour disagreeing.

---

## Global constraints (binding — carried from phase 32)

- **Work on `main`.** No branch, no worktree.
- **Dev server is owner-run on :3000.** Never `npm run dev`. Never `npx convex dev`.
- `--no-push` on every `npx convex run`. Node 20.17.0 (`source ~/.nvm/nvm.sh && nvm use 20.17.0`).
- **No test framework and none may be added.** "Test" = a runnable command with a stated
  expected output, or a live browser check.
- Baselines: `npx tsc -p convex/tsconfig.json --noEmit` exit 0 · `npx tsc --noEmit` **4**
  pre-existing errors · `npm run lint` exactly `✖ 66 problems (36 errors, 30 warnings)`.
- New UI copy in `messages/en.json` **only** — never hand-add to `hi.json`/`es.json`.
- No hard-coded colours/spacing/radii/font sizes — `--theme-*` from `app/globals.css`.
- **Snapshot before any live delete testing:** `npx convex export --path backups/<date>-pre-phase-33.zip`

---

## Task 0 — Re-run the audit before writing code

Do not trust the table above; it was true on 2026-08-29.

```bash
for m in deleteCategory deleteFolder deleteProfileList deleteStudentProfile; do
  echo "--- $m"; grep -rn "api\.[a-zA-Z]*\.$m" app | grep -v "^app/api/"
done
```

Expected: one client call site each, none of them inside `app/api/`. **If a fifth surface has
appeared, add it before proceeding** — this plan's scope table being wrong is the exact failure
mode MOS-41 warns about, and it has already happened once to this ticket.

---

## Task 1 — One orphan-key query per surface

Each mirrors `getCategoryModuleDeleteOrphanKeys` (`convex/contentModules/categories.ts:165`),
which is the reference implementation:

1. Collect candidate personal keys from the rows about to be deleted (filtered by
   `isPersonalAssetKey`).
2. Call `collectReferencedPersonalKeys(ctx, accountId, { <ids being deleted> })`.
3. Return `candidates.filter(k => !referenced.has(k))`.

The exclude-set already accepts `categoryIds`, `folderIds`, `listIds`, `sentenceIds`,
`phraseIds`, `symbolIds` — no signature change needed.

New queries:

| Query | Arg | Collects |
|---|---|---|
| `getCategoryDeleteOrphanKeys` | `categoryId` | the category cover + every `profileSymbols` image and recorded-audio key under it |
| `getFolderDeleteOrphanKeys` | `folderId` | folder cover + all keys in the lists/sentences the cascade deletes |
| `getListDeleteOrphanKeys` | `listId` | every item's `imagePath` + the three audio fields |
| `getStudentProfileDeleteOrphanKeys` | `profileId` | `profilePhoto` |

**The existing slug-based `getCategoryModuleDeleteOrphanKeys` stays.** Two entry points survive
under the new model — "delete this category" (by id) and "delete everything this module
installed" (by slug, possibly several categories). Both are called *Delete* in the UI.

**Reuse the extractors in `convex/lib/personalAssetRefs.ts`** (`categoryKeys`, `folderKeys`,
`listKeys`, `symbolKeys`) rather than re-walking fields by hand. The bug class this repo keeps
hitting is "a field list forgot a field" (MOS-38); a second hand-rolled walk is a second chance
to forget one.

---

## Task 2 — One delete route, replacing the uninstall route

The asymmetry MOS-41 names — one tree reaches removal through a route the other three do not —
is the thing to remove, not to replicate four times. And "uninstall" must leave the codebase.

**Rename `/api/uninstall-content-module` → `/api/delete-content`** and widen its `TREE_FNS`
map into a `KINDS` map keyed by what is being deleted:

```
category-module (slug)  ← existing behaviour, unchanged
list-module (slug)      ← existing
sentence-module (slug)  ← existing
category (id)           ← NEW
folder (id)             ← NEW
list (id)               ← NEW
student-profile (id)    ← NEW
```

Keep the route's proven three-step shape verbatim (`app/api/uninstall-content-module/route.ts`):
**collect keys → run mutation → delete from R2, best-effort**, returning `filesDeleted` /
`filesFailed`. Step order is load-bearing: the keys must be read *before* the rows are deleted.

Then repoint the four client call sites from `useMutation(...)` to `fetch('/api/delete-content')`,
and delete the now-unused direct mutation imports.

**Leave the mutations themselves callable.** They are the correct primitive; the route is what
adds R2 cleanup. Do not add R2 logic to a Convex mutation — it cannot do it, and the established
pattern is route-collects/mutation-runs/route-deletes.

---

## Task 3 — Copy: one verb

Every removal is **Delete**. The word *uninstall* appears nowhere the user can see, and nowhere
in the code after Task 2.

Current copy (`deleteGroupTitle` / `deleteGroupConfirm`) is *false* for installed modules — it
promises permanence it did not deliver, and now it will deliver it, so the words become true for
the first time. But they are still incomplete: they never mention that the module can be
installed again.

Proposed body, for the module case (owner to approve wording):

> Delete "<name>" and everything in it? This permanently deletes your changes and any images
> or recordings you added. You can install it again from the Resource Library, but it will come
> back as published — your changes will not.

For a user-made category/folder/list, the existing permanent-deletion wording is already correct.

New keys in `messages/en.json` **only**. Do not hand-add to `hi.json` / `es.json` — the merge in
`i18n/request.ts` falls back to English, and the translate pipeline only fills keys *absent* from
a locale.

---

## Task 4 — Verification (no test framework; these are the tests)

Snapshot first. Then, per surface, on the **test account**:

1. Note the R2 object count: `rclone lsf r2:mo-speech-bucket-v2/accounts/<test-id> -R --files-only | wc -l`
2. Personalise: add an uploaded image to the thing about to be deleted.
3. Delete it through the UI.
4. **Expected:** the personal object is gone; the count drops by exactly the number added.
5. **Expected:** `rclone lsf r2:mo-speech-bucket-v2/library_modules -R --files-only | wc -l`
   is **unchanged** — this is the assertion that matters most.

Then the shared-key case, which is the one that can do real damage:

6. Use the **same uploaded image** on a category symbol *and* in a talker sentence.
7. Delete the category.
8. **Expected:** the object SURVIVES, because the sentence still references it, and the
   sentence still renders its image.

Finally, re-run the standing check — it reads the same tables and will notice a wrongly-deleted
asset as a missing credit:

```bash
node --env-file=.env.local scripts/backfill-image-credits.mjs --check
```

---

## Review focus — what to be suspicious of

The ticket's warning, restated because it has already come true once on this ticket:

> This looks like a ten-minute wiring job, which is precisely the risk. It is a delete path, and
> this codebase has been bitten three times by delete paths that looked simple — including
> phase-30 §1, whose scope table was wrong in three separate ways.

Specifically:

- **"Does this now delete something it should not?"** The guards are correct but have never been
  exercised from the category / folder / list / profile directions.
- **Deleting more than the user asked for.** `deleteFolder` cascades. The orphan-key query must
  cover exactly the cascade — no more, no less.
- **The exclude-set must name every id being deleted.** Miss one and the collector thinks a row
  still references the key, leaving an orphan (benign). Include one wrongly and it deletes a live
  asset (not benign).
- **Route-before-mutation ordering.** Keys read after the rows are gone are keys not read at all.

---

## Out of scope — deliberately

- **Edit-time orphans (MOS-44).** Swapping an image leaves the old object behind with no delete
  involved; two live examples from 2026-08-28 authoring. Different blast radius (editor save
  paths, not delete paths). Owner decision 2026-08-29: separate ticket.
- **Stale `imageCredits` rows after removal (MOS-42).** Deliberately no delete path for the
  registry. Read alongside this, fix separately.
- **`library_packs/` retirement.** Still pending; see phase-32 "Then".
