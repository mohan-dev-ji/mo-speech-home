/**
 * Client-side product analytics — typed `track()` helper.
 *
 * Every event in the catalogue (see docs/1-inbox/ideas/21-product-analytics-posthog.md)
 * is declared in the `EventMap` below. TypeScript fails compilation if anyone
 * calls `track("typo_event")` or omits a required property.
 *
 * **Event Shape Discipline** — plugin dimensions (`language`, `theme_slug`,
 * `pack_slug`, `voice_id`) use open `string` types so future languages /
 * themes / pack types flow through analytics with zero code change. Internal
 * app state (tier, status, action) uses literal unions because the enum is
 * intrinsic to the app, not extended by plugins.
 *
 * No-ops gracefully when `NEXT_PUBLIC_POSTHOG_KEY` is absent (dev / CI /
 * preview without analytics) or when called server-side.
 */

import posthog from "posthog-js";
import type { SubscriptionTier } from "@/types";

// ── Event catalogue ──────────────────────────────────────────────────────────

type EventMap = {
  // Onboarding funnel
  signed_up:               { has_referral_code: boolean };
  voice_selected:          { voice_id: string; language: string };
  student_profile_created: { language: string; profile_count: number };
  first_symbol_tapped:     { days_since_signup: number };

  // Engagement (aggregate behaviour — never content)
  symbol_tapped:           {
    category_tier: SubscriptionTier;
    pack_slug?: string;
    source: "category" | "search" | "dropdown";
  };
  pack_loaded:             {
    slug: string;
    tier_at_load: SubscriptionTier;
    source?: "library" | "post_signup";
  };
  pack_browsed:            { tier: SubscriptionTier; filter_tags?: string[] };
  theme_changed:           {
    from_theme: string;
    to_theme: string;
    tier: SubscriptionTier;
  };
  language_switched:       { from: string; to: string };
  profile_switched:        { profile_count: number };
  modelling_started:       Record<string, never>;
  modelling_ended:         { duration_seconds: number; taps_count: number };
  image_search_used:       {
    tier: SubscriptionTier;
    cached: boolean;
    results_count: number;
  };
  ai_generate_used:        { tier: SubscriptionTier; cached: boolean };

  // Pricing + revenue intent (client-side; outcome events fire server-side)
  viewed_pricing:          { source: "nav" | "upgrade_nudge" | "settings" };
  clicked_upgrade:         {
    from_tier: SubscriptionTier;
    target_tier: "pro" | "max";
    source: string;
  };
  started_checkout:        { plan: string };
};

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Capture a named product-analytics event.
 *
 * Fire-and-forget — never blocks UI. Silently no-ops on the server side and
 * when PostHog isn't configured. Type-safe: every event name must exist in
 * `EventMap` and the properties must match the declared shape.
 */
export function track<E extends keyof EventMap>(
  event: E,
  properties: EventMap[E]
): void {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  posthog.capture(event, properties);
}

/**
 * Re-export type to help downstream call sites declare event payloads
 * without importing `EventMap` directly.
 */
export type AnalyticsEvent = keyof EventMap;
export type AnalyticsProperties<E extends AnalyticsEvent> = EventMap[E];
