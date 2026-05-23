"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

/**
 * Initialise PostHog once on app mount with privacy-first defaults.
 *
 * Privacy hard rules baked in here (see docs/1-inbox/ideas/21-product-analytics-posthog.md):
 *   - `autocapture: false` — no automatic click/input capture. Every event is
 *     explicit via the typed `track()` helper in `lib/analytics.ts`.
 *   - `capture_pageview: false` — pageviews are tracked manually when needed.
 *     Avoids leaking pathnames like /admin/users/<id> as pageview events.
 *   - `disable_session_recording: true` — no session replay (would record what
 *     children tap in the talker).
 *   - `person_profiles: "identified_only"` — no anonymous person records.
 *     Anonymous pre-signup events get aliased to the Clerk userId when
 *     `posthog.identify()` is called from AppStateProvider, preserving the
 *     viewed_pricing → signed_up funnel.
 *   - `ip: false` — IP anonymisation; pair with the project-level "Anonymize
 *     IPs" toggle in PostHog Settings for defence in depth.
 *
 * Identify, opt-out respect, and person-property syncing happen in
 * `AppStateProvider` — this component is purely the SDK init.
 *
 * No-ops gracefully when `NEXT_PUBLIC_POSTHOG_KEY` is absent (dev / CI /
 * preview without an analytics project). React Strict Mode in dev re-runs
 * the effect; the `posthog.__loaded` guard prevents double init.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    // posthog-js sets `__loaded` after init completes; skip if already done
    // (Strict Mode double-render in dev, fast refresh, etc.)
    if ((posthog as unknown as { __loaded?: boolean }).__loaded) return;

    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      // `us.i.posthog.com` is the INGEST endpoint (where events POST to).
      // The dashboard lives at `us.posthog.com` — a different host. Setting
      // api_host to the dashboard URL silently drops events. EU equivalent
      // is `https://eu.i.posthog.com`. The env var should match.
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
      person_profiles: "identified_only",
      persistence: "localStorage+cookie",
      // Note: posthog-js v1 doesn't expose an `ip: false` init option — IP
      // anonymisation is project-level only. Verify the "Anonymize IPs" toggle
      // is ON in PostHog Project Settings → General. See plan §0.3.
    });

    // Tag every event with the environment so dev / preview / production data
    // can be filtered apart in a single PostHog project. Per plan §0.5.
    posthog.register({
      environment: process.env.NODE_ENV ?? "production",
    });
  }, []);

  return <>{children}</>;
}
