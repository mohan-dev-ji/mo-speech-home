import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { LANGUAGE_MODULES } from "./data/languages/_index";

// Reusable audio source validator (used in profileSymbols)
// `type` encodes the active source: 'r2' = default (SymbolStix), 'tts' = generated, 'recorded' = user recording.
// `alternates` holds the inactive sources so the editor can flip back without losing them.
const audioSource = v.object({
  type: v.union(v.literal("r2"), v.literal("tts"), v.literal("recorded")),
  path: v.string(),
  ttsText: v.optional(v.string()),
  language: v.optional(v.string()),  // ISO 639-1 code ('en', 'hi', 'pa'). Migrated from 'eng'/'hin' in Phase 8.0.
  alternates: v.optional(v.object({
    default:   v.optional(v.string()),
    generated: v.optional(v.string()),
    recorded:  v.optional(v.string()),
  })),
});

// ─── Localised field shapes (ADR-009 §2) ─────────────────────────────────────
//
// Most bilingual fields use ISO 639-1 keyed open records — adding a language
// is adding a key, not a schema migration. Display logic uses
// `lib/languages/displayValue.ts` for the 3-tier fallback
// (value[currentLang] ?? value[defaultLang] ?? Object.values(value)[0]).
//
// `v.record(v.string(), v.string())` natively accepts the legacy `{eng, hin}`
// shape during the Phase 8.0 migration window, so no schema-validator drama —
// the migration script just rewrites the keys to `{en, hi}` in place.
//
const localisedString = v.record(v.string(), v.string());
const localisedStringArray = v.record(v.string(), v.array(v.string()));
const localisedAudioSource = v.record(v.string(), audioSource);

// `symbols.words` and `symbols.synonyms` are the one exception — Convex
// search/lookup indexes can only target statically-declared fields, so the
// indexable languages are spelled out in a closed object validator. Adding a
// new search language requires a code edit (per the ADR-009 §6.6 note and
// docs/4-builds/features/language-plugin-phase-8.md §"Risks worth
// pre-empting"). New languages start unindexed; promoting to "stable" adds
// the field + search index in one PR.
//
// Post-Phase-8.0 shape — per-language fields derived from
// `LANGUAGE_MODULES` (the same JSON catalogue that powers
// `i18n/routing.ts`). Adding a language to `convex/data/languages/<code>.json`
// + the barrel automatically widens the schema on the next `npx convex
// dev` push. Per ADR-009 §6.6: the only language with a *required* word
// is the default locale (`en`); everything else is optional, populated
// by Phase 8.2's translation pipeline (`convex/translationActions.ts`).
//
// **Why not `v.record(v.string(), v.string())`?** — Convex search /
// indexed-field references require the indexed field to exist on the
// validator at schema-evaluation time. An open record can't express that
// `words.en` exists. So we use `v.object` with a derived set of keys —
// closed at schema time, but auto-widening from the registry.
//
// **Promoting a new language to stable** still requires a one-line schema
// PR to add `searchIndex("search_words_<code>", ...)` below. The admin
// UI surfaces a copy-pasteable snippet when a translation job completes.
const DEFAULT_LOCALE = "en";

// The field map is built dynamically from `LANGUAGE_MODULES` so adding a
// language JSON automatically widens the schema on the next push. We cast
// to `any` on the field map to bypass TS's variance check on the
// per-key validator union (TS can't prove `en: v.string()` and
// `es: v.optional(v.string())` share a common type); the runtime
// validator is fully type-safe regardless. Convex codegen reads the
// validator and produces the correct narrow TS types for each field.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const symbolWordsFields: Record<string, any> = {};
for (const mod of LANGUAGE_MODULES) {
  symbolWordsFields[mod.code] =
    mod.code === DEFAULT_LOCALE ? v.string() : v.optional(v.string());
}
const symbolWords = v.object(symbolWordsFields);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const symbolSynonymsFields: Record<string, any> = {};
for (const mod of LANGUAGE_MODULES) {
  symbolSynonymsFields[mod.code] = v.optional(v.array(v.string()));
}
const symbolSynonyms = v.object(symbolSynonymsFields);

// Voice-keyed audio map — replaces the legacy path-storing shape on symbols.
// Per ADR-009 §4: the path is convention-resolved by
// `lib/audio/resolveAudioPath.ts`, not stored. This field records *whether*
// a voice has been seeded with a SymbolStix recording.
//
// During the Phase 8.0 migration window the validator accepts both new
// voice-keyed booleans AND the legacy `{eng: {default: string}}` shape so
// the deploy doesn't reject existing rows. After migration completes,
// tighten to just `v.record(v.string(), v.boolean())` in a follow-up.
const symbolAudioMigration = v.union(
  v.record(v.string(), v.boolean()),
  v.object({
    eng: v.object({ default: v.string() }),
    hin: v.optional(v.object({ default: v.string() })),
  })
);

// Per-language audio override on profileSymbols. Same migration-window union:
// new shape is `{ [iso]: audioSource }`, legacy is `{ eng?: audioSource, hin?: audioSource }`.
const profileSymbolAudioMigration = v.union(
  localisedAudioSource,
  v.object({
    eng: v.optional(audioSource),
    hin: v.optional(audioSource),
  })
);

// Field that was previously a single string and is becoming a localised
// record (profileLists.items[].description, profileSentences.text, etc.).
// During migration: accepts both. Tighten after migration completes.
const localisedStringMigration = v.union(v.string(), localisedString);

export default defineSchema({
  // ─── EXISTING TABLES (extended) ───────────────────────────────────────────

  /**
   * Global SymbolStix symbol library.
   * Language fields are ISO-keyed open records (`v.record(string, string)`) —
   * adding a language is adding a key, not a schema migration. Per ADR-009.
   * Never hard-code "en" or any other language code; route reads through
   * `displayValue()` and `useLocale()`.
   */
  symbols: defineTable({
    words: symbolWords,
    synonyms: v.optional(symbolSynonyms),
    imagePath: v.string(), // R2 path — SymbolStix licensed, read-only
    // Voice-keyed map of "is voice seeded with SymbolStix recording" booleans.
    // Path is convention-resolved by lib/audio/resolveAudioPath.ts. Per ADR-009 §4.
    // Migration union accepts legacy { eng: { default: path } } shape until Phase 8.0 completes.
    audio: symbolAudioMigration,
    // Per-symbol audio filename for the legacy en-GB-News-M voice — populated
    // by `migrations.backfillAudioBasenames` from the MVP's symbolstix-metadata
    // export. The MVP stored arbitrary basenames (e.g. SymbolStix IDs for many
    // symbols), so this can't be synthesised from `words.en`. New voices
    // seeded in Phase 8.4 follow the `<word>.mp3` convention and don't need
    // this field. Optional so seeds without it still validate.
    audioBasename: v.optional(v.string()),
    tags: v.array(v.string()),
    categories: v.array(v.string()), // SymbolStix default categories
    priority: v.optional(v.number()), // 1–500 for core vocabulary free tier
  })
    .index("by_priority", ["priority"])
    .index("by_imagePath", ["imagePath"])
    .index("by_words_en", ["words.en"])
    .searchIndex("search_words_en", {
      searchField: "words.en",
      filterFields: ["priority"],
    })
    .searchIndex("search_words_hi", {
      searchField: "words.hi",
      filterFields: ["priority"],
    })
    .searchIndex("search_words_es", {
      searchField: "words.es",
      filterFields: ["priority"],
    }),

  /**
   * One record per Clerk user.
   * Tier is derived from subscription.plan in the useSubscription hook —
   * not stored separately to avoid the stored value drifting out of sync.
   */
  users: defineTable({
    clerkUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    subscription: v.object({
      status: v.union(
        v.literal("trial"),
        v.literal("active"),
        v.literal("expired"),
        v.literal("cancelled"),
        v.literal("past_due")
      ),
      customAccess: v.optional(
        v.object({
          isActive: v.boolean(),
          reason: v.string(),
          grantedBy: v.string(), // admin clerkUserId
          grantedAt: v.number(),
          expiresAt: v.optional(v.number()),
        })
      ),
      trialEndsAt: v.optional(v.number()),
      subscriptionEndsAt: v.optional(v.number()),
      // Encodes both tier and billing interval — derive tier via plan.startsWith()
      plan: v.optional(
        v.union(
          v.literal("pro_monthly"),
          v.literal("pro_yearly"),
          v.literal("max_monthly"),
          v.literal("max_yearly")
        )
      ),
      stripeCustomerId: v.optional(v.string()),
      stripeSubscriptionId: v.optional(v.string()),
    }),
    // Append-only audit trail for admin custom-access grants and revocations.
    // Phase 7 — see docs/1-inbox/ideas/17-admin-dashboard.md §3 and the plan
    // at ~/.claude/plans/i-just-completed-this-ancient-floyd.md.
    // `performedBy` stores the admin's Clerk userId (resolve to display
    // name/email at read time so renames don't drift).
    customAccessHistory: v.optional(
      v.array(
        v.object({
          action: v.union(v.literal("granted"), v.literal("revoked")),
          reason: v.string(),
          performedBy: v.string(), // admin clerkUserId
          performedAt: v.number(),
          expiresAt: v.optional(v.number()),
          notes: v.optional(v.string()),
        })
      )
    ),
    referredBy: v.optional(v.string()), // affiliate code captured on signup
    activeProfileId: v.optional(v.id("studentProfiles")), // which profile is active; null = fall back to first found
    lastActiveAt: v.number(),
    // Product-analytics opt-out (PostHog). Absent or false = opted in (default);
    // true = opted out. Persisted server-side so the choice follows the user
    // across devices. See plan §1 and docs/1-inbox/ideas/21-product-analytics-posthog.md.
    analyticsOptOut: v.optional(v.boolean()),
    // ── Instructor-level preferences (saved here, not on student profile) ──
    locale: v.optional(v.string()),     // 'en' | 'hi' — drives UI locale routing
    themeSlug: v.optional(v.string()),  // flat theme key e.g. 'default' | 'sky'
    stateFlags: v.optional(v.object({
      grid_size:            v.optional(v.union(v.literal("large"), v.literal("medium"), v.literal("small"))),
      symbol_label_visible: v.optional(v.boolean()),
      symbol_text_size:     v.optional(v.union(v.literal("large"), v.literal("medium"), v.literal("small"), v.literal("xs"))),
      reduce_motion:        v.optional(v.boolean()),
      core_dropdown_visible: v.optional(v.boolean()),
      talker_visible:       v.optional(v.boolean()),
      header_in_banner_mode: v.optional(v.boolean()), // false=header in talker mode, true=header in banner mode
    })),
  })
    .index("by_clerk_id", ["clerkUserId"])
    .index("by_subscription_status", ["subscription.status"])
    .index("by_stripe_customer", ["subscription.stripeCustomerId"]),

  // ─── NEW TABLES ───────────────────────────────────────────────────────────

  /**
   * Additional family members on a Max-tier account.
   * All collaborators share the same student profile(s).
   */
  accountMembers: defineTable({
    accountId: v.id("users"),
    email: v.string(),
    clerkUserId: v.optional(v.string()), // set after they complete Clerk sign-up
    role: v.union(v.literal("owner"), v.literal("collaborator")),
    status: v.union(v.literal("pending"), v.literal("active")),
    invitedAt: v.number(),
    joinedAt: v.optional(v.number()),
  })
    .index("by_account_id", ["accountId"])
    .index("by_clerk_user_id", ["clerkUserId"])
    .index("by_account_id_and_status", ["accountId", "status"])
    .index("by_email", ["email"])
    .index("by_email_and_status", ["email", "status"]),

  /**
   * Student profile — one per student, shared by all account members.
   * stateFlags control what the student's view shows/hides.
   * `language` is an ISO 639-1 code stored as an open string — never cast to
   * a fixed union. Per ADR-009; runtime values resolved against the registry.
   */
  studentProfiles: defineTable({
    accountId: v.id("users"),
    name: v.string(),
    dateOfBirth: v.optional(v.number()),
    profilePhoto: v.optional(v.string()), // R2 path
    language: v.string(), // ISO 639-1 code, e.g. "en" | "hi" | "pa" — open-ended; resolved via registry
    voiceId: v.optional(v.string()), // e.g. 'en-GB-News-M' — defaults to DEFAULT_VOICE_ID
    themeId: v.optional(v.id("themes")), // reserved for Convex themes table (Phase 7)
    themeSlug: v.optional(v.string()),   // flat theme key used now e.g. 'default' | 'sky'
    purchasedThemeIds: v.optional(v.array(v.id("themes"))), // individually purchased premium themes
    stateFlags: v.object({
      home_visible: v.boolean(),
      search_visible: v.boolean(),
      categories_visible: v.boolean(),
      settings_visible: v.boolean(),
      talker_visible: v.boolean(),
      talker_banner_toggle: v.boolean(), // whether student can toggle talker/banner mode
      play_modal_visible: v.boolean(),
      voice_input_enabled: v.boolean(),
      audio_autoplay: v.boolean(),
      modelling_push: v.boolean(), // instructor can push modelling sessions
      core_dropdown_visible: v.boolean(), // core words/numbers/letters dropdown; default true
      reduce_motion: v.boolean(), // disables all theme animations; default false
      grid_size: v.optional(v.union(v.literal("large"), v.literal("medium"), v.literal("small"))), // large=4, medium=8, small=12 cols; optional for backwards compat (defaults to 'large')
      symbol_label_visible: v.optional(v.boolean()), // show/hide text label on symbol cards; defaults to true
      symbol_text_size: v.optional(v.union(v.literal("large"), v.literal("medium"), v.literal("small"), v.literal("xs"))), // h2/h4/p-bold/s-bold; defaults to 'small'
      // ── Student-facing permission flags (set by instructor) ──
      lists_visible:        v.optional(v.boolean()), // Lists nav item; default true
      sentences_visible:    v.optional(v.boolean()), // Sentences feature toggle; default true
      student_can_edit:     v.optional(v.boolean()), // Student can edit board content; default false
      student_can_filter:   v.optional(v.boolean()), // Student can use the pack-filter dropdown on listings; default false
      quick_settings_visible: v.optional(v.boolean()), // Quick-settings top-bar dropdown in student-view; default false
      header_in_banner_mode: v.optional(v.boolean()), // false=header in talker mode, true=header in banner mode
    }),
    studentViewLocked: v.optional(v.boolean()),  // when true on a student-view device, the breadcrumb dropdown is fully disabled. Toggled remotely by instructor.
    updatedAt: v.number(),
  })
    .index("by_account_id", ["accountId"]),

  /**
   * A named category within a student's profile.
   * Categories are the root container for all AAC content.
   */
  profileCategories: defineTable({
    accountId: v.optional(v.id("users")), // owner account; populated by migration. New writes always set this.
    profileId: v.optional(v.id("studentProfiles")), // legacy; kept optional so old docs validate. New writes omit.
    name: localisedString,
    icon: v.string(),
    colour: v.string(),
    imagePath: v.optional(v.string()), // R2 path for the folder cover image
    order: v.number(),
    librarySourceId: v.optional(v.string()), // loose ref to resourcePacks._id — set when content was loaded from a pack (reload-defaults only)
    // Snapshot's original name.en captured at load time. Used by
    // reloadCategoryFromLibrary to find the matching snapshot inside the pack
    // even after the instructor renames the category. Optional for back-compat
    // with rows loaded before this field existed.
    librarySourceCategoryKey: v.optional(v.string()),
    // Admin-only: forward link to the resourcePack this category is the source-of-truth for.
    // Set by setCategoryDefault / setCategoryInLibrary toggle mutations. When set, edits to
    // this category auto-rebuild the pack snapshot. Cleared on toggle-off, on delete, and
    // on starter pack restore. See ADR-008.
    publishedToPackId: v.optional(v.id("resourcePacks")),
    // Admin-only: V2 (ADR-010) forward link — points at the slug of the JSON
    // pack this category is the source-of-truth for. Set by the V2 toggle
    // mutations (`setCategoryDefaultV2`, `setCategoryInLibraryV2`). The
    // `/api/admin/pack-publish` route reads rows by this field to rebuild
    // `convex/data/library_packs/<slug>.json`. Cleared on toggle-off, on
    // delete, and on starter pack restore. Coexists with `publishedToPackId`
    // during the cutover; the latter is dropped in the deferred Phase X.
    packSlug: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_account_id", ["accountId"])
    .index("by_account_id_and_order", ["accountId", "order"])
    .index("by_profile_id", ["profileId"])
    .index("by_profile_id_and_order", ["profileId", "order"])
    .index("by_published_to_pack_id", ["publishedToPackId"])
    .index("by_pack_slug", ["packSlug"]),

  /**
   * The most important table. Every symbol in a student's profile is a
   * profileSymbol record — whether from SymbolStix or custom.
   * Lists, sentences, and first-thens ALWAYS reference profileSymbolId,
   * never raw symbolId. This ensures overrides apply consistently everywhere.
   */
  profileSymbols: defineTable({
    accountId: v.optional(v.id("users")), // owner account; populated by migration.
    profileId: v.optional(v.id("studentProfiles")), // legacy; kept optional for back-compat.
    profileCategoryId: v.id("profileCategories"),
    order: v.number(),

    // Discriminated union — determines where the image comes from
    imageSource: v.union(
      v.object({
        type: v.literal("symbolstix"),
        symbolId: v.id("symbols"),
      }),
      v.object({
        // External image search result (Wikimedia today; Pixabay/Unsplash/Pexels later).
        // Per-result provenance is tracked on each cached search result via `provider`,
        // not on this enum — the enum stays generic so adding a provider doesn't migrate.
        type: v.literal("imageSearch"),
        imagePath: v.string(), // R2 path
        imageSourceUrl: v.optional(v.string()), // original URL (audit trail) — e.g. Wikimedia file page
        attribution: v.optional(v.string()), // photographer / uploader credit
        license: v.optional(v.string()), // e.g. "CC BY-SA 4.0"
      }),
      v.object({
        type: v.literal("aiGenerated"),
        imagePath: v.string(), // R2 path
        aiPrompt: v.optional(v.string()), // stored for regeneration
      }),
      v.object({
        type: v.literal("userUpload"),
        imagePath: v.string(), // R2 path
      }),
      // Empty/placeholder state — used by the category-create modal to
      // seed slots with just a label. The instructor opens each placeholder
      // in SymbolEditorModal; the saved label drives the SymbolStix search,
      // so picking the matching symbol is a one-tap action. Placeholders
      // are filtered out by buildCategorySnapshot, so they never end up in
      // a published pack.
      v.object({
        type: v.literal("placeholder"),
      })
    ),

    label: localisedString,

    // Per-language audio override — falls back to convention-resolved path
    // via lib/audio/resolveAudioPath.ts when no override present.
    // Migration union accepts legacy { eng, hin } shape until Phase 8.0 completes.
    audio: v.optional(profileSymbolAudioMigration),

    // Display overrides — instructor-customised appearance
    display: v.optional(
      v.object({
        bgColour: v.optional(v.string()),
        textColour: v.optional(v.string()),
        textSize: v.optional(
          v.union(v.literal("sm"), v.literal("md"), v.literal("lg"), v.literal("xl"))
        ),
        borderColour: v.optional(v.string()),
        borderWidth: v.optional(v.number()),
        showLabel: v.optional(v.boolean()),
        showImage: v.optional(v.boolean()),
        shape: v.optional(
          v.union(v.literal("square"), v.literal("rounded"), v.literal("circle"))
        ),
      })
    ),

    updatedAt: v.number(),
  })
    .index("by_account_id", ["accountId"])
    .index("by_profile_id", ["profileId"])
    .index("by_profile_category_id", ["profileCategoryId"])
    .index("by_profile_category_id_and_order", ["profileCategoryId", "order"]),

  /**
   * Global TTS cache — shared across all profiles and voices.
   * Populated by POST /api/tts on cache miss. Never deleted.
   */
  ttsCache: defineTable({
    text: v.string(),       // normalised (lowercase, trimmed)
    voiceId: v.string(),    // e.g. 'en-GB-News-M'
    r2Key: v.string(),      // audio/{voiceId}/tts/{uuid}.mp3
    charCount: v.number(),  // for cost tracking
  }).index("by_text_voice", ["text", "voiceId"]),

  /**
   * A named ordered list. Profile-level — not tied to a category.
   * Items store imagePath directly (SymbolStix path or R2 upload path).
   * First Then is a display toggle, not a separate table.
   */
  profileLists: defineTable({
    accountId: v.optional(v.id("users")), // owner account; populated by migration.
    profileId: v.optional(v.id("studentProfiles")), // legacy; kept optional for back-compat.
    name: localisedString,
    order: v.number(),
    librarySourceId: v.optional(v.string()),
    items: v.array(
      v.object({
        imagePath: v.optional(v.string()),
        order: v.number(),
        // Localised list-item description. Migrated from single-string to
        // localised record in Phase 8.0; union accepts both during migration.
        description: v.optional(localisedStringMigration),
        audioPath: v.optional(v.string()), // active audio path — what playback uses
        // Active-source model: which audio is in use, plus the inactive alternates so
        // the editor can flip between sources non-destructively on re-edit.
        activeAudioSource: v.optional(v.union(
          v.literal("default"), v.literal("generate"), v.literal("record")
        )),
        defaultAudioPath:   v.optional(v.string()), // derived from picked SymbolStix symbol
        generatedAudioPath: v.optional(v.string()), // R2 key from Generate
        recordedAudioPath:  v.optional(v.string()), // R2 key from Record
        // Image source the user picked, so the editor lands on the right tab on re-edit.
        imageSourceType: v.optional(v.union(
          v.literal("symbolstix"), v.literal("upload"),
          v.literal("imageSearch"), v.literal("aiGenerated")
        )),
      })
    ),
    displayFormat: v.optional(v.union(v.literal("rows"), v.literal("columns"), v.literal("grid"))),
    showNumbers: v.optional(v.boolean()),
    showChecklist: v.optional(v.boolean()),
    showFirstThen: v.optional(v.boolean()),
    // Admin-only forward link — see profileCategories.publishedToPackId.
    publishedToPackId: v.optional(v.id("resourcePacks")),
    // V2 (ADR-010) — see profileCategories.packSlug.
    packSlug: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_account_id", ["accountId"])
    .index("by_account_id_and_order", ["accountId", "order"])
    .index("by_profile_id", ["profileId"])
    .index("by_profile_id_and_order", ["profileId", "order"])
    .index("by_published_to_pack_id", ["publishedToPackId"])
    .index("by_pack_slug", ["packSlug"]),

  /**
   * A pre-built sentence. Profile-level — not tied to a category.
   * Slots store imagePath + displayProps. Audio is at sentence level.
   */
  profileSentences: defineTable({
    accountId: v.optional(v.id("users")), // owner account; populated by migration.
    profileId: v.optional(v.id("studentProfiles")), // legacy; kept optional for back-compat.
    name: localisedString,
    order: v.number(),
    librarySourceId: v.optional(v.string()),
    // Sentence text — feeds TTS and display. Localised: migrated from single-string
    // to localised record in Phase 8.0; union accepts both during migration.
    text: v.optional(localisedStringMigration),
    slots: v.array(
      v.object({
        order: v.number(),
        imagePath: v.optional(v.string()),
        displayProps: v.optional(v.object({
          bgColour: v.optional(v.string()),
          textColour: v.optional(v.string()),
          textSize: v.optional(v.union(v.literal("sm"), v.literal("md"), v.literal("lg"), v.literal("xl"))),
          showLabel: v.optional(v.boolean()),
          showImage: v.optional(v.boolean()),
          cardShape: v.optional(v.union(v.literal("square"), v.literal("rounded"), v.literal("circle"))),
        })),
      })
    ),
    audioPath: v.optional(v.string()), // global TTS key or profiles/.../audio/...
    // Admin-only forward link — see profileCategories.publishedToPackId.
    publishedToPackId: v.optional(v.id("resourcePacks")),
    // V2 (ADR-010) — see profileCategories.packSlug.
    packSlug: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_account_id", ["accountId"])
    .index("by_account_id_and_order", ["accountId", "order"])
    .index("by_profile_id", ["profileId"])
    .index("by_profile_id_and_order", ["profileId", "order"])
    .index("by_published_to_pack_id", ["publishedToPackId"])
    .index("by_pack_slug", ["packSlug"]),

  /**
   * Real-time modelling session. Instructor pushes; student device subscribes.
   * steps are pre-computed on session creation from the symbol's category location.
   */
  modellingSessions: defineTable({
    profileId: v.id("studentProfiles"),
    initiatedBy: v.string(), // instructor clerkUserId
    symbolId: v.id("symbols"),
    symbolPreview: v.object({ word: v.string(), imagePath: v.string() }),
    steps: v.array(
      v.object({ screen: v.string(), highlight: v.string() })
    ),
    currentStep: v.number(),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    completedAt: v.optional(v.number()),
  })
    .index("by_profile_id", ["profileId"])
    .index("by_profile_id_and_status", ["profileId", "status"]),

  /**
   * Admin-managed resource packs loaded into student profiles.
   * Once loaded, the profile content is fully independent — library not touched again.
   * librarySourceId on profile records is a loose ref back here for reload-defaults only.
   */
  resourcePacks: defineTable({
    // Transient slug field added in Phase 2 of the ADR-010 rollout. Used by
    // the migration export script (Phase 3) to filename-key each pack's
    // JSON file. Removed in the deferred Phase X cleanup along with the
    // rest of this table.
    slug: v.optional(v.string()),
    name: localisedString,
    description: localisedString,
    coverImagePath: v.string(),
    season: v.optional(v.string()),
    tags: v.array(v.string()),
    featured: v.boolean(),
    // Exactly one row should have isStarter: true — this is the canonical starter pack
    // used by loadStarterTemplate during seedDefaultAccount. Invariant enforced at the
    // mutation layer (materialiseStarterPack queries before writing). See ADR-008.
    isStarter: v.optional(v.boolean()),
    // Per-pack plan tier. Required for non-starter packs (gates loadResourcePack);
    // starter pack is implicitly "free" regardless of this field. Optional in the schema
    // for back-compat with existing rows pre-toggle-chunk; new toggle mutations always set it.
    // Patch the existing starter pack to tier: "free" via Convex dashboard.
    tier: v.optional(
      v.union(v.literal("free"), v.literal("pro"), v.literal("max"))
    ),
    publishedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    createdBy: v.string(), // admin clerkUserId
    updatedAt: v.number(),
    // Snapshot of categories + content at publish time. Optional + array so a pack can be
    // multi-category (starter pack, themed bundles), single-category, or content-only
    // (lists/sentences without categories).
    categories: v.optional(
      v.array(
        v.object({
          // Reverse link to the source profileCategory so toggle mutations can
          // find-and-replace the correct entry without name-matching. Optional
          // because pre-toggle-chunk entries (DEFAULT_CATEGORIES seed) lack it.
          sourceProfileCategoryId: v.optional(v.id("profileCategories")),
          name: localisedString,
          icon: v.string(),
          colour: v.string(),
          imagePath: v.optional(v.string()), // R2 path for folder cover, mirrors profileCategories.imagePath
          symbols: v.array(
            v.object({
              symbolId: v.string(), // loose ref — may be symbolstix ID or custom
              labelOverride: v.optional(localisedString),
              display: v.optional(v.any()), // mirrors profileSymbol.display shape
              order: v.number(),
            })
          ),
        })
      )
    ),
    lists: v.array(
      v.object({
        // Reverse link — see categories[].sourceProfileCategoryId.
        sourceProfileListId: v.optional(v.id("profileLists")),
        name: localisedString,
        order: v.number(),
        items: v.array(
          v.object({
            order: v.number(),
            // Optional loose ref — present for symbolstix-sourced items so
            // re-materialise can pick up updated images. Items from upload /
            // imageSearch / aiGenerated rely on imagePath alone. V1 save
            // mutations don't populate this; deferred to Phase 7 enhancement.
            symbolId: v.optional(v.string()),
            imagePath: v.optional(v.string()),
            // Localised — see profileLists.items[].description.
            description: v.optional(localisedStringMigration),
            audioPath: v.optional(v.string()),
            activeAudioSource: v.optional(
              v.union(
                v.literal("default"),
                v.literal("generate"),
                v.literal("record")
              )
            ),
            defaultAudioPath: v.optional(v.string()),
            generatedAudioPath: v.optional(v.string()),
            recordedAudioPath: v.optional(v.string()),
            imageSourceType: v.optional(
              v.union(
                v.literal("symbolstix"),
                v.literal("upload"),
                v.literal("imageSearch"),
                v.literal("aiGenerated")
              )
            ),
          })
        ),
        displayFormat: v.optional(
          v.union(v.literal("rows"), v.literal("columns"), v.literal("grid"))
        ),
        showNumbers: v.optional(v.boolean()),
        showChecklist: v.optional(v.boolean()),
        showFirstThen: v.optional(v.boolean()),
      })
    ),
    sentences: v.array(
      v.object({
        // Reverse link — see categories[].sourceProfileCategoryId.
        sourceProfileSentenceId: v.optional(v.id("profileSentences")),
        name: localisedString,
        order: v.number(),
        // Localised — see profileSentences.text.
        text: v.optional(localisedStringMigration),
        slots: v.array(
          v.object({
            order: v.number(),
            symbolId: v.optional(v.string()),
            imagePath: v.optional(v.string()),
            displayProps: v.optional(
              v.object({
                bgColour: v.optional(v.string()),
                textColour: v.optional(v.string()),
                textSize: v.optional(
                  v.union(
                    v.literal("sm"),
                    v.literal("md"),
                    v.literal("lg"),
                    v.literal("xl")
                  )
                ),
                showLabel: v.optional(v.boolean()),
                showImage: v.optional(v.boolean()),
                cardShape: v.optional(
                  v.union(
                    v.literal("square"),
                    v.literal("rounded"),
                    v.literal("circle")
                  )
                ),
              })
            ),
          })
        ),
        audioPath: v.optional(v.string()),
      })
    ),
  })
    .index("by_featured", ["featured"])
    .index("by_season", ["season"])
    .index("by_isStarter", ["isStarter"])
    .index("by_slug", ["slug"]),

  /**
   * Pack lifecycle overlay — per ADR-010. Holds runtime catalogue metadata
   * (publish window, featured flag, tier override, season override) for packs
   * whose content lives in `convex/data/library_packs/<slug>.json`. The
   * `/library` query merges this table with the bundled JSON to compute the
   * visible catalogue. Admin dashboard (Phase 7) edits these rows to change
   * lifecycle without a code deploy.
   *
   * A pack is visible iff a row here exists AND `publishedAt <= now` AND
   * (`expiresAt` unset OR `expiresAt > now`). Tier comes from `tierOverride
   * ?? pack.defaultTier`. Featured comes from `featured`.
   */
  packLifecycle: defineTable({
    slug: v.string(),
    // Pack metadata stored here so the picker can show the pack name before
    // the first publish (the JSON file doesn't exist yet for brand-new
    // packs). The `/api/admin/pack-publish` route copies these into the
    // JSON; the JSON is the canonical store after first publish.
    name: v.optional(localisedString),
    description: v.optional(
      localisedString
    ),
    coverImagePath: v.optional(v.string()),
    publishedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    featured: v.boolean(),
    tierOverride: v.optional(
      v.union(v.literal("free"), v.literal("pro"), v.literal("max"))
    ),
    /**
     * @deprecated Use `tags` instead. Kept for read-fallback during the
     * tag-system migration — when an admin edits a pack that still has
     * `seasonOverride` set but no `tags`, the picker pre-fills with the
     * legacy value as a single tag; saving migrates it. To be removed in
     * a follow-up cleanup once all packs are tagged.
     */
    seasonOverride: v.optional(v.string()),
    /**
     * Free-form tags driving the admin Library catalogue filters and (in
     * a future iteration) instructor-facing browse. Server normalises to
     * lowercase + trim + dedupe. New tags are created the moment an admin
     * types them — the catalogue's vocabulary self-organises from use.
     */
    tags: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    createdBy: v.string(), // Clerk userId of the admin who first published the slug
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_createdBy", ["createdBy"]),

  /**
   * Language lifecycle overlay — per ADR-009 + ADR-011. Mirrors `packLifecycle`
   * shape for the language plugin. Holds runtime catalogue metadata for
   * languages whose content (UI strings + voice metadata + status) lives in
   * `convex/data/languages/<code>.json`. A language is visible iff a row here
   * exists AND `publishedAt <= now` AND (`expiresAt` unset OR `expiresAt > now`)
   * AND `status` matches the picker's `getVisibleLanguages` filter.
   *
   * `slug` is the ISO 639-1 code (`en`, `hi`, `pa`, …). `status` mirrors ADR-009 §3
   * and gates picker visibility: stable shows everywhere; beta shows with a
   * preview badge; machine-translated is hidden in prod (dev flag toggles it on).
   */
  languageLifecycle: defineTable({
    slug: v.string(),                            // ISO 639-1 code
    status: v.union(
      v.literal("machine-translated"),
      v.literal("beta"),
      v.literal("stable")
    ),
    publishedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    // Tier override — usually unset (languages default to free). Reserved for
    // future paid-language scenarios; mechanism mirrors `packLifecycle.tierOverride`.
    tierOverride: v.optional(
      v.union(v.literal("free"), v.literal("pro"), v.literal("max"))
    ),
    notes: v.optional(v.string()),
    createdBy: v.string(),                       // Clerk userId of admin who added the language
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"]),

  /**
   * Translation job tracking — Phase 8.2 + 8.3. One row per (slug, kind) pair.
   * Drives the `/admin/languages` progress bar, makes the pipeline resumable
   * across action invocations + crashes, and captures `actualTokens` so we
   * can compare against the dry-run estimate.
   *
   * **Lifecycle:**
   *   queued    → admin clicked "Start" but the first action hasn't run yet
   *   running   → action is actively processing batches
   *   paused    → admin clicked "Pause" mid-run; can resume from cursor
   *   completed → processedCount === totalCount, no more work
   *   failed    → last action threw; `lastError` carries the message
   *
   * **Resumability:** `cursor` is the Convex pagination cursor returned by
   * the last successful batch. On resume, the action picks up where it
   * left off — no symbol is re-translated.
   *
   * **One-row-per-(slug, kind):** re-running the same job kind for the
   * same language re-uses the row (patches it back to `running`). Deleting
   * the row resets state entirely.
   */
  translationJobs: defineTable({
    slug: v.string(),                            // ISO 639-1 code
    kind: v.union(
      v.literal("symbols-words"),                // Phase 8.2 — words + synonyms
      v.literal("library-packs")                 // Phase 8.3 — pack content
    ),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("failed")
    ),
    // Pagination cursor for the next batch. `null` (or undefined) means
    // "start at the beginning". Updated after each batch's mutation.
    cursor: v.optional(v.union(v.string(), v.null())),
    // Counts — `totalCount` is fixed at job start (snapshot of source size);
    // `processedCount` ticks up after each batch's writes commit.
    totalCount: v.number(),
    processedCount: v.number(),
    // Cost / token bookkeeping. Estimates set at dry-run; actuals accumulate
    // as the pipeline runs so admin can compare.
    estimatedTokens: v.optional(v.number()),
    actualInputTokens: v.optional(v.number()),
    actualOutputTokens: v.optional(v.number()),
    // Timestamps. `startedAt` is the first batch's start; `completedAt` is
    // set when the row reaches a terminal state (completed / failed).
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    // Diagnostic. Cleared on resume; set on failure / pause.
    lastError: v.optional(v.string()),
    createdBy: v.string(),                       // Clerk userId who kicked it off
    updatedAt: v.number(),
  })
    .index("by_slug_and_kind", ["slug", "kind"])
    .index("by_status", ["status"]),

  /**
   * Colour themes. 6 starter flat themes seeded in Phase 0.
   * Premium themes gated behind Max tier.
   * tokens applied to CSS custom properties via ThemeContext.
   */
  themes: defineTable({
    name: localisedString,
    slug: v.string(),
    description: v.optional(localisedString),
    previewColour: v.string(),
    coverImagePath: v.optional(v.string()),
    tier: v.union(v.literal("free"), v.literal("premium")),
    season: v.optional(v.string()),
    featured: v.boolean(),
    publishedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    createdBy: v.string(), // admin clerkUserId
    updatedAt: v.number(),
    tokens: v.object({
      bgPrimary: v.string(),
      bgSurface: v.string(),
      bgSurfaceAlt: v.string(),
      brandPrimary: v.string(),
      brandSecondary: v.string(),
      brandTertiary: v.string(),
      textPrimary: v.string(),
      textSecondary: v.string(),
      textOnBrand: v.string(),
      symbolCardBg: v.string(),
      symbolCardText: v.string(),
      symbolCardBorder: v.string(),
      symbolCardGlow: v.string(),
      talkerBg: v.string(),
      talkerText: v.string(),
      talkerBorder: v.string(),
      navBg: v.string(),
      navText: v.string(),
      navTextActive: v.string(),
      navIndicator: v.string(),
      success: v.string(),
      warning: v.string(),
      error: v.string(),
      overlay: v.string(),
    }),
  })
    .index("by_slug", ["slug"])
    .index("by_tier", ["tier"])
    .index("by_featured", ["featured"]),

  /**
   * Affiliate programme. Admin grants affiliate status.
   * Stripe Connect handles payouts.
   */
  affiliates: defineTable({
    userId: v.id("users"),
    affiliateCode: v.string(),
    status: v.union(
      v.literal("invited"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("revoked")
    ),
    commissionModel: v.union(
      v.literal("first_month"),
      v.literal("recurring"),
      v.literal("flat_fee")
    ),
    commissionRate: v.optional(v.number()), // percentage
    flatFeeAmount: v.optional(v.number()), // pence
    stripeAccountId: v.optional(v.string()), // Stripe Connect account ID
    stripeOnboardingComplete: v.boolean(),
    totalReferrals: v.number(),
    activeSubscribers: v.number(),
    lifetimeEarningsPence: v.number(),
    pendingPayoutPence: v.number(),
    notes: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_affiliate_code", ["affiliateCode"])
    .index("by_status", ["status"]),

  /**
   * One record per commission-generating Stripe event.
   * Automatic Stripe transfer to affiliate's connected account.
   */
  commissionEvents: defineTable({
    affiliateId: v.id("affiliates"),
    referredUserId: v.id("users"),
    stripeInvoiceId: v.string(),
    stripeTransferId: v.optional(v.string()),
    amountPence: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("transferred"),
      v.literal("failed")
    ),
    commissionModel: v.string(),
    transferredAt: v.optional(v.number()),
  })
    .index("by_affiliate_id", ["affiliateId"])
    .index("by_referred_user_id", ["referredUserId"])
    .index("by_stripe_invoice_id", ["stripeInvoiceId"]),

  /**
   * Cache of external image-search results (Wikimedia Commons today; same shape
   * for any future provider). Keyed by normalised query + page so paginated
   * scrolls stay cached. Provider returns ~20 results per page; we re-fetch on
   * cache miss only. 24h TTL — fresh enough that new uploads surface, slow
   * enough to keep API calls minimal.
   */
  imageSearchCache: defineTable({
    query: v.string(), // normalised: lowercase, trimmed
    page: v.number(),  // 0-indexed
    results: v.array(
      v.object({
        providerId: v.string(), // native provider ID; Wikimedia pageId coerced via String()
        provider: v.string(),   // 'wikimedia' | 'pixabay' | 'unsplash' | 'pexels'
        title: v.string(),
        thumbnailUrl: v.string(), // ~320px target
        fullImageUrl: v.string(), // ~640px target — proxy streams this directly
        sourceUrl: v.string(),
        attribution: v.string(),
        license: v.string(),
        width: v.number(),
        height: v.number(),
        mime: v.string(),
      })
    ),
    expiresAt: v.number(),
  }).index("by_query_and_page", ["query", "page"]),

  /**
   * Global cache of AI-generated images, keyed by sha256(style|prompt).
   * Shared across all Max users — repeated "tree → iconic" hits R2, not Imagen.
   * No expiry; entries are intentionally permanent. `hits` is bumped on cache reads
   * so a future "community library" phase can surface popular generations.
   * r2Key points to ai-cache/{uuid}.png (PNG, ~1MB, untouched from Imagen).
   */
  aiImageCache: defineTable({
    hash: v.string(),    // sha256 of `${style}|${prompt.toLowerCase().trim()}`
    prompt: v.string(),  // original user prompt (pre-style-wrap), for analytics
    style: v.string(),   // 'photorealistic' | 'iconic' | 'storybook' | 'claymation'
    r2Key: v.string(),   // ai-cache/{uuid}.png — global, shared across users
    hits: v.number(),    // incremented on cache hit
  }).index("by_hash", ["hash"]),

  /**
   * Per-user per-day quota counters for metered features.
   * Day key is YYYY-MM-DD UTC. One row per (userId, feature, day).
   * Shared infra — image search uses 'imageSearch'; AI gen will use 'aiImageGenerate'.
   */
  featureQuota: defineTable({
    userId: v.string(),  // clerk user id (identity.subject)
    feature: v.string(), // e.g. 'imageSearch'
    day: v.string(),     // 'YYYY-MM-DD' UTC
    count: v.number(),
  }).index("by_user_and_feature_and_day", ["userId", "feature", "day"]),

  /**
   * Live student-view sessions for presence-based instructor toast.
   * One row per browser tab currently rendering a profile in student-view.
   * Heartbeat refreshes lastSeen every 15s; rows with lastSeen > 30s old are stale.
   * Cron drops rows older than 5 minutes.
   */
  studentViewSessions: defineTable({
    profileId: v.id("studentProfiles"),
    sessionId: v.string(),       // random uuid generated per browser tab (sessionStorage)
    clerkUserId: v.string(),     // identity.subject — who's holding the session
    lastSeen: v.number(),        // ms timestamp; heartbeat updates this
  })
    .index("by_profile", ["profileId"])
    .index("by_session", ["sessionId"]),
});
