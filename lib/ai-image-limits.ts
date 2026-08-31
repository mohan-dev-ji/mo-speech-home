/**
 * AI image generation allowances (ADR-023).
 *
 * TWO METERS, and they are not the same kind of thing:
 *
 *  - MONTHLY is the budget. Real usage is bursty — a family sets up one or
 *    two categories over a week and then does not touch the feature again
 *    for a month — so the month is the honest unit to sell and to spend.
 *  - DAILY is a runaway guard, not an allowance. A stuck loop or a shared
 *    login is what it exists to stop.
 *
 * Because the month bounds total spend, the daily number is free to be
 * generous; capping the day tightly would only punish the setup week without
 * changing worst-case cost.
 *
 * 100/month is a STARTING NUMBER to be corrected with evidence, not a
 * commitment. It was sized on ~15 custom symbols x ~3 attempts for a heavy
 * setup month. `ai_generate_adopted.attempts` and `ai_generate_quota_blocked`
 * in PostHog are what replace the guess — see FEAT-008 §6.
 */
export const AI_IMAGE_DAILY_LIMIT_DEFAULT = 20;
export const AI_IMAGE_MONTHLY_LIMIT_DEFAULT = 100;

/**
 * Parsed defensively: a malformed value must not become NaN, because every
 * quota check is `current >= limit` and `x >= NaN` is always false — a typo
 * would silently grant unlimited generations rather than failing closed.
 */
function parseLimit(raw: string | undefined, fallback: number, name: string): number {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < 1) {
    console.warn(`[ai-generate] ignoring invalid ${name}=${raw}; using ${fallback}`);
    return fallback;
  }
  return n;
}

/**
 * SERVER ONLY — reads `process.env`. The overrides exist for admin authoring
 * sessions: a content module is 12 symbols, which cannot be authored inside a
 * family-sized allowance.
 *
 * KNOWN WART: the tab's footer renders the DEFAULTS, because these env vars
 * are not `NEXT_PUBLIC_` and must not be. During an admin session with an
 * override set, the footer therefore understates what is actually available.
 * Cosmetic only — the server is authoritative and nothing in the UI is
 * disabled by the footer. Pre-existing behaviour, carried forward knowingly
 * rather than fixed with a second env var that could disagree with this one.
 */
export function resolveAiImageLimits(): { daily: number; monthly: number } {
  return {
    daily: parseLimit(
      process.env.AI_IMAGE_DAILY_LIMIT,
      AI_IMAGE_DAILY_LIMIT_DEFAULT,
      "AI_IMAGE_DAILY_LIMIT"
    ),
    monthly: parseLimit(
      process.env.AI_IMAGE_MONTHLY_LIMIT,
      AI_IMAGE_MONTHLY_LIMIT_DEFAULT,
      "AI_IMAGE_MONTHLY_LIMIT"
    ),
  };
}
