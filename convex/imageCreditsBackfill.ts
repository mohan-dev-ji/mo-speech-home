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
 * The two remaining flat `.collect()` calls — `users` in `listBackfillAccounts`
 * and one account's own `imageCredits` rows in `planAccountImageCredits` /
 * `checkAccountImageCreditCompleteness` — are deliberately left unpaginated.
 * Both are bounded by a much smaller, much slower-growing quantity (family
 * accounts; the registry's own de-duplicated row count) than the content
 * tables that motivated this fix, not by the same per-family content volume.
 * If either ever approaches the ceiling that is a different, much later
 * problem than the one this pass closes.
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
import { isCreditableAssetKey } from "./lib/contentModuleDelete";
import { mergeModuleCredits, writeInstalledModuleCredits } from "./lib/moduleCredits";
import {
  symbolRefs,
  listRefs,
  sentenceRefs,
  phraseRefs,
  coverRef,
  collectModuleImageRefs,
  type ImageRef,
  type PlacementSourceType,
  type WalkedRowCounts,
} from "./lib/imageCreditRefs";

/** Rows per page for every paginated read in this file — see PAGINATION above. */
const PAGE_SIZE = 1000;
/** Safety net against a runaway loop, matching `migrations.backfillSearchText`. */
const MAX_PAGES_PER_TABLE = 500;

// ─── Grouping + classification (pure) ────────────────────────────────────────

/** One R2 object key, with the union of everything its placements remember. */
type MergedImage = {
  imageKey: string;
  sourceType?: PlacementSourceType;
  attribution?: string;
  license?: string;
  imageSourceUrl?: string;
  label?: string;
  foundIn: string[];
};

/**
 * Collapse placements onto their R2 key — the registry's unit is the object,
 * not the placement, so a symbol and the three talker slots that reuse it are
 * ONE image.
 *
 * Field-by-field first-defined-wins, with one deliberate exception: a
 * RECORDABLE `sourceType` (`imageSearch` / `aiGenerated`) beats a non-recordable
 * one no matter which placement was walked first. A key that one row calls
 * `upload` and another calls `imageSearch` is a row that lost its type
 * somewhere, and the asymmetry is intentional — the cost of wrongly recording
 * an upload is one thin registry row, the cost of wrongly skipping an
 * image-search pick is a licence obligation with nothing left to recover it
 * from.
 */
function mergeByKey(refs: readonly ImageRef[]): MergedImage[] {
  const byKey = new Map<string, MergedImage>();
  const recordable = (t: PlacementSourceType | undefined) =>
    t === "imageSearch" || t === "aiGenerated";

  for (const ref of refs) {
    let merged = byKey.get(ref.imageKey);
    if (!merged) {
      merged = { imageKey: ref.imageKey, foundIn: [] };
      byKey.set(ref.imageKey, merged);
    }
    if (ref.sourceType && (!merged.sourceType || (recordable(ref.sourceType) && !recordable(merged.sourceType)))) {
      merged.sourceType = ref.sourceType;
    }
    if (!merged.attribution && ref.attribution) merged.attribution = ref.attribution;
    if (!merged.license && ref.license) merged.license = ref.license;
    if (!merged.imageSourceUrl && ref.imageSourceUrl) merged.imageSourceUrl = ref.imageSourceUrl;
    if (!merged.label && ref.label) merged.label = ref.label;
    if (!merged.foundIn.includes(ref.foundIn)) merged.foundIn.push(ref.foundIn);
  }

  return [...byKey.values()].sort((a, b) => a.imageKey.localeCompare(b.imageKey));
}

/** Which bucket a key lands in. The five content buckets partition the scan
 * exactly — every unique key gets one and only one. */
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
  switch (image.sourceType) {
    case "imageSearch":
      return image.attribution || image.license || image.imageSourceUrl
        ? "create"
        : "imageSearchNoCredit";
    case "aiGenerated":
      return "create";
    case "upload":
    case "symbolstix":
      return "byDesignUpload";
    default:
      return "unknownNoType";
  }
}

/** Project a merged image onto the registry row it would become. Only ever
 * called for a `create` bucket, so the source type is one of the two the
 * registry accepts. `imageTitle` is absent by construction — phase-30 stored no
 * title on a placement, so there is none to lift. */
function toCreditRow(image: MergedImage): CreditRow {
  return {
    imageKey: image.imageKey,
    imageSourceType: image.sourceType === "aiGenerated" ? "aiGenerated" : "imageSearch",
    ...(image.attribution ? { attribution: image.attribution } : {}),
    ...(image.license ? { license: image.license } : {}),
    ...(image.imageSourceUrl ? { imageSourceUrl: image.imageSourceUrl } : {}),
    ...(image.label ? { firstUsedFor: image.label } : {}),
  };
}

// ─── Pagination primitives — see PAGINATION at the top of this file ─────────

/** Shared shape returned by every per-table page query below. */
type RefsPageResult = {
  refs: ImageRef[];
  accountIds: Array<Id<"users"> | undefined>;
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
      refs: page.page.flatMap(symbolRefs),
      accountIds: page.page.map((d) => d.accountId),
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
      refs: page.page.flatMap(listRefs),
      accountIds: page.page.map((d) => d.accountId),
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
      refs: page.page.flatMap(sentenceRefs),
      accountIds: page.page.map((d) => d.accountId),
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
      refs: page.page.flatMap(phraseRefs),
      accountIds: page.page.map((d) => d.accountId),
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
      refs: page.page.flatMap((c) => coverRef(c, "profileCategories.imagePath")),
      accountIds: page.page.map((d) => d.accountId),
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
      refs: page.page.flatMap((f) => coverRef(f, "profileFolders.imagePath")),
      accountIds: page.page.map((d) => d.accountId),
      rowsInPage: page.page.length,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

/**
 * `users` and one account's own `imageCredits` rows are deliberately NOT
 * paginated — see the "two remaining flat `.collect()` calls" note at the top
 * of this file for why that is an accepted, much-later-problem bound rather
 * than an oversight.
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
    const page: RefsPageResult = await ctx.runQuery(fn, { accountId, cursor, pageSize: PAGE_SIZE });
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
      await pageThroughTable(ctx, fn, undefined, (page) => {
        for (const accountId of page.accountIds) {
          if (!accountId) {
            rowsWithNoAccountId++;
            continue;
          }
          if (!byId.has(accountId)) {
            byId.set(accountId, { accountId, email: "", name: "", hasUserRow: false });
          }
        }
      });
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
    };
    const proposals: CreditRow[] = [];
    // Arrays, never objects keyed by user text — a Hindi label as a key
    // crashes Convex serialisation.
    const lostCredit: Array<{ imageKey: string; label: string; foundIn: string }> = [];

    for (const image of merged) {
      const present = existingKeys.has(image.imageKey);
      const bucket = bucketFor(image, present);
      counts[bucket]++;
      if (bucket === "create") proposals.push(toCreditRow(image));
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
 * THREE buckets (review-fix pass 2 added the third — the original plan named
 * only the first two, and that instruction was incomplete: `aiGenerated` is a
 * type the backfill DOES create rows for, so a save path regression on the AI
 * path was previously undetectable here):
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
 * `upload` / `symbolstix` placements fall through all three, on purpose —
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

    for (const image of merged) {
      if (!isCreditableAssetKey(image.imageKey)) continue;
      if (existingKeys.has(image.imageKey)) continue;

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

    return { definitelyLost, aiGeneratedMissing, unknown };
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
        const bucket = bucketFor(image, existingKeys.has(image.imageKey));
        counts[bucket]++;
        if (bucket === "create") credits.push(toCreditRow(image));
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
