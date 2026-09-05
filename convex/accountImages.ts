import { internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator, type PaginationResult } from "convex/server";
import type { Doc, Id } from "./_generated/dataModel";
import { resolveCallerAccountId, requireCallerAccountId } from "./lib/account";
import { accountImageSource } from "./schema";

/**
 * One row of the My Images grid: the library row plus whatever credit the
 * account already holds for that same R2 key.
 *
 * The join exists because the grid is an "add this image to a symbol" picker
 * and adding is BY REFERENCE — the symbol points at the library key rather
 * than re-uploading the bytes. An Image Search picture carries a licence
 * obligation to display its attribution, so the credit has to travel with the
 * row or re-using the picture would silently drop it.
 */
export type LibraryImage = Doc<"accountImages"> & {
  attribution?: string;
  license?: string;
  imageSourceUrl?: string;
  imageTitle?: string;
};

/**
 * The account's library, newest first. Paginated because an active account
 * accumulates one row per generation and the grid loads 8 at a time.
 *
 * Each page joins its rows against `imageCredits` on (accountId, imageKey) —
 * one indexed lookup per row, so 8 per page. Deliberately NOT a merge of the
 * two tables: `imageCredits` answers "what must we display for an image in
 * use", `accountImages` answers "what does this account own"; see the
 * `accountImages` doc comment in `schema.ts`.
 */
export const listMine = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args): Promise<PaginationResult<LibraryImage>> => {
    const resolved = await resolveCallerAccountId(ctx);
    if (!resolved) {
      const empty: LibraryImage[] = [];
      return { page: empty, isDone: true, continueCursor: "" };
    }
    const { accountId } = resolved;
    const result = await ctx.db
      .query("accountImages")
      .withIndex("by_account", (q) => q.eq("accountId", accountId))
      .order("desc")
      .paginate(args.paginationOpts);

    const page: LibraryImage[] = [];
    for (const row of result.page) {
      // `.first()` rather than `.unique()`: this join is display-only, and a
      // duplicate credit row (which the registry's own dedupe should prevent)
      // must never be able to throw the whole grid out.
      const credit = await ctx.db
        .query("imageCredits")
        .withIndex("by_account_and_key", (q) =>
          q.eq("accountId", accountId).eq("imageKey", row.imageKey)
        )
        .first();
      page.push({
        ...row,
        ...(credit?.attribution ? { attribution: credit.attribution } : {}),
        ...(credit?.license ? { license: credit.license } : {}),
        ...(credit?.imageSourceUrl ? { imageSourceUrl: credit.imageSourceUrl } : {}),
        ...(credit?.imageTitle ? { imageTitle: credit.imageTitle } : {}),
      });
    }
    return { ...result, page };
  },
});

/**
 * Shared dedupe-on-key write, used by both `record` (JWT-derived accountId)
 * and `recordForAccount` (CLI-supplied accountId, for the unauthenticated
 * backfill script) so the two can never drift on what "already indexed"
 * means.
 */
async function insertAccountImageIfNew(
  ctx: MutationCtx,
  accountId: Id<"users">,
  args: {
    imageKey: string;
    source: "aiGenerated" | "userUpload" | "imageSearch";
    prompt?: string;
  }
) {
  const existing = await ctx.db
    .query("accountImages")
    .withIndex("by_account_and_key", (q) =>
      q.eq("accountId", accountId).eq("imageKey", args.imageKey)
    )
    .unique();
  if (existing) return existing._id;
  return await ctx.db.insert("accountImages", { accountId, ...args });
}

/**
 * Index an image the account now owns. Idempotent on `imageKey` — the same
 * object must never produce two rows, because the grid would show it twice
 * and a delete would leave one behind.
 */
export const record = mutation({
  args: {
    imageKey: v.string(),
    source: accountImageSource,
    prompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { accountId } = await requireCallerAccountId(ctx);
    return await insertAccountImageIfNew(ctx, accountId, args);
  },
});

/**
 * CLI variant of `record` for `scripts/backfill-account-images.mjs`. The
 * script runs unauthenticated — there is no JWT for `requireCallerAccountId`
 * to resolve — so it takes `accountId` explicitly instead. Shares
 * `insertAccountImageIfNew` with `record` so dedupe semantics can't drift
 * between the live write path and the backfill.
 */
export const recordForAccount = internalMutation({
  args: {
    accountId: v.id("users"),
    imageKey: v.string(),
    source: accountImageSource,
    prompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { accountId, ...rest } = args;
    return await insertAccountImageIfNew(ctx, accountId, rest);
  },
});

/** One `accountImages` row's key + owner, for `listAllKeysForSweep`. */
type SweepRow = {
  imageKey: string;
  accountId: Id<"users">;
  source: "aiGenerated" | "userUpload" | "imageSearch";
};

/**
 * Read-only: every `accountImages` row's key + owning account + source, for
 * `scripts/sweep-cache-orphans.mjs` (phase-36 Task 6). Any R2 object whose key
 * shows up here is a library image — deliberately kept, not an orphan, no
 * matter what else does or doesn't reference it. The gallery's own Delete is
 * the only thing that removes a library image from R2.
 *
 * `.collect()` is safe at this scale (~100 rows for the only account today);
 * revisit if the table grows to the point a real sweep needs pagination.
 *
 * Internal: driven by the Convex CLI, which has no caller identity. Run:
 *   npx convex run accountImages:listAllKeysForSweep '{}' --no-push
 */
export const listAllKeysForSweep = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("accountImages").collect();
    const out: SweepRow[] = rows.map((row) => ({
      imageKey: row.imageKey,
      accountId: row.accountId,
      source: row.source,
    }));
    return out;
  },
});

/** One profileSymbols row's image key + source, for `listSymbolImageSourcesForAccount`. */
type SymbolImageSource = {
  imagePath: string;
  type: "imageSearch" | "aiGenerated" | "userUpload";
  aiPrompt?: string;
};

/**
 * Read-only: every `profileSymbols` row's image key + source type for one
 * account (plus `aiPrompt` for AI-generated ones), so
 * `scripts/backfill-account-images.mjs` can resolve `source`/`prompt` for an
 * R2 object under `accounts/<accountId>/images/` that a symbol still
 * references. An object nothing references falls back to `userUpload` in the
 * script — a display-hint guess, not a lookup key (see the `accountImages`
 * table's doc comment in `schema.ts`).
 */
export const listSymbolImageSourcesForAccount = internalQuery({
  args: { accountId: v.id("users") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("profileSymbols")
      .withIndex("by_account_id", (q) => q.eq("accountId", args.accountId))
      .collect();
    const out: SymbolImageSource[] = [];
    for (const row of rows) {
      const src = row.imageSource;
      if (src.type === "imageSearch" || src.type === "userUpload") {
        out.push({ imagePath: src.imagePath, type: src.type });
      } else if (src.type === "aiGenerated") {
        out.push({ imagePath: src.imagePath, type: src.type, aiPrompt: src.aiPrompt });
      }
    }
    return out;
  },
});
