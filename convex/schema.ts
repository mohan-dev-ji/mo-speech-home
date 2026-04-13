import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Reusable audio source validator (used in profileSymbols)
const audioSource = v.object({
  type: v.union(v.literal("r2"), v.literal("tts"), v.literal("recorded")),
  path: v.string(),
  ttsText: v.optional(v.string()),
  language: v.optional(v.string()),
});

export default defineSchema({
  // ─── EXISTING TABLES (extended) ───────────────────────────────────────────

  /**
   * Global SymbolStix symbol library.
   * Language fields are open-ended objects — adding a language is adding a field,
   * not a schema migration. Never hard-code "eng" anywhere in the app.
   */
  symbols: defineTable({
    words: v.object({
      eng: v.string(),
      hin: v.optional(v.string()),
    }),
    synonyms: v.optional(
      v.object({
        eng: v.optional(v.array(v.string())),
        hin: v.optional(v.array(v.string())),
      })
    ),
    imagePath: v.string(), // R2 path — SymbolStix licensed, read-only
    audio: v.object({
      eng: v.object({ default: v.string() }),
      hin: v.optional(v.object({ default: v.string() })),
    }),
    tags: v.array(v.string()),
    categories: v.array(v.string()), // SymbolStix default categories
    priority: v.optional(v.number()), // 1–500 for core vocabulary free tier
  })
    .index("by_priority", ["priority"])
    .searchIndex("search_words_eng", {
      searchField: "words.eng",
      filterFields: ["priority"],
    })
    .searchIndex("search_words_hin", {
      searchField: "words.hin",
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
    referredBy: v.optional(v.string()), // affiliate code captured on signup
    activeProfileId: v.optional(v.id("studentProfiles")), // which profile is active; null = fall back to first found
    lastActiveAt: v.number(),
    // ── Instructor-level preferences (saved here, not on student profile) ──
    locale: v.optional(v.string()),     // 'en' | 'hi' — drives UI locale routing
    themeSlug: v.optional(v.string()),  // flat theme key e.g. 'default' | 'sky'
    stateFlags: v.optional(v.object({
      grid_size:            v.optional(v.union(v.literal("large"), v.literal("medium"), v.literal("small"))),
      symbol_label_visible: v.optional(v.boolean()),
      symbol_text_size:     v.optional(v.union(v.literal("large"), v.literal("medium"), v.literal("small"), v.literal("xs"))),
      reduce_motion:        v.optional(v.boolean()),
      core_dropdown_visible: v.optional(v.boolean()),
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
   * language is open-ended ("eng" | "hin") — never cast to a fixed union.
   */
  studentProfiles: defineTable({
    accountId: v.id("users"),
    name: v.string(),
    dateOfBirth: v.optional(v.number()),
    profilePhoto: v.optional(v.string()), // R2 path
    language: v.string(), // "eng" | "hin" — open-ended
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
      lists_visible:      v.optional(v.boolean()), // Lists mode in categories; default true
      sentences_visible:  v.optional(v.boolean()), // Sentences mode in categories; default true
      first_thens_visible: v.optional(v.boolean()), // First Thens mode in categories; default true
      student_can_edit:   v.optional(v.boolean()), // Student can edit board content; default false
    }),
    updatedAt: v.number(),
  })
    .index("by_account_id", ["accountId"]),

  /**
   * A named category within a student's profile.
   * Categories are the root container for all AAC content.
   */
  profileCategories: defineTable({
    profileId: v.id("studentProfiles"),
    name: v.object({ eng: v.string(), hin: v.optional(v.string()) }),
    icon: v.string(),
    colour: v.string(),
    order: v.number(),
    librarySourceId: v.optional(v.string()), // loose ref to resourcePacks._id — reload defaults only
    updatedAt: v.number(),
  })
    .index("by_profile_id", ["profileId"])
    .index("by_profile_id_and_order", ["profileId", "order"]),

  /**
   * The most important table. Every symbol in a student's profile is a
   * profileSymbol record — whether from SymbolStix or custom.
   * Lists, sentences, and first-thens ALWAYS reference profileSymbolId,
   * never raw symbolId. This ensures overrides apply consistently everywhere.
   */
  profileSymbols: defineTable({
    profileId: v.id("studentProfiles"),
    profileCategoryId: v.id("profileCategories"),
    order: v.number(),

    // Discriminated union — determines where the image comes from
    imageSource: v.union(
      v.object({
        type: v.literal("symbolstix"),
        symbolId: v.id("symbols"),
      }),
      v.object({
        type: v.literal("googleImages"),
        imagePath: v.string(), // R2 path
        imageSourceUrl: v.optional(v.string()), // original URL (audit trail)
      }),
      v.object({
        type: v.literal("aiGenerated"),
        imagePath: v.string(), // R2 path
        aiPrompt: v.optional(v.string()), // stored for regeneration
      }),
      v.object({
        type: v.literal("userUpload"),
        imagePath: v.string(), // R2 path
      })
    ),

    label: v.object({ eng: v.string(), hin: v.optional(v.string()) }),

    // Per-language audio override — falls back to symbols.audio[language].default
    audio: v.optional(
      v.object({
        eng: v.optional(audioSource),
        hin: v.optional(audioSource),
      })
    ),

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
    .index("by_profile_id", ["profileId"])
    .index("by_profile_category_id", ["profileCategoryId"])
    .index("by_profile_category_id_and_order", ["profileCategoryId", "order"]),

  /**
   * A named ordered list within a category.
   * items is bounded in practice (AAC lists are short routines/choices).
   */
  profileLists: defineTable({
    profileId: v.id("studentProfiles"),
    profileCategoryId: v.id("profileCategories"),
    name: v.object({ eng: v.string(), hin: v.optional(v.string()) }),
    order: v.number(),
    librarySourceId: v.optional(v.string()),
    items: v.array(
      v.object({ profileSymbolId: v.id("profileSymbols"), order: v.number() })
    ),
    updatedAt: v.number(),
  })
    .index("by_profile_id", ["profileId"])
    .index("by_profile_category_id", ["profileCategoryId"])
    .index("by_profile_category_id_and_order", ["profileCategoryId", "order"]),

  /**
   * A pre-built sentence. Played as a single Chirp 3 HD TTS audio unit.
   * ttsAudioPath cached in R2 — regenerated on label or item change.
   */
  profileSentences: defineTable({
    profileId: v.id("studentProfiles"),
    profileCategoryId: v.id("profileCategories"),
    name: v.object({ eng: v.string(), hin: v.optional(v.string()) }),
    order: v.number(),
    librarySourceId: v.optional(v.string()),
    items: v.array(
      v.object({ profileSymbolId: v.id("profileSymbols"), order: v.number() })
    ),
    ttsAudioPath: v.optional(
      v.object({
        eng: v.optional(v.string()),
        hin: v.optional(v.string()),
      })
    ),
    ttsText: v.optional(
      v.object({
        eng: v.optional(v.string()),
        hin: v.optional(v.string()),
      })
    ),
    updatedAt: v.number(),
  })
    .index("by_profile_id", ["profileId"])
    .index("by_profile_category_id", ["profileCategoryId"])
    .index("by_profile_category_id_and_order", ["profileCategoryId", "order"]),

  /**
   * A First/Then visual schedule card.
   * Exactly two symbols — first and then.
   */
  profileFirstThens: defineTable({
    profileId: v.id("studentProfiles"),
    profileCategoryId: v.id("profileCategories"),
    name: v.object({ eng: v.string(), hin: v.optional(v.string()) }),
    order: v.number(),
    librarySourceId: v.optional(v.string()),
    first: v.object({
      profileSymbolId: v.id("profileSymbols"),
      labelOverride: v.optional(v.string()),
    }),
    then: v.object({
      profileSymbolId: v.id("profileSymbols"),
      labelOverride: v.optional(v.string()),
    }),
    updatedAt: v.number(),
  })
    .index("by_profile_id", ["profileId"])
    .index("by_profile_category_id", ["profileCategoryId"])
    .index("by_profile_category_id_and_order", ["profileCategoryId", "order"]),

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
    name: v.object({ eng: v.string(), hin: v.optional(v.string()) }),
    description: v.object({ eng: v.string(), hin: v.optional(v.string()) }),
    coverImagePath: v.string(),
    season: v.optional(v.string()),
    tags: v.array(v.string()),
    featured: v.boolean(),
    publishedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    createdBy: v.string(), // admin clerkUserId
    updatedAt: v.number(),
    // Snapshot of category + content at publish time
    category: v.object({
      name: v.object({ eng: v.string(), hin: v.optional(v.string()) }),
      icon: v.string(),
      colour: v.string(),
      symbols: v.array(
        v.object({
          symbolId: v.string(), // loose ref — may be symbolstix ID or custom
          labelOverride: v.optional(
            v.object({
              eng: v.optional(v.string()),
              hin: v.optional(v.string()),
            })
          ),
          display: v.optional(v.any()), // mirrors profileSymbol.display shape
          order: v.number(),
        })
      ),
    }),
    lists: v.array(v.any()),      // mirrors profileLists structure
    sentences: v.array(v.any()), // mirrors profileSentences structure
    firstThens: v.array(v.any()), // mirrors profileFirstThens structure
  })
    .index("by_featured", ["featured"])
    .index("by_season", ["season"]),

  /**
   * Colour themes. 6 starter flat themes seeded in Phase 0.
   * Premium themes gated behind Max tier.
   * tokens applied to CSS custom properties via ThemeContext.
   */
  themes: defineTable({
    name: v.object({ eng: v.string(), hin: v.optional(v.string()) }),
    slug: v.string(),
    description: v.optional(
      v.object({
        eng: v.optional(v.string()),
        hin: v.optional(v.string()),
      })
    ),
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
});
