import { internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { Id } from "./_generated/dataModel";
import { resolveCallerAccountId, requireCallerAccountId } from "./lib/account";

const accountImageSource = v.union(
  v.literal("aiGenerated"),
  v.literal("userUpload"),
  v.literal("imageSearch"),
);

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
