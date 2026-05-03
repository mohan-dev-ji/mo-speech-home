import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id, TableNames } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { DEFAULT_CATEGORIES } from "./data/defaultCategorySymbols";
import { STARTER_BACKUPS } from "./data/starter_backups";

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
      lists: [],
      sentences: [],
    };

    const existing = await ctx.db
      .query("resourcePacks")
      .withIndex("by_isStarter", (q) => q.eq("isStarter", true))
      .first();

    if (existing) {
      // Clear forward links from any profile rows currently published to this
      // pack — overwriting the contents would leave stale "Default" badges
      // pointing at categories no longer in the pack.
      const linksCleared = await clearForwardLinksToPack(ctx, existing._id);

      await ctx.db.patch(existing._id, { ...payload, tier: "free" as const });
      console.log(
        `[materialiseStarterPack] updated existing starter pack ${existing._id}; cleared ${linksCleared} forward links`
      );
      return {
        packId: existing._id,
        action: "updated" as const,
        categoriesProcessed: categoriesPayload.length,
        symbolsMatched: totalSymbolsMatched,
        symbolsSkipped: totalSymbolsSkipped,
        linksCleared,
      };
    } else {
      const packId = await ctx.db.insert("resourcePacks", {
        ...payload,
        tier: "free" as const,
      });
      console.log(
        `[materialiseStarterPack] inserted new starter pack ${packId}`
      );
      return {
        packId,
        action: "inserted" as const,
        categoriesProcessed: categoriesPayload.length,
        symbolsMatched: totalSymbolsMatched,
        symbolsSkipped: totalSymbolsSkipped,
        linksCleared: 0,
      };
    }
  },
});

// ─── Backup helpers + restore ─────────────────────────────────────────────────

/**
 * Clear publishedToPackId on every profile row currently linked to this pack.
 * Used by materialiseStarterPack and restoreStarterPackFromBackup before they
 * overwrite pack contents — otherwise stale "Default" badges show on items
 * no longer in the pack.
 */
async function clearForwardLinksToPack(
  ctx: MutationCtx,
  packId: Id<"resourcePacks">
): Promise<number> {
  let cleared = 0;

  const linkedCats = await ctx.db
    .query("profileCategories")
    .withIndex("by_published_to_pack_id", (q) =>
      q.eq("publishedToPackId", packId)
    )
    .collect();
  for (const c of linkedCats) {
    await ctx.db.patch(c._id, { publishedToPackId: undefined });
    cleared++;
  }

  const linkedLists = await ctx.db
    .query("profileLists")
    .withIndex("by_published_to_pack_id", (q) =>
      q.eq("publishedToPackId", packId)
    )
    .collect();
  for (const l of linkedLists) {
    await ctx.db.patch(l._id, { publishedToPackId: undefined });
    cleared++;
  }

  const linkedSentences = await ctx.db
    .query("profileSentences")
    .withIndex("by_published_to_pack_id", (q) =>
      q.eq("publishedToPackId", packId)
    )
    .collect();
  for (const s of linkedSentences) {
    await ctx.db.patch(s._id, { publishedToPackId: undefined });
    cleared++;
  }

  return cleared;
}

/**
 * List available starter pack backups. Returns metadata only (name, label,
 * createdAt, item counts) — not the full snapshot. Used by the restore UI in
 * the Convex dashboard.
 */
export const listStarterBackups = query({
  args: {},
  handler: async () => {
    return Object.entries(STARTER_BACKUPS).map(([name, backup]) => ({
      name,
      label: backup.label,
      createdAt: backup.createdAt,
      categoriesCount: backup.categories.length,
      listsCount: backup.lists.length,
      sentencesCount: backup.sentences.length,
    }));
  },
});

/**
 * Restore the canonical starter pack from a JSON backup in
 * `convex/data/starter_backups/`. Distinct from `materialiseStarterPack` which
 * is a factory reset to the DEFAULT_CATEGORIES recipe.
 *
 * Steps:
 *  1. Look up the backup by name in the static registry.
 *  2. Find the starter pack via the by_isStarter index.
 *  3. Clear forward links from any profile rows currently linked to it
 *     (otherwise stale "Default" badges show on items no longer in the pack).
 *  4. Replace the starter pack's content with the backup snapshot.
 *  5. Restore forward links where possible: for each entry with a
 *     sourceProfile*Id whose source row still exists on the admin's account,
 *     re-set publishedToPackId to the starter ID.
 *
 * Trust-only adminClerkUserId per the existing migration pattern. Run from
 * the Convex dashboard.
 */
export const restoreStarterPackFromBackup = mutation({
  args: {
    backupName: v.string(),
    adminClerkUserId: v.string(),
  },
  handler: async (ctx, { backupName, adminClerkUserId }) => {
    const backup = STARTER_BACKUPS[backupName];
    if (!backup) {
      throw new Error(
        `Backup "${backupName}" not found. Available: ${Object.keys(STARTER_BACKUPS).join(", ")}`
      );
    }

    const starter = await ctx.db
      .query("resourcePacks")
      .withIndex("by_isStarter", (q) => q.eq("isStarter", true))
      .first();
    if (!starter) {
      throw new Error(
        "No starter pack exists. Run materialiseStarterPack first."
      );
    }

    // 1. Clear all current forward links to the starter pack.
    const linksCleared = await clearForwardLinksToPack(ctx, starter._id);

    // 2. Replace pack contents with the backup snapshot.
    await ctx.db.patch(starter._id, {
      categories: backup.categories as never,
      lists: backup.lists as never,
      sentences: backup.sentences as never,
      updatedAt: Date.now(),
    });

    // 3. Restore forward links: for each entry whose sourceProfile*Id still
    //    points to an existing row on the admin's account, re-set publishedToPackId.
    let linksRestored = 0;
    let linksMissed = 0;

    for (const cat of backup.categories) {
      if (!cat.sourceProfileCategoryId) {
        linksMissed++;
        continue;
      }
      const row = await ctx.db.get(
        cat.sourceProfileCategoryId as Id<"profileCategories">
      );
      if (row) {
        await ctx.db.patch(row._id, { publishedToPackId: starter._id });
        linksRestored++;
      } else {
        linksMissed++;
      }
    }

    for (const list of backup.lists) {
      if (!list.sourceProfileListId) {
        linksMissed++;
        continue;
      }
      const row = await ctx.db.get(
        list.sourceProfileListId as Id<"profileLists">
      );
      if (row) {
        await ctx.db.patch(row._id, { publishedToPackId: starter._id });
        linksRestored++;
      } else {
        linksMissed++;
      }
    }

    for (const sentence of backup.sentences) {
      if (!sentence.sourceProfileSentenceId) {
        linksMissed++;
        continue;
      }
      const row = await ctx.db.get(
        sentence.sourceProfileSentenceId as Id<"profileSentences">
      );
      if (row) {
        await ctx.db.patch(row._id, { publishedToPackId: starter._id });
        linksRestored++;
      } else {
        linksMissed++;
      }
    }

    console.log(
      `[restoreStarterPackFromBackup] restored "${backupName}" by ${adminClerkUserId}: cleared ${linksCleared} links, restored ${linksRestored}, missed ${linksMissed}`
    );

    return {
      starterPackId: starter._id,
      backupName,
      label: backup.label,
      restored: {
        categories: backup.categories.length,
        lists: backup.lists.length,
        sentences: backup.sentences.length,
      },
      linksCleared,
      linksRestored,
      linksMissed,
    };
  },
});
