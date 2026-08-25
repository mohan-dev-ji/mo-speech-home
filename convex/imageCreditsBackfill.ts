/**
 * Backfill + standing self-check for the image-credit registry (phase-31 Task 3).
 *
 * WHY A SEPARATE MODULE FROM `convex/imageCredits.ts`
 * `recordImageCredit` is caller-scoped: `requireCallerAccountId` writes only the
 * signed-in account's rows and THROWS when there is no caller identity — which
 * is exactly what `npx convex run` is. A backfill has to span every account and
 * runs from a terminal, so it cannot reuse it.
 *
 * AUTH MODEL — every function here is `internalQuery` / `internalMutation`.
 * Internal functions are not part of the public `api` surface: they are
 * addressable only as `internal.*`, which the Convex client cannot reference
 * and the server refuses to run for a browser call. So an explicit `accountId`
 * argument — a cross-account write, which nothing in the public API is allowed
 * to be — is only ever reachable from a deploy-key-holding CLI or another
 * server-side function. Nothing here weakens the caller-scoped public path;
 * `recordImageCredit` is untouched.
 *
 * The writes reuse `writeInstalledModuleCredits` (Task 2) rather than
 * re-implementing the insert, so the dedupe rule stays in exactly one place:
 * query `by_account_and_key`, SKIP if a row exists — first record wins, never a
 * patch, never a throw, never a delete.
 *
 * Read/write split is deliberate: everything the script needs in order to
 * PRINT a plan is a query, and the only two mutations are guarded behind the
 * script's `--apply` flag.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { imageCreditFields } from "./schema";
import type { CreditRow } from "./schema";
import { isCreditableAssetKey } from "./lib/contentModuleDelete";
import { mergeModuleCredits, writeInstalledModuleCredits } from "./lib/moduleCredits";
import {
  collectAccountImageRefs,
  collectModuleImageRefs,
  type ImageRef,
  type PlacementSourceType,
} from "./lib/imageCreditRefs";

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

/** Does this account already hold a registry row for `imageKey`? */
async function hasCredit(
  ctx: QueryCtx,
  accountId: Id<"users">,
  imageKey: string,
): Promise<boolean> {
  const row = await ctx.db
    .query("imageCredits")
    .withIndex("by_account_and_key", (q) =>
      q.eq("accountId", accountId).eq("imageKey", imageKey),
    )
    .first();
  return row !== null;
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
 * index that yields distinct values. Acceptable because this is a CLI-only
 * backfill/audit function, never a request path; the per-account plan and
 * check below both stay index-driven.
 */
export const listBackfillAccounts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const byId = new Map<
      string,
      { accountId: Id<"users">; email: string; name: string; hasUserRow: boolean }
    >();
    for (const u of users as Doc<"users">[]) {
      byId.set(u._id, {
        accountId: u._id,
        email: u.email ?? "",
        name: u.name ?? "",
        hasUserRow: true,
      });
    }

    const referenced: Array<Id<"users"> | undefined> = [];
    for (const row of await ctx.db.query("profileSymbols").collect()) referenced.push(row.accountId);
    for (const row of await ctx.db.query("profileLists").collect()) referenced.push(row.accountId);
    for (const row of await ctx.db.query("profileSentences").collect()) referenced.push(row.accountId);
    for (const row of await ctx.db.query("profilePhrases").collect()) referenced.push(row.accountId);
    for (const row of await ctx.db.query("profileCategories").collect()) referenced.push(row.accountId);
    for (const row of await ctx.db.query("profileFolders").collect()) referenced.push(row.accountId);

    // A row whose `accountId` is absent altogether (the field is still
    // `v.optional` for pre-migration rows) belongs to no account and can never
    // receive a registry row — counted so the caller can say so out loud.
    let rowsWithNoAccountId = 0;
    for (const accountId of referenced) {
      if (!accountId) {
        rowsWithNoAccountId++;
        continue;
      }
      if (!byId.has(accountId)) {
        byId.set(accountId, { accountId, email: "", name: "", hasUserRow: false });
      }
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
export const planAccountImageCredits = internalQuery({
  args: { accountId: v.id("users") },
  handler: async (ctx, args) => {
    const { refs, rowsWalked } = await collectAccountImageRefs(ctx, args.accountId);
    const merged = mergeByKey(refs);

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
      const present = await hasCredit(ctx, args.accountId, image.imageKey);
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
 * Two buckets, per the plan's "What gets recorded, and why":
 *   `definitelyLost` — the row says `imageSearch`, no registry row exists.
 *                      Every entry is a real gap.
 *   `unknown`        — no type on any placement (covers, talker-built slots),
 *                      so an absent row could be a legitimate upload or a lost
 *                      credit. Should stay short enough to eyeball; if it does
 *                      not, recording uploads is the fix.
 */
export const checkAccountImageCreditCompleteness = internalQuery({
  args: { accountId: v.id("users") },
  handler: async (ctx, args) => {
    const { refs } = await collectAccountImageRefs(ctx, args.accountId);
    const merged = mergeByKey(refs);

    const definitelyLost: Array<{ imageKey: string; label: string; foundIn: string; hasRecoverableCredit: boolean }> = [];
    const unknown: Array<{ imageKey: string; label: string; foundIn: string }> = [];

    for (const image of merged) {
      if (!isCreditableAssetKey(image.imageKey)) continue;
      if (await hasCredit(ctx, args.accountId, image.imageKey)) continue;

      if (image.sourceType === "imageSearch") {
        definitelyLost.push({
          imageKey: image.imageKey,
          label: image.label ?? "",
          foundIn: image.foundIn.join(", "),
          hasRecoverableCredit: Boolean(
            image.attribution || image.license || image.imageSourceUrl,
          ),
        });
      } else if (image.sourceType === undefined) {
        unknown.push({
          imageKey: image.imageKey,
          label: image.label ?? "",
          foundIn: image.foundIn.join(", "),
        });
      }
    }

    return { definitelyLost, unknown };
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
