import { mutation, query, internalMutation, action } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { LITTLE_WORDS_GROUPS } from "./data/defaultCategorySymbols";
import { STARTER_BACKUPS } from "./data/starter_backups";
import { LANGUAGE_MODULES } from "./data/languages/_index";
import { CATEGORY_MODULES } from "./data/categories/_index";
import { LIST_MODULES } from "./data/lists/_index";
import { SENTENCE_MODULES } from "./data/sentences/_index";
import { PHRASE_MODULES } from "./data/phrases/_index";

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

// ─── Backup helpers + restore ─────────────────────────────────────────────────

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

/**
 * One-time: wipe imageSearchCache rows after reshaping the result schema for
 * multi-provider support. Old rows (with `pageId: number`) fail the new
 * validator. Cache rebuilds organically on next search; 24h TTL means we'd
 * have rotated through anyway.
 */
export const wipeImageSearchCache = mutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("imageSearchCache").collect();
    for (const row of rows) await ctx.db.delete(row._id);
    console.log(`[wipeImageSearchCache] deleted ${rows.length} rows`);
    return { wiped: rows.length };
  },
});

/**
 * Phase 13.4 Task 0 — seed the `libraryModules` table from the bundled module
 * JSON (the converted themed packs: christmas, dinosaurs, …). This is the
 * one-time migration that makes Convex the source of truth (ADR-014 addendum
 * 2026-06-27); it replaces the now-removed `publishConvertedPackModules`.
 *
 * Reads the JSON barrels DIRECTLY (not the `getAllModules` reader, which now
 * queries the table — empty before this runs). Every non-starter module is
 * inserted with the lifecycle merged onto the row and `publishedAt = now` (tier
 * falls back to `defaultTier`; no override). The `isStarter` test fixtures are
 * skipped. Idempotent: an existing `(tree, slug)` row is left untouched.
 *
 * Run via the Convex dashboard Functions runner (cannot run from a worktree).
 * Expected on first run: `{ seeded: 17, skippedStarter: 3, alreadyHadRow: 0 }`.
 */
/**
 * Phase 14 (ADR-015 §6) — seed the core-word category modules. Unlike the other
 * module seeds (static JSON), core words must resolve each word to its symbol at
 * seed time (DB lookup), so this is its own mutation. Produces `surface:"core"`
 * category modules (locked to zinc, isDefault, free) that auto-install into new
 * accounts via `seedDefaultAccount` and surface in the talker dropdown's
 * Core-words tab. Idempotent — re-running upserts by slug. Numbers/Letters are
 * fixed sets surfaced by the dropdown directly, not editable modules.
 */
export const seedCoreWordModules = mutation({
  args: { adminClerkUserId: v.string() },
  handler: async (ctx, { adminClerkUserId }) => {
    const now = Date.now();
    const byId = Object.fromEntries(LITTLE_WORDS_GROUPS.map((g) => [g.id, g] as const));
    // General merges the two SymbolStix core sets; the rest map 1:1.
    const groups: { slug: string; name: string; words: string[] }[] = [
      {
        slug: "core-general",
        name: "General",
        words: [...(byId["core-a"]?.words ?? []), ...(byId["core-b"]?.words ?? [])],
      },
      { slug: "core-pronouns", name: "Pronouns", words: byId["pronouns"]?.words ?? [] },
      { slug: "core-joining-words", name: "Joining words", words: byId["joining-words"]?.words ?? [] },
      { slug: "core-position-words", name: "Position Words", words: byId["position-words"]?.words ?? [] },
      { slug: "core-time", name: "Time", words: byId["time-and-manner"]?.words ?? [] },
      { slug: "core-numbers", name: "Numbers", words: byId["numbers"]?.words ?? [] },
      { slug: "core-letters", name: "Letters", words: byId["letters"]?.words ?? [] },
    ];

    let seeded = 0;
    let updated = 0;
    let symbolsResolved = 0;
    let symbolsMissing = 0;

    for (const group of groups) {
      const symbols: { order: number; symbolId: string }[] = [];
      for (const word of group.words) {
        const sym = await ctx.db
          .query("symbols")
          .withIndex("by_words_en", (q) => q.eq("words.en", word))
          .first();
        if (sym) {
          symbols.push({ order: symbols.length, symbolId: sym._id });
          symbolsResolved++;
        } else {
          symbolsMissing++;
        }
      }
      const item = {
        name: { en: group.name },
        icon: "MessageSquare",
        colour: "zinc",
        symbols,
      };
      const existing = await ctx.db
        .query("libraryModules")
        .withIndex("by_tree_and_slug", (q) =>
          q.eq("tree", "categories").eq("slug", group.slug)
        )
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, {
          surface: "core",
          colour: "zinc",
          isDefault: true,
          name: { en: group.name },
          items: [item],
          lastPublishedAt: now,
          updatedAt: now,
        });
        updated++;
      } else {
        await ctx.db.insert("libraryModules", {
          tree: "categories",
          surface: "core",
          slug: group.slug,
          name: { en: group.name },
          icon: "MessageSquare",
          colour: "zinc",
          defaultTier: "free",
          isDefault: true,
          items: [item],
          publishedAt: now,
          featured: false,
          createdBy: adminClerkUserId,
          updatedAt: now,
        });
        seeded++;
      }
    }

    const summary = { seeded, updated, symbolsResolved, symbolsMissing };
    console.log(`[seedCoreWordModules] ${JSON.stringify(summary)}`);
    return summary;
  },
});

export const seedLibraryModulesFromJSON = mutation({
  args: { adminClerkUserId: v.string() },
  handler: async (ctx, { adminClerkUserId }) => {
    const now = Date.now();
    const maps = {
      categories: CATEGORY_MODULES,
      lists: LIST_MODULES,
      sentences: SENTENCE_MODULES,
      phrases: PHRASE_MODULES,
    } as const;

    let scanned = 0;
    let seeded = 0;
    let alreadyHadRow = 0;
    let skippedStarter = 0;

    for (const tree of ["categories", "lists", "sentences", "phrases"] as const) {
      for (const mod of Object.values(maps[tree])) {
        scanned++;
        if (mod.isStarter) {
          skippedStarter++;
          continue;
        }
        const existing = await ctx.db
          .query("libraryModules")
          .withIndex("by_tree_and_slug", (q) =>
            q.eq("tree", tree).eq("slug", mod.slug)
          )
          .first();
        if (existing) {
          alreadyHadRow++;
          continue;
        }
        await ctx.db.insert("libraryModules", {
          tree,
          slug: mod.slug,
          name: mod.name,
          ...(mod.description ? { description: mod.description } : {}),
          ...(mod.icon ? { icon: mod.icon } : {}),
          ...(mod.colour ? { colour: mod.colour } : {}),
          ...(mod.coverImagePath ? { coverImagePath: mod.coverImagePath } : {}),
          defaultTier: mod.defaultTier,
          ...(mod.isDefault ? { isDefault: true } : {}),
          ...(mod.provenance ? { provenance: mod.provenance } : {}),
          items: mod.items,
          publishedAt: now,
          featured: false,
          createdBy: adminClerkUserId,
          updatedAt: now,
        });
        seeded++;
      }
    }

    const summary = { scanned, seeded, alreadyHadRow, skippedStarter };
    console.log(`[seedLibraryModulesFromJSON] ${JSON.stringify(summary)}`);
    return summary;
  },
});

/**
 * Phase 13.4 (re-publish hardening) — backfill the `publishedModuleSlug` /
 * `publishedModuleClass` provenance link onto source categories/folders that
 * were published as modules BEFORE the back-link existed. Matches a source to
 * its module by slug (slugify(name) === module.slug + same tree), the same
 * derivation the Publish modal uses, so the common "didn't hand-edit the slug"
 * case links cleanly. Sources with no slug match are skipped (re-publish once to
 * link). Idempotent: already-linked sources are left alone.
 *
 * Run via the dashboard with the owner's Clerk user id.
 */
export const backfillPublishedModuleLinks = mutation({
  args: { adminClerkUserId: v.string() },
  handler: async (ctx, { adminClerkUserId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", adminClerkUserId))
      .first();
    if (!user) throw new Error(`No user for clerk id ${adminClerkUserId}`);
    const accountId = user._id;
    const now = Date.now();

    const slugify = (s: string): string =>
      s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const classOf = (
      m: Doc<"libraryModules">
    ): "default" | "free" | "pro" | "max" =>
      m.isDefault ? "default" : (m.tierOverride ?? m.defaultTier);
    const firstName = (n: Record<string, string>): string =>
      n.en ?? Object.values(n)[0] ?? "";

    let linkedCategories = 0;
    let linkedFolders = 0;
    let skipped = 0;

    const cats = await ctx.db
      .query("profileCategories")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect();
    for (const c of cats) {
      if (c.publishedModuleSlug) continue;
      const slug = slugify(firstName(c.name));
      if (!slug) { skipped++; continue; }
      const mod = await ctx.db
        .query("libraryModules")
        .withIndex("by_tree_and_slug", (q) =>
          q.eq("tree", "categories").eq("slug", slug)
        )
        .unique();
      if (!mod) { skipped++; continue; }
      await ctx.db.patch(c._id, {
        publishedModuleSlug: slug,
        publishedModuleClass: classOf(mod),
        updatedAt: now,
      });
      linkedCategories++;
    }

    const folders = await ctx.db
      .query("profileFolders")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect();
    for (const f of folders) {
      if (f.publishedModuleSlug) continue;
      if (f.tree !== "lists" && f.tree !== "sentences") continue;
      const slug = slugify(firstName(f.name));
      if (!slug) { skipped++; continue; }
      const mod = await ctx.db
        .query("libraryModules")
        .withIndex("by_tree_and_slug", (q) =>
          q.eq("tree", f.tree).eq("slug", slug)
        )
        .unique();
      if (!mod) { skipped++; continue; }
      await ctx.db.patch(f._id, {
        publishedModuleSlug: slug,
        publishedModuleClass: classOf(mod),
        updatedAt: now,
      });
      linkedFolders++;
    }

    const summary = { linkedCategories, linkedFolders, skipped };
    console.log(`[backfillPublishedModuleLinks] ${JSON.stringify(summary)}`);
    return summary;
  },
});

// ─── Phase 8.0 migration ────────────────────────────────────────────────────
//
// Migrates every bilingual field from the legacy `{eng, hin}` shape to the new
// ISO-keyed open record `{en, hi}` per ADR-009 §2. Also rewrites the
// `symbols.audio` field from path-storing objects to voice-keyed booleans
// per ADR-009 §4, and wraps single-string user-visible fields
// (profileLists.items[].description, profileSentences.text) as
// localised records. Finally seeds `languageLifecycle` with en/hi/pa rows.
//
// **Run order via the Convex dashboard:**
//   1. migrateSymbolsBatch (loop until `done: true` is returned)
//   2. migrateResourcePacks
//   3. migratePackLifecycle
//   4. migrateThemes
//   5. migrateStudentProfilesLanguage
//   6. migrateUsersLocale
//   7. wipeProfileContent           ← optional; user OK'd this for dev
//   8. seedLanguageLifecycle
//
// The migrations are idempotent: rows already on the new shape are skipped.

/** Helper — renames `{eng, hin}` keys to `{en, hi}` on a localised record. */
function renameLegacyKeys(
  obj: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!obj || typeof obj !== "object") return {};
  const out: Record<string, unknown> = { ...obj };
  if ("eng" in out) {
    if (out.eng !== undefined && out.eng !== null) out.en = out.eng;
    delete out.eng;
  }
  if ("hin" in out) {
    if (out.hin !== undefined && out.hin !== null) out.hi = out.hin;
    delete out.hin;
  }
  return out;
}

/**
 * Batched migration for the symbols table. Convex mutations have an ~8k
 * read limit per call; with 52k symbols this needs ~7 batches.
 *
 * Caller loops:
 *   const r = await convex.mutation(api.migrations.migrateSymbolsBatch, { batchSize: 5000 });
 *   while (!r.done) { // re-call with cursor }
 *
 * Idempotent — rows already migrated (no `eng`/`hin` keys, audio is a flat
 * boolean map) are skipped.
 */
export const migrateSymbolsBatch = mutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, { cursor, batchSize = 2000 }) => {
    // Use Convex's pagination cursor — `take`-with-offset can't survive
    // 52k rows. The caller loops, passing the previous `continueCursor`
    // back in until `done: true`.
    const page = await ctx.db
      .query("symbols")
      .order("asc")
      .paginate({ cursor: cursor ?? null, numItems: batchSize });

    let migrated = 0;
    let alreadyDone = 0;
    let lastId: string | null = null;

    for (const row of page.page) {
      lastId = row._id;

      const words = row.words as Record<string, unknown>;
      const synonyms = row.synonyms as Record<string, unknown> | undefined;
      const audio = row.audio as Record<string, unknown>;

      const wordsHasLegacy = "eng" in words || "hin" in words;
      const synonymsHasLegacy =
        !!synonyms && ("eng" in synonyms || "hin" in synonyms);
      const audioIsLegacy =
        audio &&
        typeof audio === "object" &&
        ("eng" in audio || "hin" in audio) &&
        !("en-GB-News-M" in audio);

      if (!wordsHasLegacy && !synonymsHasLegacy && !audioIsLegacy) {
        alreadyDone++;
        continue;
      }

      const newWords = renameLegacyKeys(words);
      const newSynonyms = synonyms ? renameLegacyKeys(synonyms) : undefined;

      // Transform audio: { eng: { default: "..." } } → { "en-GB-News-M": true }
      let newAudio: Record<string, boolean>;
      if (audioIsLegacy) {
        newAudio = {};
        if ("eng" in audio && audio.eng) {
          newAudio["en-GB-News-M"] = true;
        }
        // The legacy `hin` slot was speculative — no Hindi audio was ever
        // seeded under that path. Drop it.
      } else {
        newAudio = audio as Record<string, boolean>;
      }

      await ctx.db.patch(row._id, {
        words: newWords as never,
        synonyms: (newSynonyms ?? undefined) as never,
        audio: newAudio as never,
      });
      migrated++;
    }

    return {
      migrated,
      alreadyDone,
      lastId,
      done: page.isDone,
      continueCursor: page.continueCursor,
      batchSize,
    };
  },
});

/** Migrates packLifecycle (small table). */
export const migratePackLifecycle = mutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("packLifecycle").collect();
    let migrated = 0;

    for (const row of rows) {
      const newName = row.name
        ? renameLegacyKeys(row.name as Record<string, unknown>)
        : undefined;
      const newDescription = row.description
        ? renameLegacyKeys(row.description as Record<string, unknown>)
        : undefined;

      await ctx.db.patch(row._id, {
        name: newName as never,
        description: newDescription as never,
      });
      migrated++;
    }

    return { migrated };
  },
});

/** Migrates themes table. */
export const migrateThemes = mutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("themes").collect();
    let migrated = 0;

    for (const row of rows) {
      const newName = renameLegacyKeys(row.name as Record<string, unknown>);
      const newDescription = row.description
        ? renameLegacyKeys(row.description as Record<string, unknown>)
        : undefined;

      await ctx.db.patch(row._id, {
        name: newName as never,
        description: newDescription as never,
      });
      migrated++;
    }

    return { migrated };
  },
});

/** Rewrites studentProfiles.language values "eng" → "en", "hin" → "hi". */
export const migrateStudentProfilesLanguage = mutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("studentProfiles").collect();
    let migrated = 0;

    for (const row of rows) {
      const newLanguage =
        row.language === "eng" ? "en" : row.language === "hin" ? "hi" : null;
      if (newLanguage === null) continue;
      await ctx.db.patch(row._id, { language: newLanguage });
      migrated++;
    }

    return { migrated };
  },
});

/** Rewrites users.locale values "eng" → "en", "hin" → "hi" (if any). */
export const migrateUsersLocale = mutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("users").collect();
    let migrated = 0;

    for (const row of rows) {
      if (!row.locale) continue;
      const newLocale =
        row.locale === "eng" ? "en" : row.locale === "hin" ? "hi" : null;
      if (newLocale === null) continue;
      await ctx.db.patch(row._id, { locale: newLocale });
      migrated++;
    }

    return { migrated };
  },
});

/**
 * Wipes pack-load-derived profile content tables. The user confirmed in the
 * Phase 8.0 conversation that current data in these tables is test data from
 * pack loads — re-loading the packs after migration recreates everything.
 * Migrating these row-by-row would be more code than wiping + re-seeding.
 */
export const wipeProfileContent = mutation({
  args: {},
  handler: async (ctx) => {
    const tables = [
      "profileCategories",
      "profileSymbols",
      "profileLists",
      "profileSentences",
    ] as const;

    const counts: Record<string, number> = {};
    for (const table of tables) {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
      }
      counts[table] = rows.length;
    }
    return counts;
  },
});

/**
 * Seeds the three `languageLifecycle` rows that match the Phase 8.0 spec:
 *   - `en` stable, published now
 *   - `hi` stable, published now
 *   - `pa` machine-translated, unpublished
 *
 * Idempotent — rows already present are left alone.
 */
export const seedLanguageLifecycle = mutation({
  // Mirrors `materialiseStarterPack`'s dashboard-runnable pattern: takes the
  // admin's Clerk user id as an argument so the mutation runs without an
  // identity in `npx convex run` invocations.
  args: { adminClerkUserId: v.optional(v.string()) },
  handler: async (ctx, { adminClerkUserId }) => {
    if (!adminClerkUserId) {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) throw new Error("Unauthenticated");
      adminClerkUserId = identity.subject;
    }

    const now = Date.now();

    const seeds = [
      { slug: "en", status: "stable" as const, publishedAt: now },
      { slug: "hi", status: "stable" as const, publishedAt: now },
      { slug: "pa", status: "machine-translated" as const, publishedAt: undefined },
    ];

    let seeded = 0;
    let alreadyExisted = 0;

    for (const seed of seeds) {
      const existing = await ctx.db
        .query("languageLifecycle")
        .withIndex("by_slug", (q) => q.eq("slug", seed.slug))
        .first();
      if (existing) {
        alreadyExisted++;
        continue;
      }
      await ctx.db.insert("languageLifecycle", {
        slug: seed.slug,
        status: seed.status,
        publishedAt: seed.publishedAt,
        createdBy: adminClerkUserId,
        updatedAt: now,
      });
      seeded++;
    }

    return { seeded, alreadyExisted };
  },
});

/**
 * Phase 8.0 recovery: backfill `symbols.audioBasename` from the MVP's
 * `symbolstix-metadata.json` export. The initial Phase 8.0 schema migration
 * collapsed the per-symbol `audio.eng.default` path into a voice-keyed
 * boolean and lost the original R2 filename. The new audio resolver tried
 * to synthesise the filename from `words.en`, which is correct for only
 * ~1 in 6 symbols (the rest use SymbolStix IDs or normalised slugs).
 *
 * The companion Node script `scripts/backfill-audio-basenames.mjs` reads
 * the metadata JSON locally and calls this mutation in batches of 1000.
 * Match is by `imagePath` (uses the new `by_imagePath` index) — that field
 * stayed stable through the migration so it's the reliable join key.
 *
 * Idempotent — rows already with the correct basename are skipped.
 */
export const backfillAudioBasenames = mutation({
  args: {
    entries: v.array(
      v.object({
        imagePath: v.string(),
        audioBasename: v.string(),
      })
    ),
  },
  handler: async (ctx, { entries }) => {
    let patched = 0;
    let alreadySet = 0;
    let symbolMissing = 0;

    for (const entry of entries) {
      const sym = await ctx.db
        .query("symbols")
        .withIndex("by_imagePath", (q) => q.eq("imagePath", entry.imagePath))
        .first();
      if (!sym) {
        symbolMissing++;
        continue;
      }
      if (sym.audioBasename === entry.audioBasename) {
        alreadySet++;
        continue;
      }
      await ctx.db.patch(sym._id, { audioBasename: entry.audioBasename });
      patched++;
    }

    return { patched, alreadySet, symbolMissing, scanned: entries.length };
  },
});

// ─── searchText backfill (ADR-009 §9 transliteration search) ────────────────
//
// Materialises `searchText.<code>` on every symbol from existing `words` +
// `synonyms`. Convex full-text search needs a single string `searchField`, but
// transliterations live in the unindexable `synonyms` array — so a Latin
// keyboard user typing "kutta" could never match कुत्ता. This backfill builds
// the combined word+synonyms string the `search_text_<code>` indexes read.
// See schema `symbolSearchText`. Kept in sync going forward by
// `symbols.applyTranslationsBatch`.
//
// Additive + idempotent: only the per-language searchText slot is written, and
// pages whose computed value already matches are skipped. Paginated because the
// table is ~58k rows — past a single mutation's budget. The `backfillSearchText`
// action loops this until the table is exhausted.

/**
 * Process one page of symbols: compute `searchText[code]` for every language
 * that has a `words[code]`, and patch rows whose value changed.
 */
export const backfillSearchTextPage = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    pageSize: v.number(),
  },
  handler: async (ctx, { cursor, pageSize }) => {
    const page = await ctx.db
      .query("symbols")
      .order("asc")
      .paginate({ numItems: pageSize, cursor });

    let patched = 0;
    for (const sym of page.page) {
      const words = (sym.words ?? {}) as Record<string, string>;
      const synonyms = (sym.synonyms ?? {}) as Record<string, string[]>;

      const next: Record<string, string> = {};
      for (const mod of LANGUAGE_MODULES) {
        const code = mod.code;
        const word = words[code];
        if (typeof word !== "string" || word.length === 0) continue;
        const syns = Array.isArray(synonyms[code]) ? synonyms[code] : [];
        next[code] = [word, ...syns]
          .map((s) => (typeof s === "string" ? s.trim() : ""))
          .filter(Boolean)
          .join(" ");
      }

      // Idempotency: skip the write when the computed value already matches.
      const prev = (sym.searchText ?? {}) as Record<string, string>;
      const unchanged =
        Object.keys(next).length === Object.keys(prev).length &&
        Object.entries(next).every(([k, val]) => prev[k] === val);
      if (unchanged) continue;

      await ctx.db.patch(sym._id, { searchText: next });
      patched++;
    }

    return {
      patched,
      pageCount: page.page.length,
      nextCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

/**
 * Driver: loops `backfillSearchTextPage` over the whole symbols table.
 * Run from the CLI:  `npx convex run migrations:backfillSearchText`
 * (optionally `--push` the schema first so the `searchText` field + indexes
 * exist). Safe to re-run — unchanged rows are skipped.
 */
export const backfillSearchText = action({
  args: { pageSize: v.optional(v.number()) },
  handler: async (
    ctx,
    { pageSize = 500 },
  ): Promise<{ totalPatched: number; totalScanned: number; pages: number }> => {
    let cursor: string | null = null;
    let totalPatched = 0;
    let totalScanned = 0;
    let pages = 0;
    // Hard cap mirrors the estimate scan in translationJobs — 58k / 500 ≈ 118
    // pages; 500 is a comfortable ceiling that also catches a runaway loop.
    while (pages < 500) {
      const res: {
        patched: number;
        pageCount: number;
        nextCursor: string;
        isDone: boolean;
      } = await ctx.runMutation(internal.migrations.backfillSearchTextPage, {
        cursor,
        pageSize,
      });
      totalPatched += res.patched;
      totalScanned += res.pageCount;
      pages++;
      if (res.isDone) break;
      cursor = res.nextCursor;
    }
    return { totalPatched, totalScanned, pages };
  },
});

// ─── Proper-noun translation correction ─────────────────────────────────────
//
// The symbol-translation AI deliberately leaves proper nouns unchanged ("the
// word becomes the same string"), so culturally-significant names that DO have
// a standard native-script form (Diwali → दिवाली) can end up displaying in
// Latin. The admin "Translate symbols" pass won't fix them — they already have
// a (Latin) `words.<locale>`, so it's not "missing".
//
// This corrects every symbol whose English word matches `en`: sets the native
// form, merges the Latin transliteration into `synonyms.<locale>` (so phonetic
// search keeps working), and recomputes `searchText.<locale>`. Idempotent.
// Reusable for the next proper noun a reviewer flags — until ADR-013's
// translator surface exists.
//
// Run, e.g. Diwali → दिवाली:
//   npx convex run migrations:fixSymbolProperNoun \
//     '{"en":"Diwali","locale":"hi","native":"दिवाली","translit":["diwali"]}'
export const fixSymbolProperNoun = mutation({
  args: {
    en: v.string(),                       // exact English word to match (words.en)
    locale: v.string(),                   // target language code, e.g. "hi"
    native: v.string(),                   // native-script form, e.g. "दिवाली"
    translit: v.optional(v.array(v.string())), // Latin transliteration(s) to keep searchable
  },
  handler: async (ctx, { en, locale, native, translit = [] }) => {
    const rows = await ctx.db
      .query("symbols")
      .withIndex("by_words_en", (q) => q.eq("words.en", en))
      .collect();

    let patched = 0;
    for (const sym of rows) {
      const words = { ...(sym.words as Record<string, string>), [locale]: native };
      const prevSyn = ((sym.synonyms ?? {}) as Record<string, string[]>)[locale] ?? [];
      const mergedSyn = Array.from(
        new Set([...prevSyn, ...translit].map((s) => s.trim()).filter(Boolean)),
      );
      const synonyms = {
        ...((sym.synonyms ?? {}) as Record<string, string[]>),
        [locale]: mergedSyn,
      };
      const searchText = {
        ...((sym.searchText ?? {}) as Record<string, string>),
        [locale]: [native, ...mergedSyn].map((s) => s.trim()).filter(Boolean).join(" "),
      };
      await ctx.db.patch(sym._id, { words, synonyms, searchText });
      patched++;
    }
    return { en, locale, native, matched: rows.length, patched };
  },
});

/**
 * Phase 14 (ADR-015) — backfill `units[]` on profileSentences from legacy
 * `slots[]`. Each slot becomes a `{ kind: "word" }` unit; `kind` is set to
 * "sentence" and `playback` to "fluent" (existing sentences are page-built with
 * whole-utterance audio). `slots` is left intact (still the rendered source until
 * later slices migrate readers to `units`). Idempotent — rows that already carry
 * `units` are skipped, so it is safe to re-run.
 */
export const backfillSentenceUnits = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("profileSentences").collect();
    let migrated = 0;
    let skipped = 0;
    for (const s of rows) {
      if (s.units !== undefined) {
        skipped++;
        continue;
      }
      const units = [...s.slots]
        .sort((a, b) => a.order - b.order)
        .map((slot, i) => ({
          kind: "word" as const,
          order: slot.order ?? i,
          imagePath: slot.imagePath,
          displayProps: slot.displayProps,
        }));
      await ctx.db.patch(s._id, {
        units,
        kind: "sentence" as const,
        playback: s.playback ?? ("fluent" as const),
      });
      migrated++;
    }
    return { total: rows.length, migrated, skipped };
  },
});
