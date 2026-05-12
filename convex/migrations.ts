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

// ─── ADR-009 follow-up: stop persisting category-matching symbol colours ──────
//
// Symbols saved before/around this migration carry `display.bgColour` /
// `display.borderColour` populated from the parent category's c100 / c500
// (auto-match on creation, manual write on edit). With Option B, those
// values should not be stored — render code falls back to the live
// category palette via SymbolCard's `categoryColour` prop. This migration
// nulls out matching saved colours so future category-colour changes
// propagate to all child symbols without further mutations.
//
// Idempotent — safe to re-run. Only strips values that exactly match the
// parent category's c100 / c500; explicit user customisations are
// preserved untouched.

// Inline copy of the category palette + hex aliases from
// app/lib/categoryColours.ts. Kept here so the migration can run without
// reaching across the app/convex boundary; values must stay in sync if
// the palette ever changes (rare).
const CATEGORY_COLOURS_SERVER: Record<string, { c500: string; c100: string }> = {
  orange:  { c500: "#F97316", c100: "#FFEDD5" },
  amber:   { c500: "#F59E0B", c100: "#FEF3C7" },
  yellow:  { c500: "#EAB308", c100: "#FEF9C3" },
  red:     { c500: "#EF4444", c100: "#FEE2E2" },
  rose:    { c500: "#F43F5E", c100: "#FFE4E6" },
  pink:    { c500: "#EC4899", c100: "#FCE7F3" },
  fuchsia: { c500: "#D946EF", c100: "#FAE8FF" },
  purple:  { c500: "#A855F7", c100: "#F3E8FF" },
  violet:  { c500: "#8B5CF6", c100: "#EDE9FE" },
  indigo:  { c500: "#6366F1", c100: "#E0E7FF" },
  blue:    { c500: "#3B82F6", c100: "#DBEAFE" },
  sky:     { c500: "#0EA5E9", c100: "#E0F2FE" },
  cyan:    { c500: "#06B6D4", c100: "#CFFAFE" },
  teal:    { c500: "#14B8A6", c100: "#CCFBF1" },
  emerald: { c500: "#10B981", c100: "#D1FAE5" },
  green:   { c500: "#22C55E", c100: "#DCFCE7" },
  lime:    { c500: "#84CC16", c100: "#ECFCCB" },
};

const LEGACY_HEX_SERVER: Record<string, { c500: string; c100: string }> = {
  "#F97316": CATEGORY_COLOURS_SERVER.orange,
  "#F59E0B": CATEGORY_COLOURS_SERVER.amber,
  "#D97706": CATEGORY_COLOURS_SERVER.amber,
  "#EAB308": CATEGORY_COLOURS_SERVER.yellow,
  "#EF4444": CATEGORY_COLOURS_SERVER.red,
  "#F43F5E": CATEGORY_COLOURS_SERVER.rose,
  "#EC4899": CATEGORY_COLOURS_SERVER.pink,
  "#F472B6": CATEGORY_COLOURS_SERVER.pink,
  "#D946EF": CATEGORY_COLOURS_SERVER.fuchsia,
  "#A855F7": CATEGORY_COLOURS_SERVER.purple,
  "#8B5CF6": CATEGORY_COLOURS_SERVER.violet,
  "#7C3AED": CATEGORY_COLOURS_SERVER.violet,
  "#6366F1": CATEGORY_COLOURS_SERVER.indigo,
  "#3B82F6": CATEGORY_COLOURS_SERVER.blue,
  "#0EA5E9": CATEGORY_COLOURS_SERVER.sky,
  "#06B6D4": CATEGORY_COLOURS_SERVER.cyan,
  "#14B8A6": CATEGORY_COLOURS_SERVER.teal,
  "#10B981": CATEGORY_COLOURS_SERVER.emerald,
  "#22C55E": CATEGORY_COLOURS_SERVER.green,
};

function resolveCategoryPalette(colour: string): { c500: string; c100: string } | null {
  if (colour in CATEGORY_COLOURS_SERVER) return CATEGORY_COLOURS_SERVER[colour];
  if (colour in LEGACY_HEX_SERVER) return LEGACY_HEX_SERVER[colour];
  return null;
}

export const stripCategoryMatchingSymbolColours = mutation({
  // Dashboard-runnable. No auth check — matches the pattern used by
  // `materialiseStarterPack` / `restoreStarterPackFromBackup` (one-shot
  // ops invoked manually by an operator). Idempotent; safe to re-run.
  args: {},
  handler: async (ctx) => {
    const symbols = await ctx.db.query("profileSymbols").collect();

    let scanned = 0;
    let bgStripped = 0;
    let borderStripped = 0;
    let unchanged = 0;
    let unknownPalette = 0;

    for (const sym of symbols) {
      scanned++;
      const display = sym.display;
      if (
        !display ||
        (display.bgColour === undefined && display.borderColour === undefined)
      ) {
        unchanged++;
        continue;
      }

      const cat = await ctx.db.get(sym.profileCategoryId);
      if (!cat) {
        unchanged++;
        continue;
      }

      const palette = resolveCategoryPalette(cat.colour);
      if (!palette) {
        unknownPalette++;
        continue;
      }

      const bgMatches =
        display.bgColour !== undefined &&
        display.bgColour.toLowerCase() === palette.c100.toLowerCase();
      const borderMatches =
        display.borderColour !== undefined &&
        display.borderColour.toLowerCase() === palette.c500.toLowerCase();

      if (!bgMatches && !borderMatches) {
        unchanged++;
        continue;
      }

      const next = { ...display };
      if (bgMatches) {
        delete next.bgColour;
        bgStripped++;
      }
      if (borderMatches) {
        delete next.borderColour;
        borderStripped++;
      }

      await ctx.db.patch(sym._id, { display: next });
    }

    console.log(
      `[stripCategoryMatchingSymbolColours] scanned=${scanned} bgStripped=${bgStripped} borderStripped=${borderStripped} unchanged=${unchanged} unknownPalette=${unknownPalette}`
    );

    return { scanned, bgStripped, borderStripped, unchanged, unknownPalette };
  },
});

// ─── Resource library snapshot bloat cleanup ─────────────────────────────────
//
// Symbols saved before the SymbolEditorModal save-handler fix carry a full
// `display` object even when every field matches the system default. The
// original starter-pack entries (and post-fix entries) carry no `display`
// field at all when on defaults. This migration strips matching fields on
// both `profileSymbols` and `resourcePacks.categories[].symbols[]`,
// converging existing data on the same clean shape.
//
// Idempotent — safe to re-run. Only strips values that exactly match the
// system defaults; explicit user customisations are preserved untouched.
// Does NOT touch `bgColour` / `borderColour` — those have category-relative
// defaults handled by `stripCategoryMatchingSymbolColours` above.
//
// These constants must stay in sync with DEFAULT_DISPLAY in
// app/components/app/shared/modals/symbol-editor/types.ts.

const SYSTEM_DEFAULT_DISPLAY = {
  textColour: "#111827",
  borderWidth: 2,
  showLabel: true,
  showImage: true,
  textSize: "sm",
  shape: "rounded",
} as const;

type DisplayLike = {
  bgColour?: string;
  textColour?: string;
  textSize?: "sm" | "md" | "lg" | "xl";
  borderColour?: string;
  borderWidth?: number;
  showLabel?: boolean;
  showImage?: boolean;
  shape?: "square" | "rounded" | "circle";
};

/**
 * Strip fields from `display` that match the system default. Returns the
 * resulting object (or `undefined` if everything matched) plus the count
 * of fields removed. Leaves bgColour / borderColour alone — those have
 * category-relative defaults handled by a sibling migration.
 */
function stripDefaultDisplay(
  display: DisplayLike | undefined
): { next: DisplayLike | undefined; stripped: number } {
  if (!display) return { next: undefined, stripped: 0 };
  const next: DisplayLike = { ...display };
  let stripped = 0;
  if (next.textColour === SYSTEM_DEFAULT_DISPLAY.textColour) {
    delete next.textColour;
    stripped++;
  }
  if (next.borderWidth === SYSTEM_DEFAULT_DISPLAY.borderWidth) {
    delete next.borderWidth;
    stripped++;
  }
  if (next.showLabel === SYSTEM_DEFAULT_DISPLAY.showLabel) {
    delete next.showLabel;
    stripped++;
  }
  if (next.showImage === SYSTEM_DEFAULT_DISPLAY.showImage) {
    delete next.showImage;
    stripped++;
  }
  if (next.textSize === SYSTEM_DEFAULT_DISPLAY.textSize) {
    delete next.textSize;
    stripped++;
  }
  if (next.shape === SYSTEM_DEFAULT_DISPLAY.shape) {
    delete next.shape;
    stripped++;
  }
  const isEmpty = Object.keys(next).length === 0;
  return { next: isEmpty ? undefined : next, stripped };
}

export const stripDefaultMatchingSymbolDisplay = mutation({
  // Dashboard-runnable. No auth check — matches the pattern used by
  // `materialiseStarterPack` / `stripCategoryMatchingSymbolColours`
  // (one-shot ops invoked manually by an operator). Idempotent.
  args: {},
  handler: async (ctx) => {
    // ── 1) profileSymbols ────────────────────────────────────────────────
    const symbols = await ctx.db.query("profileSymbols").collect();
    let symScanned = 0;
    let symPatched = 0;
    let symFieldsStripped = 0;
    let symFullyCleared = 0;
    let symUnchanged = 0;

    for (const sym of symbols) {
      symScanned++;
      const { next, stripped } = stripDefaultDisplay(sym.display);
      if (stripped === 0) {
        symUnchanged++;
        continue;
      }
      await ctx.db.patch(sym._id, { display: next });
      symPatched++;
      symFieldsStripped += stripped;
      if (next === undefined) symFullyCleared++;
    }

    // ── 2) resourcePacks.categories[].symbols[] ──────────────────────────
    const packs = await ctx.db.query("resourcePacks").collect();
    let packsScanned = 0;
    let packsTouched = 0;
    let packSymFieldsStripped = 0;
    let packSymFullyCleared = 0;

    for (const pack of packs) {
      packsScanned++;
      if (!pack.categories || pack.categories.length === 0) continue;

      let packChanged = false;
      const nextCategories = pack.categories.map((cat) => {
        const nextSymbols = cat.symbols.map((s) => {
          const { next, stripped } = stripDefaultDisplay(
            s.display as DisplayLike | undefined
          );
          if (stripped === 0) return s;
          packChanged = true;
          packSymFieldsStripped += stripped;
          if (next === undefined) {
            packSymFullyCleared++;
            // Rebuild without the display field entirely.
            const { display: _omit, ...rest } = s;
            return rest;
          }
          return { ...s, display: next };
        });
        return { ...cat, symbols: nextSymbols };
      });

      if (packChanged) {
        await ctx.db.patch(pack._id, { categories: nextCategories });
        packsTouched++;
      }
    }

    const summary = {
      profileSymbols: {
        scanned: symScanned,
        patched: symPatched,
        fieldsStripped: symFieldsStripped,
        fullyCleared: symFullyCleared,
        unchanged: symUnchanged,
      },
      resourcePacks: {
        scanned: packsScanned,
        touched: packsTouched,
        symFieldsStripped: packSymFieldsStripped,
        symFullyCleared: packSymFullyCleared,
      },
    };

    console.log(
      `[stripDefaultMatchingSymbolDisplay] ${JSON.stringify(summary)}`
    );

    return summary;
  },
});
