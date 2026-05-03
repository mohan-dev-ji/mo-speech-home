import { mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id, TableNames } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { DEFAULT_CATEGORIES } from "./data/defaultCategorySymbols";

/**
 * One-shot migration: backfill `accountId` on all account-scoped content tables.
 *
 * For each row:
 *  - If `accountId` already set, skip.
 *  - Else look up `profileId`. If the profile exists, copy its `accountId`.
 *  - Else (orphaned row from a deleted profile), attribute to the *caller's* account.
 *
 * Idempotent — safe to re-run.
 */
async function migrateOneTable(
  ctx: MutationCtx,
  table: "profileCategories" | "profileSymbols" | "profileLists" | "profileSentences",
  callerAccountId: Id<"users">
) {
  // Cast required because each call below is a different return type; we narrow on use.
  const docs = await ctx.db.query(table as TableNames).collect();

  let backfilled = 0;
  let orphansRecovered = 0;
  let alreadyHadAccountId = 0;

  for (const doc of docs) {
    const d = doc as unknown as {
      _id: Id<"profileCategories" | "profileSymbols" | "profileLists" | "profileSentences">;
      accountId?: Id<"users">;
      profileId?: Id<"studentProfiles">;
    };

    if (d.accountId) {
      alreadyHadAccountId++;
      continue;
    }

    let resolved: Id<"users"> | null = null;
    if (d.profileId) {
      const profile = await ctx.db.get(d.profileId);
      if (profile) resolved = profile.accountId;
    }

    if (!resolved) {
      resolved = callerAccountId;
      orphansRecovered++;
    } else {
      backfilled++;
    }

    await ctx.db.patch(d._id as never, { accountId: resolved } as never);
  }

  return { backfilled, orphansRecovered, alreadyHadAccountId, total: docs.length };
}

export const migrateContentToAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const callerUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!callerUser) throw new Error("Caller user record not found");

    const acc = callerUser._id;

    return {
      profileCategories: await migrateOneTable(ctx, "profileCategories", acc),
      profileSymbols:    await migrateOneTable(ctx, "profileSymbols",    acc),
      profileLists:      await migrateOneTable(ctx, "profileLists",      acc),
      profileSentences:  await migrateOneTable(ctx, "profileSentences",  acc),
    };
  },
});

/**
 * Materialise the canonical starter `resourcePack` from DEFAULT_CATEGORIES.
 *
 * One-shot, manually invoked from the Convex dashboard. Re-runnable so admins
 * can refresh the starter from the latest DEFAULT_CATEGORIES recipe whenever
 * convex/data/defaultCategorySymbols.ts changes — no code deploy required for
 * starter content updates after this lands.
 *
 * Invariant: at most one resourcePack has isStarter: true. Enforced here by
 * querying `by_isStarter` before writing — patches the existing row if found,
 * inserts a new one otherwise.
 *
 * For each CategorySeed in DEFAULT_CATEGORIES, this mirrors the symbol-lookup
 * logic from seedDefaultAccount (convex/profileCategories.ts:58–89): take each
 * word, query symbols.by_words_eng, prefer matches whose `categories` field
 * overlaps cat.symbolstixCategories, fall back to any case-insensitive word
 * match, skip if no match found.
 *
 * The folder cover image is resolved via cat.folderWord (when present) and
 * stored as `imagePath` on the snapshot category, so loadResourcePack can
 * reproduce it on profileCategories.
 *
 * Run from the Convex dashboard:
 *   migrations.materialiseStarterPack({ adminClerkUserId: "user_..." })
 */
export const materialiseStarterPack = mutation({
  args: { adminClerkUserId: v.string() },
  handler: async (ctx, { adminClerkUserId }) => {
    const now = Date.now();
    let totalSymbolsMatched = 0;
    let totalSymbolsSkipped = 0;

    // Build the categories[] payload by resolving DEFAULT_CATEGORIES against
    // the live symbols table, mirroring seedDefaultAccount's lookup logic.
    const categoriesPayload = await Promise.all(
      DEFAULT_CATEGORIES.map(async (cat) => {
        // Resolve folder cover image if cat.folderWord is set.
        let folderImagePath: string | undefined;
        if (cat.folderWord) {
          const folderSym = await ctx.db
            .query("symbols")
            .withIndex("by_words_eng", (q) =>
              q.eq("words.eng", cat.folderWord!)
            )
            .first();
          if (folderSym) folderImagePath = folderSym.imagePath;
        }

        // Resolve each word to a symbol ID.
        const symbols: {
          symbolId: string;
          order: number;
        }[] = [];
        let symbolOrder = 0;

        for (const word of cat.words) {
          const candidates = await ctx.db
            .query("symbols")
            .withIndex("by_words_eng", (q) => q.eq("words.eng", word))
            .take(3);

          const wordLower = word.toLowerCase();
          const match =
            candidates.find(
              (s) =>
                s.words.eng.toLowerCase() === wordLower &&
                s.categories.some((c) =>
                  cat.symbolstixCategories.includes(c)
                )
            ) ??
            candidates.find(
              (s) => s.words.eng.toLowerCase() === wordLower
            );

          if (!match) {
            totalSymbolsSkipped++;
            continue;
          }

          symbols.push({
            symbolId: match._id,
            order: symbolOrder++,
          });
          totalSymbolsMatched++;
        }

        return {
          name: cat.name,
          icon: cat.icon,
          colour: cat.colour,
          ...(folderImagePath ? { imagePath: folderImagePath } : {}),
          symbols,
        };
      })
    );

    const payload = {
      name: { eng: "Starter Pack", hin: "Starter Pack (hi)" },
      description: {
        eng: "Default categories loaded into every new account on signup.",
        hin: "Default categories loaded into every new account on signup. (hi)",
      },
      coverImagePath: "static/starter-cover.webp", // placeholder; replace later
      tags: [],
      featured: false,
      isStarter: true,
      createdBy: adminClerkUserId,
      updatedAt: now,
      categories: categoriesPayload,
      lists: [] as unknown[],
      sentences: [] as unknown[],
    };

    const existing = await ctx.db
      .query("resourcePacks")
      .withIndex("by_isStarter", (q) => q.eq("isStarter", true))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      console.log(
        `[materialiseStarterPack] updated existing starter pack ${existing._id}`
      );
      return {
        packId: existing._id,
        action: "updated" as const,
        categoriesProcessed: categoriesPayload.length,
        symbolsMatched: totalSymbolsMatched,
        symbolsSkipped: totalSymbolsSkipped,
      };
    } else {
      const packId = await ctx.db.insert("resourcePacks", payload);
      console.log(
        `[materialiseStarterPack] inserted new starter pack ${packId}`
      );
      return {
        packId,
        action: "inserted" as const,
        categoriesProcessed: categoriesPayload.length,
        symbolsMatched: totalSymbolsMatched,
        symbolsSkipped: totalSymbolsSkipped,
      };
    }
  },
});
