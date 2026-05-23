# Product Analytics with PostHog

## Why This Matters Now

The MVP answered one question: *"is anyone using this?"* Yes — 100+ instructors, organic growth, real retention. That question is closed.

The next-stage questions are different and the existing data layer can't answer them:

- Where do new signups drop off? Voice selection? Profile creation? First symbol tap? Pricing?
- Do free users come back on day 2? Day 7? Day 30?
- Which packs / themes / features get used vs ignored?
- What's the conversion path from free → Pro → Max?
- Are Max-tier users actually using image search and AI generation (the features they're paying for)?
- When users cancel, what was their last action?

These are **product analytics** questions — funnels, retention cohorts, paths, feature usage. They need an event-stream data model, not a per-profile usage buffer.

The MVP shipped without this layer because the founder wanted to launch and see if anything stuck. Now that there's real usage and an upgrade path matters, flying blind costs more than the tool does.

---

## Tool: PostHog

Shortlist evaluated:

| Tool | Verdict |
|---|---|
| **PostHog** | ✅ **Chosen.** Open source, self-hostable, free 1M events/month, full funnels + retention + paths + session replay (toggleable), feature flags + A/B testing built-in. Best Next.js + Convex fit. |
| Mixpanel | Mature but pricier at scale; less flexibility for self-hosting / EU residency. |
| Amplitude | Enterprise-skewed. Heavier UI than needed solo. |
| Heap | Auto-captures everything — concerning for a child-adjacent app. |
| Plausible / Fathom | Lightweight web analytics only — no funnels or events. Insufficient. |

PostHog also unlocks two adjacent capabilities we'll want later: **feature flags** (tier-gate A/B tests, dark launches of features like Themes-as-pack) and **experimentation** (test pricing copy, onboarding flows). Same tool, same identify call, no second vendor.

**Eject path:** if EU data residency ever matters, PostHog can be self-hosted on Hetzner / Fly for ~£20/month. No vendor lock-in.

---

## ⚠️ Privacy — Child-Adjacent Product

Mo Speech is used by children. Even though the Clerk-authenticated user is the adult instructor, **the activity inside the app is a child's communication**. Bake these principles in from the start; retrofitting privacy is harder than designing it.

### Hard rules

- **No auto-capture.** PostHog's default mode records every click, every page view, every input. Disable it globally. Manual `posthog.capture('event_name', { ... })` only.
- **No session replay on student-view pages.** Acceptable on settings / pricing / marketing surfaces where the adult is interacting. Off everywhere a student profile is active. Use PostHog's `session_recording.maskAllInputs` and route-level config.
- **Identify by Clerk userId, never by student profile.** `posthog.identify(clerkUserId)` is the only personal identifier we send. Student profile names, photos, custom labels — none of these leave the device.
- **No symbol labels in event payloads.** Record `symbol_tapped` with `{ category: 'feelings', tier: 'free' }`. Never `{ label: 'angry' }`. We learn aggregate patterns, not what specific children are saying.
- **No pack / list / sentence content in payloads.** `pack_loaded` carries `{ slug, tier }`. Custom user-created pack contents never leave the device.
- **IP anonymisation on.** PostHog's `process_person_profile: 'identified_only'` + `ip: false` (or hashed) — no IP-based geolocation by default.
- **GDPR & CCPA respect.** Cookieless mode (`persistence: 'memory'` for unauthenticated visitors); `posthog.opt_out_capturing()` for users who request it; surface a "no analytics" toggle in Settings.

### Soft rules

- **Region:** V1 ships on PostHog US Cloud. Defensible for a solo-founder MVP with DPA in place. Migrate to EU Cloud later if an enterprise / NHS / school-district customer requires strict UK/EU data residency in their procurement contract. **Host gotcha:** the ingest endpoint is `https://us.i.posthog.com` (note the `.i.`) — `https://us.posthog.com` is the dashboard URL only, and pointing `api_host` at it silently drops events. EU equivalents: `https://eu.i.posthog.com` (ingest) vs `https://eu.posthog.com` (dashboard).
- **Test events in dev are tagged** with `environment: 'dev'` so analytics charts don't pollute with internal usage.

---

## Event Catalogue

The set we ship in V1. Refined as we learn what funnels matter. Each event is a small, typed `track()` call.

### Onboarding funnel

The most important funnel for growth — where users bounce determines what to fix.

| Event | When | Properties |
|---|---|---|
| `signed_up` | Clerk webhook fires `user.created` | `{ has_referral_code: boolean }` |
| `voice_selected` | VoiceModal save | `{ voice_id, language }` |
| `student_profile_created` | First profile creation | `{ language, profile_count }` |
| `first_symbol_tapped` | First-ever tap event for an account | `{ days_since_signup }` |
| `first_pack_loaded` | First non-starter pack loaded | `{ slug, tier_at_load }` |
| `viewed_pricing` | Pricing page rendered | `{ source: 'nav' \| 'upgrade_nudge' \| 'settings' }` |
| `clicked_upgrade` | Any upgrade-nudge / pricing CTA | `{ from_tier, target_tier, source }` |
| `started_checkout` | Stripe checkout session opened | `{ plan: pro_monthly \| ... }` |
| `subscribed` | Stripe webhook `checkout.session.completed` | `{ plan, amount, currency }` |
| `checkout_abandoned` | 24h after `started_checkout` with no `subscribed` | `{ plan }` |

### Engagement (aggregate signal, no content)

| Event | When | Properties |
|---|---|---|
| `session_started` | First app load per day (debounced) | `{ tier, language, has_modelling_today: boolean }` |
| `symbol_tapped` | Category symbol tap | `{ category_tier, pack_slug?, source: 'category' \| 'search' \| 'dropdown' }` |
| `pack_loaded` | Library pack loaded into profile | `{ slug, tier_at_load }` |
| `pack_browsed` | Library page rendered | `{ tier, filter_tags?: string[] }` |
| `theme_changed` | Theme picker save | `{ from_theme, to_theme, tier }` |
| `language_switched` | Locale change | `{ from, to }` |
| `modelling_started` | Modelling session begins | `{}` |
| `modelling_ended` | Session ends | `{ duration_seconds, taps_count }` |
| `image_search_used` | One image-search request | `{ tier, results_count }` |
| `ai_generate_used` | One AI image generation | `{ tier }` |
| `profile_switched` | Student profile change | `{ profile_count }` |

### Revenue & lifecycle

| Event | When | Properties |
|---|---|---|
| `cancelled` | Stripe webhook | `{ plan, days_since_subscribed, reason?: string }` |
| `upgraded` | Plan change up (Pro → Max) | `{ from, to }` |
| `downgraded` | Plan change down | `{ from, to }` |
| `reactivated` | Re-subscribed after cancel | `{ plan, days_since_cancelled }` |

### Admin / operational (separate project in PostHog)

Optional second PostHog project for internal use — track what admins do without polluting product analytics:

- `admin_pack_published`, `admin_pack_unpublished`, `admin_custom_access_granted`, etc.

---

## Implementation Outline

### Install

```bash
npm install posthog-js posthog-node
```

`posthog-js` for client-side; `posthog-node` for the Stripe webhook + Clerk webhook (server-side `subscribed`, `cancelled`, `signed_up` events).

### Files to add

| File | Role |
|---|---|
| `app/providers/PostHogProvider.tsx` | Wraps the app at root layout. Initialises posthog-js with auto-capture OFF, session replay OFF by default, identifies the user via Clerk hook. |
| `lib/analytics.ts` | Typed `track(event, properties)` helper. Each event name + payload shape defined as a discriminated union — TS compile error if anyone calls `track('typo_event_name')` or misses required props. |
| `lib/analytics-server.ts` | `posthog-node` wrapper for webhook-side events. |
| `app/api/clerk-webhook/route.ts` (extend existing) | Fire `signed_up` server-side. |
| `app/api/stripe/webhook/route.ts` (extend existing) | Fire `subscribed`, `cancelled`, `upgraded`, `downgraded`, `reactivated`. |
| `app/components/app/settings/sections/AnalyticsOptOutRow.tsx` | Settings toggle: "Help improve Mo Speech with anonymous usage data". Default ON; off calls `posthog.opt_out_capturing()`. |

### Environment

```
NEXT_PUBLIC_POSTHOG_KEY=phc_...          # Project API key (public, OK to expose)
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com  # or https://eu.i.posthog.com for EU
POSTHOG_API_KEY=phx_...                  # Personal API key for posthog-node
```

### Provider pattern

```tsx
// app/providers/PostHogProvider.tsx
"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import posthog from "posthog-js";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      autocapture: false,
      capture_pageview: false,                    // we track manually
      disable_session_recording: true,            // default off
      persistence: "localStorage+cookie",
      person_profiles: "identified_only",         // no anonymous person profiles
    });
  }, []);

  useEffect(() => {
    if (!isLoaded || !user) return;
    posthog.identify(user.id, {
      // No PII beyond what Clerk knows
      // Tier/plan come from a separate user_properties call after Convex query resolves
    });
  }, [isLoaded, user]);

  return children;
}
```

Wired into `app/layout.tsx` above the existing Clerk + Convex providers.

### Typed track helper

```ts
// lib/analytics.ts
import posthog from "posthog-js";

type EventMap = {
  signed_up: { has_referral_code: boolean };
  voice_selected: { voice_id: string; language: string };
  student_profile_created: { language: string; profile_count: number };
  first_symbol_tapped: { days_since_signup: number };
  // ... all other events
  symbol_tapped: {
    category_tier: "free" | "pro" | "max";
    pack_slug?: string;
    source: "category" | "search" | "dropdown";
  };
  // ...
};

export function track<E extends keyof EventMap>(event: E, properties: EventMap[E]) {
  if (typeof window === "undefined") return;
  posthog.capture(event, properties);
}
```

Compile-time safety — any `track('foo', { ... })` call has to match the EventMap, so events don't drift.

### Server-side events (webhooks)

```ts
// lib/analytics-server.ts
import { PostHog } from "posthog-node";

const client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
});

export function trackServer(userId: string, event: string, properties: object) {
  client.capture({ distinctId: userId, event, properties });
}

// Flush before serverless function exits
export async function flushAnalytics() {
  await client.shutdown();
}
```

### Identify call wires Convex data

After `getMyAccess` resolves, set user properties:

```ts
posthog.setPersonProperties({
  tier: access.tier,
  plan: access.plan,
  has_custom_access: !!access.customAccess?.isActive,
  language: studentProfile?.language,
});
```

Person properties are *not* event properties — they're attached to the user record so funnels can be filtered ("free users who tapped X").

---

## Event Shape Discipline — Future-Proofing for Plugins

The whole point of the plugin mentality (packs, languages, themes — see [ADR-010](../../4-builds/decisions/ADR-010-pack-storage-shift.md) and the planned plugin-architecture ADR) is that adding a new language, theme, or pack type shouldn't require touching the rest of the codebase. The same principle applies to analytics: **adding a new plugin should not require updating any event type.**

The discipline that achieves this:

### Use `string`, never a union, for plugin dimensions

```ts
// ✅ Correct — accepts any future value
voice_selected: { voice_id: string; language: string }
theme_changed: { from_theme: string; to_theme: string; tier: SubscriptionTier }
pack_loaded: { slug: string; tier_at_load: SubscriptionTier }

// ❌ Wrong — would need editing every new language / theme / pack
voice_selected: { language: "eng" | "hin" }
theme_changed: { to_theme: "sky" | "rose" | "space" }
```

Plugin dimensions stay open. Stable enums (tier, status, action) can be literal unions because they describe internal app state, not plugin-extensible content.

### Person properties update on profile switch

Person properties (`language`, `tier`, `theme_slug`) are attached to the user record, not to individual events. They must refresh whenever the active student profile changes — because Emma's profile is Hindi but her brother's is English on the same account.

```ts
// In the profile-switch handler
posthog.setPersonProperties({
  language: newProfile.language,
  theme_slug: newProfile.themeSlug ?? "default",
});
```

This makes language and theme funnels meaningful: PostHog's "users in Hindi" cohort actually reflects current usage, not stale signup state.

### What changes when a plugin ships

Concrete examples — minimal analytics work for each future rollout:

**New language (Punjabi):**
- Zero changes to `lib/analytics.ts` — `language: string` already accepts `"pa"`.
- Optional: in PostHog UI, build a new funnel filtered by `language = pa` to track Punjabi onboarding specifically. UI work only, no code.

**Themes as pluggable packs (user uploads):**
- Add new event names: `theme_uploaded`, `theme_published_to_library`, `theme_loaded_from_library`. These slot into the typed EventMap as new entries; existing events are untouched.
- `theme_changed`'s `to_theme: string` already covers custom user-created themes (their slug or ID is just a string).

**A new pack type (e.g., phonics):**
- New event: `phonics_lesson_completed`. New row in EventMap. Existing pack events (`pack_loaded`, `pack_browsed`) keep working because `slug: string` accepts the new pack's slug.

The lesson: **plugin-extensible content = `string`. Internal app state = literal unions.** Sticking to this means PostHog scales with the platform without becoming a refactor target.

---

## Privacy Policy Update

Required line addition to the privacy policy:

> Mo Speech uses PostHog, a privacy-first product analytics service, to understand how people use the app and improve it. We collect anonymous interaction events (which buttons were tapped, which pages were viewed) tied to your account ID. We never send the words, symbols, or sentences your child speaks through the app. You can opt out at any time in Settings.

The opt-out toggle in Settings calls `posthog.opt_out_capturing()` — survives across sessions.

---

## Sequencing — Where This Fits

**PostHog is small** — 1-2 focused days of work. It's also **a dependency for several upcoming decisions** (themes pluggability, language pluggability, pricing experimentation). Build it before the bigger projects so they can ride on real data.

Recommended order:

1. **PostHog wiring** (this doc) — 1-2 days. Ship before bigger architectural projects.
2. **Plugin architecture ADR** — half a day. Codify the "content-as-data" pattern (already followed by packs; about to be followed by themes, languages, and future pack types). One ADR sets the standard for both.
3. **Themes as pluggable packs** — design + build. Bigger project, see follow-up.
4. **Language pluggability rework** — design + build. Bigger project, see follow-up.

PostHog data feeds 3 and 4: *which themes get loaded, which languages get switched to, where users bounce when picking a theme*. That data sharpens the design decisions for both.

---

## Out of Scope (V1 of analytics)

- **Funnels that need n-day windows** (e.g., "users who tapped a symbol within 24h of signup") — set up in PostHog UI after the events are flowing for ~2 weeks. No code change.
- **Cohort exports** to a warehouse (BigQuery, Snowflake) — PostHog supports it; defer until we have a reason.
- **In-product surveys** (PostHog Surveys feature) — useful for "why did you cancel" but not V1.
- **Heatmaps / clickmaps on student-view pages** — never. Adult-facing pages only, opt-in later.
- **Feature flag wiring** — install the feature flag client (it ships with `posthog-js`) but no flags defined V1. Add when a real A/B test exists.
- **Custom dashboards** — PostHog's built-in dashboards cover everything in V1.

---

## References

- [PostHog Next.js setup](https://posthog.com/docs/libraries/next-js)
- [PostHog GDPR / privacy guide](https://posthog.com/docs/privacy)
- [PostHog Session Replay config](https://posthog.com/docs/session-replay/privacy)
- MVP analytics gap — original plan to wire this was scoped out at launch under time pressure; tracked here as the post-launch correction.
