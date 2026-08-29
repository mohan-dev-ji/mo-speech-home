/**
 * The delete surface, in one place (phase 33 / MOS-41).
 *
 * Deleting user content has two halves that live on opposite sides of the
 * wire: a Convex mutation removes the rows, and an API route removes the R2
 * objects — a mutation cannot touch R2, which is why the established shape is
 * *route collects keys → mutation runs → route deletes objects*
 * (`app/api/delete-content/route.ts`).
 *
 * Before this file, four client surfaces skipped the route entirely and called
 * their mutation directly, so their personal R2 objects were orphaned in
 * silence — `CategoriesContent`, `GroupsView`, `ListsModeContent` and
 * `StudentProfilesPanel`. Nothing errored; the bytes simply stayed forever.
 *
 * This query is the "collect keys" half for every one of them. It is
 * deliberately ONE function over a discriminated target rather than four
 * look-alike queries: the defect MOS-41 describes is four surfaces answering
 * the same question differently, and four functions is four chances to drift
 * apart again.
 *
 * The module-scoped siblings — `getCategoryModuleDeleteOrphanKeys` and friends
 * in `convex/contentModules/*` — stay as they are. They answer a different
 * question ("everything module <slug> installed", possibly several rows);
 * this one answers "this row, by id". Both are called **Delete** in the UI:
 * per the owner's decision there is no "uninstall", because an installed
 * module may have been personalised and removing it destroys those edits.
 */

import { query } from "./_generated/server";
import { resolveCallerAccountId } from "./lib/account";
import {
  collectDeleteOrphanKeys,
  deleteTargetValidator,
} from "./lib/personalAssetRefs";

/**
 * Personal R2 keys that deleting `target` would leave orphaned — i.e. keys the
 * doomed rows hold that NO surviving row of this account still references.
 *
 * Returns `[]` for an unauthenticated caller, and for a row that is missing or
 * owned by someone else. Empty means "delete nothing from R2", which is the
 * safe direction to fail in: a missed key is a stray object, a wrong key is a
 * blanked image on a child's board.
 *
 * Must be called BEFORE the delete mutation. Once the rows are gone there is
 * nothing left to read the keys from.
 */
export const getDeleteOrphanKeys = query({
  args: { target: deleteTargetValidator },
  handler: async (ctx, { target }): Promise<string[]> => {
    const resolved = await resolveCallerAccountId(ctx);
    if (!resolved) return [];
    return collectDeleteOrphanKeys(ctx, resolved.accountId, target);
  },
});
