import { mutation } from "./_generated/server";
import type { Id, DataModel } from "./_generated/dataModel";

/**
 * EVERY table that carries an `accountId`, derived from the schema rather than
 * remembered (MOS-39).
 *
 * The cascade below used to be a hand-written list of tables, and it had
 * silently forgotten three of them — `profilePhrases`, `profileFolders` and
 * `imageCredits`. Deleting one test account left 50 dangling rows behind, and
 * because nothing points AT an orphaned account from a table anyone iterates,
 * nothing ever noticed. Nine account ids had accumulated that way.
 *
 * This is the same failure as MOS-41's four-instead-of-one delete paths and
 * MOS-38's duplicated field shapes: a list that has to be kept in sync by
 * memory eventually is not. So the list is now checked BY THE COMPILER.
 *
 * `"accountId" extends keyof Doc<K>` matches whether the field is required
 * (`imageCredits`) or `v.optional` (most of the others, a legacy migration
 * artefact) — `keyof` includes optional keys, and testing assignability
 * against `{ accountId?: … }` would not work, because a table with no
 * `accountId` at all also satisfies an optional property.
 */
type AccountScopedTable = {
  [K in keyof DataModel]: "accountId" extends keyof DataModel[K]["document"]
    ? K
    : never;
}[keyof DataModel];

/**
 * Every account-scoped table this cascade handles.
 *
 * A TYPE, not an array, because it is never iterated: these tables are reached
 * through different indexes (`by_account_id` for most, `by_account_and_key`
 * for `imageCredits`, two separate index paths for `accountMembers`), so the
 * deletes below stay explicit. This exists purely so the compiler can compare
 * it against what the schema actually declares.
 */
type HandledAccountTable =
  | "accountMembers"
  | "imageCredits"
  | "profileCategories"
  | "profileFolders"
  | "profileLists"
  | "profilePhrases"
  | "profileSentences"
  | "profileSymbols"
  | "studentProfiles";

/**
 * ADD A TABLE WITH AN `accountId` AND THIS LINE FAILS TO COMPILE, naming the
 * table you have not handled. That is the entire point — the next person does
 * not have to know this file exists.
 *
 * Verified by deliberately removing `profileFolders` from the union, which
 * produced: Type 'boolean' is not assignable to type '{ ERROR: "Add this
 * table to cascadeDeleteAccount"; missing: "profileFolders" }'.
 */
type UncoveredAccountTable = Exclude<AccountScopedTable, HandledAccountTable>;
type _EveryAccountTableIsHandled = [UncoveredAccountTable] extends [never]
  ? true
  : {
      ERROR: "Add this table to cascadeDeleteAccount";
      missing: UncoveredAccountTable;
    };
const _ACCOUNT_TABLE_COVERAGE: _EveryAccountTableIsHandled = true;
void _ACCOUNT_TABLE_COVERAGE;

/**
 * Cascade-delete the calling user's entire account.
 *
 * Owner-only: refuses if the caller is an active collaborator on someone
 * else's account. Returns the list of student profile IDs that were
 * removed so the caller (the /api/delete-account route) can wipe the
 * matching `profiles/{profileId}/` prefixes from R2.
 *
 * Stripe and Clerk deletion happen outside this mutation — the API route
 * orchestrates the full sequence.
 */
export const cascadeDeleteAccount = mutation({
  args: {},
  handler: async (ctx): Promise<{ profileIds: Id<"studentProfiles">[] }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    const memberships = await ctx.db
      .query("accountMembers")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", user.clerkUserId))
      .collect();
    const isCollaboratorElsewhere = memberships.some(
      (m) => m.accountId !== user._id && m.status === "active"
    );
    if (isCollaboratorElsewhere) {
      throw new Error(
        "Only the account owner can delete this account. Contact support to leave a shared account."
      );
    }

    const accountId = user._id;

    const profiles = await ctx.db
      .query("studentProfiles")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect();
    const profileIds = profiles.map((p) => p._id);

    for (const profileId of profileIds) {
      const modelling = await ctx.db
        .query("modellingSessions")
        .withIndex("by_profile_id", (q) => q.eq("profileId", profileId))
        .collect();
      for (const m of modelling) await ctx.db.delete(m._id);

      const presence = await ctx.db
        .query("studentViewSessions")
        .withIndex("by_profile", (q) => q.eq("profileId", profileId))
        .collect();
      for (const p of presence) await ctx.db.delete(p._id);
    }

    const symbols = await ctx.db
      .query("profileSymbols")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect();
    for (const row of symbols) await ctx.db.delete(row._id);

    const categories = await ctx.db
      .query("profileCategories")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect();
    for (const row of categories) await ctx.db.delete(row._id);

    const lists = await ctx.db
      .query("profileLists")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect();
    for (const row of lists) await ctx.db.delete(row._id);

    const sentences = await ctx.db
      .query("profileSentences")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect();
    for (const row of sentences) await ctx.db.delete(row._id);

    const phrases = await ctx.db
      .query("profilePhrases")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect();
    for (const row of phrases) await ctx.db.delete(row._id);

    // Folders AFTER their contents: lists and sentences hang off `folderId`,
    // and while Convex has no foreign keys, deleting the container first would
    // leave a window where the children point at nothing.
    const folders = await ctx.db
      .query("profileFolders")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect();
    for (const row of folders) await ctx.db.delete(row._id);

    // The credit registry. Deleting these is correct HERE and nowhere else:
    // the "never drop a credit" rule (see `recordImageCredit`) protects a live
    // account's licence obligations, and an account that no longer exists has
    // none — it displays no Credits screen and installs nothing. Leaving them
    // is not caution, it is unreachable rows (MOS-42 covers the live-account
    // case, which is a different question).
    const credits = await ctx.db
      .query("imageCredits")
      .withIndex("by_account_and_key", (q) => q.eq("accountId", accountId))
      .collect();
    for (const row of credits) await ctx.db.delete(row._id);

    // Owner-side membership rows: every collaborator invited TO this account.
    const ownerMembers = await ctx.db
      .query("accountMembers")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect();
    for (const m of ownerMembers) await ctx.db.delete(m._id);

    // Collaborator-side membership rows: any seat where THIS user has been
    // invited as a collaborator elsewhere. The precheck above only refuses
    // when there's an `active` seat on another account; pending invites and
    // seats whose host account has since been deleted (orphans) are left
    // here. Clean them up so the table doesn't accumulate dangling rows
    // across testing churn.
    const collaboratorRows = await ctx.db
      .query("accountMembers")
      .withIndex("by_clerk_user_id", (q) =>
        q.eq("clerkUserId", user.clerkUserId)
      )
      .collect();
    for (const r of collaboratorRows) await ctx.db.delete(r._id);

    for (const p of profiles) await ctx.db.delete(p._id);

    await ctx.db.delete(user._id);

    return { profileIds };
  },
});
