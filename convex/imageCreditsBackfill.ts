/**
 * Backfill + standing self-check for the image-credit registry (phase-31 Task 3).
 *
 * WHY A SEPARATE MODULE FROM `convex/imageCredits.ts`
 * `recordImageCredit` is caller-scoped: `requireCallerAccountId` writes only the
 * signed-in account's rows and THROWS when there is no caller identity — which
 * is exactly what `npx convex run` is. A backfill has to span every account and
 * runs from a terminal, so it cannot reuse it.
 *
 * AUTH MODEL — every function here is `internalQuery` / `internalMutation` /
 * `internalAction`. None of the three is part of the public `api` surface:
 * they are addressable only as `internal.*`, which the Convex client cannot
 * reference and the server refuses to run for a browser call. So an explicit
 * `accountId` argument — a cross-account write, which nothing in the public
 * API is allowed to be — is only ever reachable from a deploy-key-holding CLI
 * or another server-side function. Nothing here weakens the caller-scoped
 * public path; `recordImageCredit` is untouched. (Review-fix pass 2 promoted
 * `listBackfillAccounts` / `planAccountImageCredits` /
 * `checkAccountImageCreditCompleteness` from `internalQuery` to
 * `internalAction` so they can page through more than one query's worth of
 * data — see PAGINATION below. An `internalAction` is exactly as unreachable
 * from a browser as an `internalQuery`; only the `internal`/`api` split
 * matters for that, not which of the three internal kinds it is.)
 *
 * PAGINATION — Convex caps a single query/mutation EXECUTION at 16,384
 * documents / 8 MiB read, cumulative across every `ctx.db` call made during
 * that one execution. Two reads here used to be flat, unbounded `.collect()`
 * calls that could trip that ceiling as the app grows:
 *   1. `listBackfillAccounts`'s distinct-accountId sweep — a full scan of all
 *      six content tables, across every account. ~2,524 docs today; grows
 *      with every account, and it is the FIRST call in both the backfill and
 *      `--check`, so tripping it would stop the standing alarm from running
 *      at all.
 *   2. The per-account walk behind `planAccountImageCredits` /
 *      `checkAccountImageCreditCompleteness` — index-scoped to one account,
 *      but still unbounded within that scope (1,057 `profileSymbols` for the
 *      biggest account today).
 * Both are now paginated the same way `migrations.ts` already paginates
 * `backfillSearchTextPage` / `backfillSearchText`: a per-page `internalQuery`
 * bounded by `PAGE_SIZE`, driven by an `internalAction` that loops
 * `ctx.runQuery` with a cursor until `isDone`. Each `ctx.runQuery` call is its
 * own bounded transaction, so the total read across a whole sweep or a whole
 * account is never counted against one execution's ceiling, no matter how
 * large the table or the account gets. `MAX_PAGES_PER_TABLE` is a hard cap
 * (matching `backfillSearchText`'s "safety net against a runaway loop")
 * — at `PAGE_SIZE` this is orders of magnitude more headroom than any table
 * in this deployment needs today.
 *
 * THREE flat `.collect()` calls remain, deliberately left unpaginated
 * (review-fix pass 2, Finding 2 — this list was previously missing the
 * third and is now the authoritative count; keep it accurate if a fourth
 * ever gets added):
 *   1. `users` in `listBackfillAccounts` — bounded by family-account count,
 *      a much smaller and much slower-growing quantity than the content
 *      tables that motivated this fix.
 *   2. One account's own `imageCredits` rows, in `planAccountImageCredits` /
 *      `checkAccountImageCreditCompleteness` — bounded by the registry's own
 *      de-duplicated row count, same reasoning.
 *   3. `libraryModules` in `planLibraryModuleCredits`. NOTE (whole-phase
 *      review, Finding 4): this used to say "not the standing `--check`
 *      alarm — `--check` exits before this function is ever called, so a slow
 *      death here does not take the alarm down with it." That is no longer
 *      true — `--check` now runs this too, precisely because a module
 *      published with missing credits was the one gap the alarm could not
 *      see. So a limit trip HERE would take the standing alarm down with it,
 *      which raises the stakes on the re-evaluation below.
 *      Row count is small and stable (38 modules
 *      today), but `libraryModules` documents are the fattest in the
 *      deployment — whole item trees, 191 image placements across those 38
 *      rows today — so the binding constraint here is the 8 MiB
 *      per-execution READ cap, not the 16,384-document count cap the other
 *      two are safely far under. Left unpaginated because module count
 *      grows far slower than per-family content and a single module's item
 *      tree, not the table scan, would hit 8 MiB first if anything did —
 *      re-evaluate (paginate `libraryModules` too, same shape as the six
 *      content tables above) if module count or average module size grows
 *      materially from today's baseline.
 * If any of the three ever approaches its respective ceiling that is a
 * different, much later problem than the one this pass closes.
 *
 * The writes reuse `writeInstalledModuleCredits` (Task 2) rather than
 * re-implementing the insert, so the dedupe rule stays in exactly one place:
 * query `by_account_and_key`, SKIP if a row exists — first record wins, never a
 * patch, never a throw, never a delete.
 *
 * Read/write split is deliberate: everything the script needs in order to
 * PRINT a plan is a query or action, and the only two mutations that WRITE are
 * guarded behind the script's `--apply` flag.
 */

import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { imageCreditFields } from "./schema";
import type { CreditRow } from "./schema";
import {
  isCreditableAssetKey,
  isLegacySharedModuleAssetKey,
} from "./lib/contentModuleDelete";
import {
  collectModuleCredits,
  mergeModuleCredits,
  writeInstalledModuleCredits,
} from "./lib/moduleCredits";
import {
  symbolRefs,
  listRefs,
  sentenceRefs,
  phraseRefs,
  coverRef,
  collectModuleImageRefs,
  mergeByKey,
  classifyMergedImage,
  creditRowFromMergedImage,
  type ImageRef,
  type MergedImage,
  type WalkedRowCounts,
} from "./lib/imageCreditRefs";

/** Rows per page for every paginated read in this file — see PAGINATION above. */
const PAGE_SIZE = 1000;
/** Safety net against a runaway loop, matching `migrations.backfillSearchText`. */
const MAX_PAGES_PER_TABLE = 500;

// ─── Grouping + classification ──────────────────────────────────────────────
//
// `MergedImage`, `mergeByKey`, `classifyMergedImage` and
// `creditRowFromMergedImage` MOVED to `./lib/imageCreditRefs` (phase-31
// whole-phase review, Finding 1). PUBLISH now applies the same "does this
// placement earn a credit, and what does it say?" rule when the registry
// lookup misses, and publish lives in `convex/lib` — it cannot import from
// this file, which is a Convex FUNCTION module. One copy of a licence rule,
// three call sites.

/** Which bucket a key lands in. The six content buckets partition the scan
 * exactly — every unique key gets one and only one. The last four delegate to
 * `classifyMergedImage`; the first two are questions only a caller can answer
 * (namespace, and whether a row already exists). */
type Bucket =
  /** Would get a new registry row. */
  | "create"
  /** A registry row already exists for (account, key). */
  | "present"
  /** Key lives outside the creditable namespaces — SymbolStix `symbols/…`,
   * the AI cache, TTS audio. Licensed wholesale or not third-party at all. */
  | "byDesignShared"
  /** Creditable namespace, but the row says `upload` or `symbolstix` — the
   * owner's 2026-08-25 decision to keep uploads out of the registry. */
  | "byDesignUpload"
  /** Row says `imageSearch` but carries NO attribution, licence or source URL.
   * Phase 29-era saves that predate the attribution work. Permanently lost —
   * reported, never invented, and deliberately given NO thin registry row, so
   * the completeness check keeps surfacing it instead of masking it. */
  | "imageSearchNoCredit"
  /** Creditable namespace, no type recorded anywhere — covers and talker-built
   * slots. Could be a legitimate upload or a lost credit; a human decides. */
  | "unknownNoType";

function bucketFor(image: MergedImage, alreadyPresent: boolean): Bucket {
  if (!isCreditableAssetKey(image.imageKey)) return "byDesignShared";
  if (alreadyPresent) return "present";
  const classification = classifyMergedImage(image);
  // The two recordable classes are the ones that earn a row.
  return classification === "imageSearch" || classification === "aiGenerated"
    ? "create"
    : classification;
}

// ─── Pagination primitives — see PAGINATION at the top of this file ─────────

/** Shared shape returned by every per-table page query below.
 *
 * `accountIds` is `| null`, never `| undefined` (review-fix pass 2, Finding
 * 1) — Convex arrays cannot contain `undefined` (`convexToJsonInternal`
 * throws `"undefined is not a valid Convex value"` on any `undefined`
 * element; objects silently drop absent keys, arrays do not). `accountId` is
 * `v.optional(v.id("users"))` on all six content tables, so a legacy
 * pre-migration row without one is exactly the case this query has to be
 * able to return without crashing — that is the row `rowsWithNoAccountId`
 * below exists to count. */
type RefsPageResult = {
  refs: ImageRef[];
  accountIds: Array<Id<"users"> | null>;
  rowsInPage: number;
  isDone: boolean;
  continueCursor: string;
};

const pageArgs = {
  // Present → scoped to one account via `by_account_id` (the per-account walk).
  // Absent  → a full, unfiltered table scan, one page at a time (the
  // distinct-accountId sweep). Same six queries serve both callers.
  accountId: v.optional(v.id("users")),
  cursor: v.optional(v.union(v.string(), v.null())),
  pageSize: v.optional(v.number()),
  // Review-fix pass 2, Finding 3: the distinct-accountId sweep
  // (`listBackfillAccounts`) only ever reads `accountIds` and `rowsInPage`
  // off the returned page — it throws `refs` away. Without this flag every
  // `ImageRef` in the deployment (attribution + source-URL strings included)
  // gets computed and serialized query→action on every backfill and every
  // `--check` run, purely to be discarded, on a metered Convex plan. Set by
  // the sweep only; the per-account walk (`collectAccountRefsPaginated`,
  // which DOES need `refs`) leaves it unset.
  idsOnly: v.optional(v.boolean()),
};

export const pageProfileSymbolsForCredits = internalQuery({
  args: pageArgs,
  handler: async (ctx, args): Promise<RefsPageResult> => {
    const accountId = args.accountId;
    const q = accountId
      ? ctx.db.query("profileSymbols").withIndex("by_account_id", (qq) => qq.eq("accountId", accountId))
      : ctx.db.query("profileSymbols");
    const page = await q.paginate({ cursor: args.cursor ?? null, numItems: args.pageSize ?? PAGE_SIZE });
    return {
      refs: args.idsOnly ? [] : page.page.flatMap(symbolRefs),
      accountIds: page.page.map((d) => d.accountId ?? null),
      rowsInPage: page.page.length,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

export const pageProfileListsForCredits = internalQuery({
  args: pageArgs,
  handler: async (ctx, args): Promise<RefsPageResult> => {
    const accountId = args.accountId;
    const q = accountId
      ? ctx.db.query("profileLists").withIndex("by_account_id", (qq) => qq.eq("accountId", accountId))
      : ctx.db.query("profileLists");
    const page = await q.paginate({ cursor: args.cursor ?? null, numItems: args.pageSize ?? PAGE_SIZE });
    return {
      refs: args.idsOnly ? [] : page.page.flatMap(listRefs),
      accountIds: page.page.map((d) => d.accountId ?? null),
      rowsInPage: page.page.length,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

export const pageProfileSentencesForCredits = internalQuery({
  args: pageArgs,
  handler: async (ctx, args): Promise<RefsPageResult> => {
    const accountId = args.accountId;
    const q = accountId
      ? ctx.db.query("profileSentences").withIndex("by_account_id", (qq) => qq.eq("accountId", accountId))
      : ctx.db.query("profileSentences");
    const page = await q.paginate({ cursor: args.cursor ?? null, numItems: args.pageSize ?? PAGE_SIZE });
    return {
      refs: args.idsOnly ? [] : page.page.flatMap(sentenceRefs),
      accountIds: page.page.map((d) => d.accountId ?? null),
      rowsInPage: page.page.length,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

export const pageProfilePhrasesForCredits = internalQuery({
  args: pageArgs,
  handler: async (ctx, args): Promise<RefsPageResult> => {
    const accountId = args.accountId;
    const q = accountId
      ? ctx.db.query("profilePhrases").withIndex("by_account_id", (qq) => qq.eq("accountId", accountId))
      : ctx.db.query("profilePhrases");
    const page = await q.paginate({ cursor: args.cursor ?? null, numItems: args.pageSize ?? PAGE_SIZE });
    return {
      refs: args.idsOnly ? [] : page.page.flatMap(phraseRefs),
      accountIds: page.page.map((d) => d.accountId ?? null),
      rowsInPage: page.page.length,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

export const pageProfileCategoriesForCredits = internalQuery({
  args: pageArgs,
  handler: async (ctx, args): Promise<RefsPageResult> => {
    const accountId = args.accountId;
    const q = accountId
      ? ctx.db.query("profileCategories").withIndex("by_account_id", (qq) => qq.eq("accountId", accountId))
      : ctx.db.query("profileCategories");
    const page = await q.paginate({ cursor: args.cursor ?? null, numItems: args.pageSize ?? PAGE_SIZE });
    return {
      refs: args.idsOnly ? [] : page.page.flatMap((c) => coverRef(c, "profileCategories.imagePath")),
      accountIds: page.page.map((d) => d.accountId ?? null),
      rowsInPage: page.page.length,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

export const pageProfileFoldersForCredits = internalQuery({
  args: pageArgs,
  handler: async (ctx, args): Promise<RefsPageResult> => {
    const accountId = args.accountId;
    const q = accountId
      ? ctx.db.query("profileFolders").withIndex("by_account_id", (qq) => qq.eq("accountId", accountId))
      : ctx.db.query("profileFolders");
    const page = await q.paginate({ cursor: args.cursor ?? null, numItems: args.pageSize ?? PAGE_SIZE });
    return {
      refs: args.idsOnly ? [] : page.page.flatMap((f) => coverRef(f, "profileFolders.imagePath")),
      accountIds: page.page.map((d) => d.accountId ?? null),
      rowsInPage: page.page.length,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

/**
 * `users` and one account's own `imageCredits` rows are deliberately NOT
 * paginated — see the "THREE flat `.collect()` calls remain" note at the top
 * of this file (items 1 and 2 of 3) for why that is an accepted,
 * much-later-problem bound rather than an oversight.
 */
export const listAllUsers = internalQuery({
  args: {},
  handler: async (ctx): Promise<Doc<"users">[]> => ctx.db.query("users").collect(),
});

export const listAccountCreditKeys = internalQuery({
  args: { accountId: v.id("users") },
  handler: async (ctx, args): Promise<string[]> => {
    const rows = await ctx.db
      .query("imageCredits")
      .withIndex("by_account_and_key", (q) => q.eq("accountId", args.accountId))
      .collect();
    return rows.map((r) => r.imageKey);
  },
});

/** One of the six paginated per-table queries above, all sharing `pageArgs` in → `RefsPageResult` out. */
type RefsPageFn = typeof internal.imageCreditsBackfill.pageProfileSymbolsForCredits;

const REF_PAGE_TABLES: ReadonlyArray<{ table: keyof WalkedRowCounts; fn: RefsPageFn }> = [
  { table: "profileSymbols", fn: internal.imageCreditsBackfill.pageProfileSymbolsForCredits },
  { table: "profileLists", fn: internal.imageCreditsBackfill.pageProfileListsForCredits },
  { table: "profileSentences", fn: internal.imageCreditsBackfill.pageProfileSentencesForCredits },
  { table: "profilePhrases", fn: internal.imageCreditsBackfill.pageProfilePhrasesForCredits },
  { table: "profileCategories", fn: internal.imageCreditsBackfill.pageProfileCategoriesForCredits },
  { table: "profileFolders", fn: internal.imageCreditsBackfill.pageProfileFoldersForCredits },
];

/**
 * Loop one paginated per-table query to exhaustion, calling `onPage` for every
 * page. `MAX_PAGES_PER_TABLE` is a hard stop against a runaway loop — the same
 * safety net `migrations.backfillSearchText` uses around its own cursor loop.
 */
async function pageThroughTable(
  ctx: ActionCtx,
  fn: RefsPageFn,
  accountId: Id<"users"> | undefined,
  onPage: (page: RefsPageResult) => void,
  // Review-fix pass 2, Finding 3: true only for the distinct-accountId sweep
  // (`listBackfillAccounts`), which reads `page.accountIds` /
  // `page.rowsInPage` and never touches `page.refs` — see `pageArgs.idsOnly`.
  idsOnly = false,
): Promise<void> {
  let cursor: string | null = null;
  let isDone = false;
  let pages = 0;
  while (!isDone) {
    if (++pages > MAX_PAGES_PER_TABLE) {
      throw new Error(
        `imageCreditsBackfill: runaway pagination loop (>${MAX_PAGES_PER_TABLE} pages) — a table has grown far beyond what PAGE_SIZE=${PAGE_SIZE} was sized for.`,
      );
    }
    const page: RefsPageResult = await ctx.runQuery(fn, { accountId, cursor, pageSize: PAGE_SIZE, idsOnly });
    onPage(page);
    isDone = page.isDone;
    cursor = page.continueCursor;
  }
}

/**
 * Every image placement in ONE account's content, in table order — the
 * paginated replacement for the old (unbounded) `collectAccountImageRefs`.
 * Bounded per page rather than per account, so this never trips the
 * per-execution ceiling no matter how large one account's content gets.
 */
async function collectAccountRefsPaginated(
  ctx: ActionCtx,
  accountId: Id<"users">,
): Promise<{ refs: ImageRef[]; rowsWalked: WalkedRowCounts }> {
  const refs: ImageRef[] = [];
  const rowsWalked: WalkedRowCounts = {
    profileSymbols: 0,
    profileLists: 0,
    profileSentences: 0,
    profilePhrases: 0,
    profileCategories: 0,
    profileFolders: 0,
  };

  for (const { table, fn } of REF_PAGE_TABLES) {
    await pageThroughTable(ctx, fn, accountId, (page) => {
      refs.push(...page.refs);
      rowsWalked[table] += page.rowsInPage;
    });
  }

  return { refs, rowsWalked };
}

// ─── Account backfill ────────────────────────────────────────────────────────

/**
 * Every account the backfill should visit — the UNION of the `users` table and
 * every distinct `accountId` the content tables actually reference.
 *
 * Enumerating `users` alone is not enough, and this is not theoretical: on
 * 2026-08-25 the six content tables referenced TEN distinct account ids while
 * `users` held two. The other eight are content left behind by deleted
 * accounts — `profilePhrases` and `profileFolders` rows whose owner row is
 * gone. A `users`-only walk reports a tidy reconciliation and silently never
 * looks at them, which is exactly the kind of blind spot the completeness
 * check exists to prevent. `hasUserRow: false` marks them so the caller can
 * report them separately instead of mixing dead content into live totals.
 *
 * The distinct-accountId sweep is a full scan of the six tables — there is no
 * index that yields distinct values. It stays automatic (runs on every
 * invocation, not behind an opt-in flag) so a newly-orphaned account is caught
 * the next time anyone runs the backfill or `--check`, not only when someone
 * remembers to ask for a resweep — see PAGINATION above for how it stays
 * bounded regardless of table size.
 */
export const listBackfillAccounts = internalAction({
  args: {},
  handler: async (ctx) => {
    const users: Doc<"users">[] = await ctx.runQuery(internal.imageCreditsBackfill.listAllUsers, {});
    const byId = new Map<
      string,
      { accountId: Id<"users">; email: string; name: string; hasUserRow: boolean }
    >();
    for (const u of users) {
      byId.set(u._id, {
        accountId: u._id,
        email: u.email ?? "",
        name: u.name ?? "",
        hasUserRow: true,
      });
    }

    // A row whose `accountId` is absent altogether (the field is still
    // `v.optional` for pre-migration rows) belongs to no account and can never
    // receive a registry row — counted so the caller can say so out loud.
    let rowsWithNoAccountId = 0;
    for (const { fn } of REF_PAGE_TABLES) {
      // idsOnly: true — this sweep only ever reads `accountIds` /
      // `rowsInPage` below, never `page.refs` (Finding 3: skips computing
      // and serializing every ImageRef in the deployment, including
      // attribution/source-URL strings, purely to discard it).
      await pageThroughTable(
        ctx,
        fn,
        undefined,
        (page) => {
          for (const accountId of page.accountIds) {
            if (!accountId) {
              rowsWithNoAccountId++;
              continue;
            }
            if (!byId.has(accountId)) {
              byId.set(accountId, { accountId, email: "", name: "", hasUserRow: false });
            }
          }
        },
        true,
      );
    }

    const accounts = [...byId.values()].sort(
      (a, b) => Number(b.hasUserRow) - Number(a.hasUserRow) || a.accountId.localeCompare(b.accountId),
    );
    return { accounts, rowsWithNoAccountId };
  },
});

/**
 * What the backfill WOULD write for one account, plus the reconciliation.
 *
 * Read-only. The script prints this; only `applyAccountImageCredits` writes.
 *
 * LEGACY `library_packs/` KEYS ARE SKIPPED, NOT CREDITED, HERE TOO (fix pass
 * 2 — the module-artifact skip in `planLibraryModuleCredits` above had no
 * account-side twin, and the collision it guards against is live on the
 * account walk as well). `library_packs/…` keys ARE creditable
 * (`isCreditableAssetKey` composes `isLegacySharedModuleAssetKey`), and an
 * INSTALLED copy of `space` points at the very same shared R2 objects the
 * admin's own `space` category does — so an account that has `space`
 * installed walks straight into the 15+1 `library_packs/space/images/…`
 * keys during this scan. Recording them now creates the identical
 * unrecoverable duplicate: once `space` is re-published onto
 * `library_modules/` and reinstalled, `writeInstalledModuleCredits` inserts
 * a SECOND row under the new `library_modules/…` key, `getAccountImageCredits`
 * returns both unfiltered, and after `library_packs/` is deleted one of the
 * two renders as the `ImageOff` placeholder forever — there is no delete path
 * for `imageCredits` rows, so a written row cannot later be taken back.
 *
 * The asymmetry that decides this: skipping here creates a TEMPORARY gap
 * (these images are simply absent from the Credits screen until `space` is
 * re-published and reinstalled, which is already scheduled and which
 * self-heals the gap the moment it happens, the same way Finding 1's publish
 * fallback already lets a re-publish embed correct credits from an
 * un-backfilled registry) — versus a PERMANENT, unrepairable duplicate on
 * every account that ever installs `space` from here on. A temporary
 * under-listing on the handful of accounts that currently have `space`
 * installed beats a permanent mess on all of them forever.
 *
 * Skipped before classification, exactly like `planLibraryModuleCredits`, and
 * counted in its own `legacyPrefixSkipped` bucket rather than folded into
 * `byDesignShared` — an exclusion stays visible, not silent. `totalImages`
 * still counts every merged image (skipped ones included), so the
 * reconciliation sum keeps balancing.
 */
export const planAccountImageCredits = internalAction({
  args: { accountId: v.id("users") },
  handler: async (ctx, args) => {
    const { refs, rowsWalked } = await collectAccountRefsPaginated(ctx, args.accountId);
    const merged = mergeByKey(refs);
    const existingKeys = new Set(
      await ctx.runQuery(internal.imageCreditsBackfill.listAccountCreditKeys, { accountId: args.accountId }),
    );

    const counts = {
      totalPlacements: refs.length,
      totalImages: merged.length,
      create: 0,
      present: 0,
      byDesignShared: 0,
      byDesignUpload: 0,
      imageSearchNoCredit: 0,
      unknownNoType: 0,
      legacyPrefixSkipped: 0,
    };
    const proposals: CreditRow[] = [];
    // Arrays, never objects keyed by user text — a Hindi label as a key
    // crashes Convex serialisation.
    const lostCredit: Array<{ imageKey: string; label: string; foundIn: string }> = [];

    for (const image of merged) {
      // See LEGACY `library_packs/` KEYS above — skipped before
      // classification, same as the module-artifact plan.
      if (isLegacySharedModuleAssetKey(image.imageKey)) {
        counts.legacyPrefixSkipped++;
        continue;
      }
      const present = existingKeys.has(image.imageKey);
      const bucket = bucketFor(image, present);
      counts[bucket]++;
      if (bucket === "create") {
        const row = creditRowFromMergedImage(image);
        if (row) proposals.push(row);
      }
      if (bucket === "imageSearchNoCredit") {
        lostCredit.push({
          imageKey: image.imageKey,
          label: image.label ?? "",
          foundIn: image.foundIn.join(", "),
        });
      }
    }

    return { counts, rowsWalked, proposals, lostCredit };
  },
});

/**
 * Insert the planned rows into ONE account's registry.
 *
 * Only reached from the script's `--apply` path. `writeInstalledModuleCredits`
 * carries the dedupe (skip on collision, first record wins), so re-running is a
 * no-op and nothing is ever patched or deleted.
 */
export const applyAccountImageCredits = internalMutation({
  args: {
    accountId: v.id("users"),
    credits: v.array(v.object(imageCreditFields)),
  },
  handler: async (ctx, args) => {
    const inserted = await writeInstalledModuleCredits(ctx, args.accountId, args.credits);
    return { inserted, skipped: args.credits.length - inserted };
  },
});

/**
 * THE STANDING SELF-CHECK — "is there an image in use whose credit we lost?"
 *
 * Independent of the backfill plan: it reports the registry's state RIGHT NOW,
 * so it stays meaningful long after this phase, and is how a save path that
 * forgets to call `recordImageCredit` gets caught.
 *
 * FOUR buckets (fix pass 2 added the fourth — review-fix pass 2 had already
 * added the third; see below):
 *   `definitelyLost`     — the row says `imageSearch`, no registry row exists.
 *                          Split into recoverable-via-backfill vs permanently
 *                          lost by `hasRecoverableCredit` (Finding 2 — the
 *                          bucket name stays, the script's summary line is
 *                          what has to stop calling every entry "lost").
 *   `aiGeneratedMissing` — the row says `aiGenerated`, no registry row exists.
 *                          Always recoverable via backfill: unlike
 *                          `imageSearch`, an `aiGenerated` placement never
 *                          carries a licence/attribution that could be absent,
 *                          so there is no "permanent" variant of this bucket.
 *   `unknown`            — no type on any placement (covers, talker-built
 *                          slots), so an absent row could be a legitimate
 *                          upload or a lost credit. Should stay short enough
 *                          to eyeball; if it does not, recording uploads is
 *                          the fix.
 *   `deferredLegacyPrefix` — a `library_packs/…` key with no registry row.
 *                          NOT reported as lost, missing, or unknown — it is
 *                          a DELIBERATE, TEMPORARY exclusion mirroring
 *                          `planAccountImageCredits`'s `legacyPrefixSkipped`
 *                          (fix pass 2, same collision: `space` is scheduled
 *                          to be re-published onto `library_modules/` and
 *                          `library_packs/` deleted, and backfilling these
 *                          now would leave a permanent duplicate no delete
 *                          path can remove). Self-heals to zero the moment
 *                          `space` is re-published and reinstalled and the
 *                          backfill is re-run against the new keys — see the
 *                          `library_packs/` retirement checklist in
 *                          `docs/4-builds/plans/phase-31-image-credit-registry-plan.md`.
 *                          Read this as "deferred until `space` is re-keyed,"
 *                          never as a gap needing action today — a standing
 *                          alarm firing on a deliberate deferral is exactly
 *                          the wolf-cry problem review-fix pass 2's third
 *                          bucket was added to avoid repeating.
 * `upload` / `symbolstix` placements fall through all four, on purpose —
 * matching `bucketFor`'s `byDesignUpload` bucket in the backfill plan; an
 * upload is never expected to have a registry row.
 */
export const checkAccountImageCreditCompleteness = internalAction({
  args: { accountId: v.id("users") },
  handler: async (ctx, args) => {
    const { refs } = await collectAccountRefsPaginated(ctx, args.accountId);
    const merged = mergeByKey(refs);
    const existingKeys = new Set(
      await ctx.runQuery(internal.imageCreditsBackfill.listAccountCreditKeys, { accountId: args.accountId }),
    );

    const definitelyLost: Array<{ imageKey: string; label: string; foundIn: string; hasRecoverableCredit: boolean }> = [];
    const aiGeneratedMissing: Array<{ imageKey: string; label: string; foundIn: string }> = [];
    const unknown: Array<{ imageKey: string; label: string; foundIn: string }> = [];
    const deferredLegacyPrefix: Array<{ imageKey: string; label: string; foundIn: string }> = [];

    for (const image of merged) {
      if (!isCreditableAssetKey(image.imageKey)) continue;
      if (existingKeys.has(image.imageKey)) continue;

      // See `deferredLegacyPrefix` above — checked before the type dispatch
      // so a `library_packs/` key never lands in `definitelyLost` /
      // `aiGeneratedMissing` / `unknown` and cannot read as a live gap.
      if (isLegacySharedModuleAssetKey(image.imageKey)) {
        deferredLegacyPrefix.push({
          imageKey: image.imageKey,
          label: image.label ?? "",
          foundIn: image.foundIn.join(", "),
        });
        continue;
      }

      if (image.sourceType === "imageSearch") {
        definitelyLost.push({
          imageKey: image.imageKey,
          label: image.label ?? "",
          foundIn: image.foundIn.join(", "),
          hasRecoverableCredit: Boolean(
            image.attribution || image.license || image.imageSourceUrl,
          ),
        });
      } else if (image.sourceType === "aiGenerated") {
        aiGeneratedMissing.push({
          imageKey: image.imageKey,
          label: image.label ?? "",
          foundIn: image.foundIn.join(", "),
        });
      } else if (image.sourceType === undefined) {
        unknown.push({
          imageKey: image.imageKey,
          label: image.label ?? "",
          foundIn: image.foundIn.join(", "),
        });
      }
    }

    return { definitelyLost, aiGeneratedMissing, unknown, deferredLegacyPrefix };
  },
});

// ─── Publish preview (read-only) ─────────────────────────────────────────────

/**
 * EXACTLY what a publish of `source` would embed in the module artifact, without
 * publishing anything (phase-31 whole-phase review, Finding 1).
 *
 * Why this exists: `collectModuleCredits` is only ever reached from a publish
 * MUTATION, so before this there was no way to see its output except by
 * publishing — which is irreversible in the way that matters, because a
 * module's `credits` array is append-only. A registry-miss fallback that has
 * never been observed is a fallback nobody can trust. This calls the real
 * function, on real rows, and returns its real result.
 *
 * `assetPathMap` is the same source-key → promoted-key map
 * `/api/admin/promote-module-assets` hands the publish mutation. Pass the real
 * one to preview an actual publish; pass a synthetic one to prove THE REMAP
 * reaches every credit row, fallback rows included. Omit it and keys pass
 * through unchanged, exactly as a publish without promotion does.
 *
 * `internalQuery`, and a query cannot write: unreachable from a browser and
 * incapable of changing anything even if it were.
 */
export const previewModuleCredits = internalQuery({
  args: {
    accountId: v.id("users"),
    tree: v.union(
      v.literal("categories"),
      v.literal("lists"),
      v.literal("sentences"),
      v.literal("phrases"),
    ),
    sourceId: v.string(),
    assetPathMap: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, args): Promise<{ credits: CreditRow[] }> => {
    const credits = await collectModuleCredits(
      ctx,
      args.accountId,
      { tree: args.tree, sourceId: args.sourceId },
      args.assetPathMap,
    );
    return { credits };
  },
});

// ─── Published-module artifacts ──────────────────────────────────────────────

/**
 * What the backfill WOULD add to each published module's travelling `credits`
 * array.
 *
 * Modules are global (no `accountId`), so their credit cannot go into the
 * per-account registry — it goes on the artifact, which is where an install
 * reads it from (`writeInstalledModuleCredits`). The 38 modules published
 * before phase-31 carry `credits: undefined`; their per-placement attribution
 * is the only record, and because a module's credits are effectively immutable
 * once written (publish merges existing-wins, install skips on collision), this
 * is the only path that ever reaches a future installer.
 *
 * Keys are already the promoted `library_modules/…` keys, so no remap is needed
 * here — unlike `collectModuleCredits`, which starts from the admin's source
 * keys and must go through `assetPathMap`.
 *
 * LEGACY `library_packs/` KEYS ARE SKIPPED, NOT CREDITED (phase-31 whole-phase
 * review, Finding 3a). Exactly one module — `categories/space` — still holds
 * its images under the retired pack-era prefix, and it is scheduled to be
 * re-published onto `library_modules/` so that prefix can be deleted wholesale
 * (ADR-022 amendment, 2026-08-24). Writing its 15 credits under the old keys
 * now would be unrecoverable: `mergeModuleCredits` is EXISTING-WINS by
 * `imageKey`, so on the re-publish the 15 dead keys would survive ALONGSIDE
 * the 15 new ones, and every account that installed or reinstalled `space`
 * afterwards would get both sets — each space photo listed twice on the
 * Credits screen, one copy with a 404 thumbnail. Nothing in the phase can
 * remove them again; the artifact `credits` array is deliberately append-only.
 *
 * Nothing is lost by skipping. The credit is not in the registry, it is on the
 * source rows, and since Finding 1 `collectModuleCredits` falls back to those
 * rows when the registry misses — so the re-publish embeds the same 15
 * credits, correctly keyed to the new `library_modules/categories/space/…`
 * objects, whether or not the backfill ever ran. The alternative (write them
 * now, strip them after the re-publish) needs a new destructive mutation
 * against the one array this phase made append-only, plus another unenforced
 * human step — the exact failure mode Finding 1 exists to remove.
 *
 * They are counted in their own `legacyPrefixSkipped` bucket rather than
 * folded into `byDesignShared`, so the reconciliation still shows them and a
 * reader can see the decision rather than infer it from a missing number.
 */
export const planLibraryModuleCredits = internalQuery({
  args: {},
  handler: async (ctx) => {
    const modules = await ctx.db.query("libraryModules").collect();

    const counts = {
      modules: modules.length,
      modulesWouldChange: 0,
      totalImages: 0,
      create: 0,
      present: 0,
      byDesignShared: 0,
      byDesignUpload: 0,
      imageSearchNoCredit: 0,
      unknownNoType: 0,
      legacyPrefixSkipped: 0,
    };
    const plans: Array<{
      moduleId: Id<"libraryModules">;
      tree: string;
      slug: string;
      existing: number;
      credits: CreditRow[];
    }> = [];

    for (const mod of modules) {
      const merged = mergeByKey(collectModuleImageRefs(mod));
      const existing = mod.credits ?? [];
      const existingKeys = new Set(existing.map((c) => c.imageKey));
      const credits: CreditRow[] = [];

      counts.totalImages += merged.length;
      for (const image of merged) {
        // See LEGACY `library_packs/` KEYS above — skipped before
        // classification, so the whole retired prefix is one visible number
        // rather than smeared across four buckets.
        if (isLegacySharedModuleAssetKey(image.imageKey)) {
          counts.legacyPrefixSkipped++;
          continue;
        }
        const bucket = bucketFor(image, existingKeys.has(image.imageKey));
        counts[bucket]++;
        if (bucket === "create") {
          const row = creditRowFromMergedImage(image);
          if (row) credits.push(row);
        }
      }

      if (credits.length > 0) {
        counts.modulesWouldChange++;
        plans.push({
          moduleId: mod._id,
          tree: mod.tree,
          slug: mod.slug,
          existing: existing.length,
          credits,
        });
      }
    }

    return { counts, plans };
  },
});

/**
 * Merge planned credits onto ONE module artifact.
 *
 * `mergeModuleCredits` is existing-wins by `imageKey`, so this can only ADD —
 * it can never overwrite or drop a credit the module already carried.
 */
export const applyLibraryModuleCredits = internalMutation({
  args: {
    moduleId: v.id("libraryModules"),
    credits: v.array(v.object(imageCreditFields)),
  },
  handler: async (ctx, args) => {
    const mod = await ctx.db.get(args.moduleId);
    if (!mod) return { added: 0 };
    const before = mod.credits?.length ?? 0;
    const merged = mergeModuleCredits(mod.credits, args.credits);
    if (!merged) return { added: 0 };
    await ctx.db.patch(args.moduleId, { credits: merged });
    return { added: merged.length - before };
  },
});
