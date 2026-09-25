# Phase 37: the Credits screen shows only images in use (MOS-42)

Milestone: Final Straight · M0 Clear the deck. M0's other two tickets (MOS-43,
MOS-38) were small enough to ship without a plan. This one reads licence data,
so it gets one.

## Problem

`getAccountImageCredits` (`convex/imageCredits.ts`) returns every `imageCredits`
row the account has ever written. Rows are never deleted, by design:
over-crediting is never a licence violation, but silently dropping a credit is.
So once a module is uninstalled or unpublished, or an image is replaced, its
credit stays on the Credits screen forever. The screen then shows a placeholder
thumbnail where the image used to be. On the test account
`j578wzn2kszv6n8mfjra89yqkn8crk8s`, 12 of its 18 rows point at content that no
longer exists.

## Decision: filter when the screen reads, never delete (option 1 in the ticket)

The query keeps only credits whose `imageKey` is still referenced by the
account's own content. **No credit row is changed or deleted.** The registry
stays append-only. The screen just stops showing rows for images the account
no longer uses.

That matches what the table already means. The `imageCredits` doc comment in
`schema.ts`, and ADR-024 §1, define it as "the registry of images IN USE". A
row for an image that's no longer used is out of date, not a credit the
account still owes. If the image comes back (a module is reinstalled, or an
image is adopted again), the key is referenced again and its original row
reappears unchanged. Nothing is lost.

Options rejected: prune on uninstall (a delete path on licence data; see
MOS-33), and accept as-is (the screen shows images the account doesn't have).

## What counts as "in use"

These are the same six tables, read with the same extractors, that the backfill
and the completeness check use (`convex/lib/imageCreditRefs.ts`). That way all
three consumers agree on what "referenced" means:

| Table | Extractor |
|---|---|
| `profileSymbols` | `symbolRefs` |
| `profileLists` | `listRefs` (items) |
| `profileSentences` | `sentenceRefs` (slots + units + unit words) |
| `profilePhrases` | `phraseRefs` (words) |
| `profileCategories` | `coverRef` (cover) |
| `profileFolders` | `coverRef` (cover) |

Each table is read by its `by_account_id` index, which covers every student
profile on the account.

Deliberately **not** counted:
- `accountImages` (My Images). Owning an image is not using it. The two tables
  are siblings and are never merged (ADR-024 §1). An AI image's credit is
  recorded when it is adopted, so an image in the library that nothing uses
  has no credit to show anyway.
- `modellingSessions.symbolPreview`. It's a snapshot in session history, not
  board content.

## Read budget (fallback that never hides a credit)

One Convex query can read at most 16,384 documents or 8 MiB. From dev samples,
content documents average 0.4 to 1.8 KB, and the largest account has about
1,057 `profileSymbols`. So a single-query walk has a lot of headroom.

As a guard, the walk counts the documents it reads. If it goes past
`IN_USE_WALK_BUDGET` (6,000), the query stops and returns **every** row
unfiltered, which is today's behaviour. The fallback therefore only ever
over-credits. It can never hide a credit or crash the Credits screen. It logs a
warning so we'd notice if an account ever reaches that size.

## Steps

1. `convex/imageCredits.ts`
   - Add `collectInUseImageKeys(ctx, accountId): Promise<Set<string> | null>`,
     a module-private helper. It walks the six tables with `for await` over
     `withIndex("by_account_id", …)` and feeds each row through its extractor.
     It returns `null` once it has read more than the budget.
   - `getAccountImageCredits`: if the key set isn't `null`, keep only rows whose
     `imageKey` is in it. The sort and the returned shape don't change.
   - Update the doc comment: why it filters, why it never deletes, and why the
     fallback exists.
2. `convex/lib/imageCreditRefs.ts`: the header says the extractors have "TWO
   consumers". Add the third (the Credits screen filter).
3. Verify: `npx tsc --noEmit -p convex/tsconfig.json`, `npx tsc --noEmit -p .`,
   and lint the touched files.

No schema change, no migration and no frontend change. `CreditsPanel` and
`CreditList` render whatever the query returns.

## Acceptance (owner tests in the app)

1. **Test account** `j578…`: Settings → Credits no longer lists the 12
   `acceptance-*` credits with placeholder thumbnails. The 4 installed and 2
   personal credits are still listed.
2. **Uninstall → reinstall**: install a module that uses Image Search images
   and check that its credits appear. Uninstall it and check they disappear.
   Reinstall it and check they come back with the same attribution.
3. **Replace an image**: give a symbol an Image Search image and save it, then
   replace it with an upload. The old credit leaves the screen.
4. **Nothing in use is lost**: every credited image still visible on a board,
   list, sentence, phrase, category cover or folder cover is still on the
   Credits screen.

## What the app does differently

The Credits screen now lists only images the account currently uses. Credit
rows in the database are never deleted, so this can't be unrecoverable. If the
filter were wrong, the worst case is a credit that's missing from the screen
until the image is used again. The fallback means the filter never hides
credits on an account too large to walk.
