import Stripe from "stripe";

/**
 * Stripe client singleton.
 * Pin the API version here — check stripe.com/docs/api/versioning before updating.
 *
 * KEEP THIS IN STEP WITH THE INSTALLED SDK. `stripe@22.x` is generated for
 * `2026-05-27.dahlia` (see `node_modules/stripe/cjs/apiVersion.js`) and its
 * types accept that literal only, so a stale pin here is not a warning — it
 * fails `next build` at the typecheck step and no production build can be
 * produced. Both are the same major (`dahlia`), so dated releases within it are
 * additive; a MAJOR change is the one to read the migration guide for.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-05-27.dahlia",
  typescript: true,
});

export const PRICE_IDS = {
  pro: {
    monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID!,
    yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID!,
  },
  max: {
    monthly: process.env.STRIPE_MAX_MONTHLY_PRICE_ID!,
    yearly: process.env.STRIPE_MAX_YEARLY_PRICE_ID!,
  },
} as const;

export type PriceTier = keyof typeof PRICE_IDS;
export type PricePlan = "monthly" | "yearly";

export function getPriceId(tier: PriceTier, plan: PricePlan): string {
  return PRICE_IDS[tier][plan];
}
