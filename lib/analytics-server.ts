/**
 * Server-side product analytics — `posthog-node` wrapper.
 *
 * Use from API routes and Convex actions to fire events that the client can't
 * reliably emit (Stripe webhooks, Max-only API routes, scheduled jobs).
 *
 * Key serverless detail: `flushAnalytics()` MUST be awaited at the end of
 * every route handler before responding. PostHog batches events for
 * efficiency, but serverless functions are cold-stopped right after the
 * response — unflushed events get dropped. The singleton uses `flushAt: 1` to
 * flush every event immediately, which combined with the explicit shutdown
 * gives reliable delivery.
 *
 * No-ops gracefully when `NEXT_PUBLIC_POSTHOG_KEY` is absent.
 */

import { PostHog } from "posthog-node";

let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return null;
  if (client) return client;
  client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    // Ingest endpoint — `us.i.posthog.com` not `us.posthog.com`. See
    // PostHogProvider.tsx for the explanation.
    host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    // Serverless: flush every event immediately so cold-stop doesn't drop
    // pending batches. `flushAt: 1` ships each capture as soon as it's queued.
    flushAt: 1,
  });
  return client;
}

/**
 * Capture a server-side event. `distinctId` must be the Clerk userId — the
 * same identifier the client-side `posthog.identify()` call sets, so
 * server-fired events land on the same user record as client events.
 *
 * Fire-and-forget. Always call `flushAnalytics()` before the route returns.
 */
export function trackServer(
  distinctId: string,
  event: string,
  properties: Record<string, unknown> = {}
): void {
  const c = getClient();
  if (!c) return;
  c.capture({
    distinctId,
    event,
    properties: {
      ...properties,
      // Mirror the client-side `environment` super-property so server events
      // sit alongside client events in PostHog dashboards filtered by env.
      environment: process.env.NODE_ENV ?? "production",
    },
  });
}

/**
 * Flush any queued events and shut down the client. Must be awaited at the
 * end of every webhook handler / API route before returning the response.
 *
 * Safe to call multiple times (no-op after first call); safe to call when no
 * client exists.
 */
export async function flushAnalytics(): Promise<void> {
  const c = getClient();
  if (!c) return;
  try {
    await c.shutdown();
  } catch {
    // Swallow flush errors — never block the webhook response on analytics.
  }
  client = null;
}
