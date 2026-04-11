import Stripe from "stripe";

/**
 * Stripe client singleton.
 * Pin the API version here — check stripe.com/docs/api/versioning before updating.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
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
