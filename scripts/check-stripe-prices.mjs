/**
 * Health check for the four Stripe price IDs the app depends on (MOS-29).
 *
 * Loads STRIPE_PRO_MONTHLY_PRICE_ID, STRIPE_PRO_YEARLY_PRICE_ID,
 * STRIPE_MAX_MONTHLY_PRICE_ID, STRIPE_MAX_YEARLY_PRICE_ID and retrieves each
 * from Stripe with the current STRIPE_SECRET_KEY. For each price, prints the
 * ID, amount, currency, billing interval, active flag, and whether the
 * interval matches what the env var name promises (monthly vs yearly).
 *
 * Exits 1 (and names the offending env var) if a price is missing from env,
 * fails to retrieve, is inactive, or has the wrong interval. Exits 0 only if
 * every price checks out.
 *
 * Run after any Stripe key or account change:
 *   node --env-file=.env.local scripts/check-stripe-prices.mjs
 *
 * Never prints secret keys — only price IDs, amounts and intervals.
 */
import Stripe from "stripe";

const PRICE_VARS = [
  { envVar: "STRIPE_PRO_MONTHLY_PRICE_ID", interval: "month" },
  { envVar: "STRIPE_PRO_YEARLY_PRICE_ID", interval: "year" },
  { envVar: "STRIPE_MAX_MONTHLY_PRICE_ID", interval: "month" },
  { envVar: "STRIPE_MAX_YEARLY_PRICE_ID", interval: "year" },
];

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error("STRIPE_SECRET_KEY is not set.");
  process.exit(1);
}

const stripe = new Stripe(secretKey, {
  apiVersion: "2026-05-27.dahlia",
  typescript: true,
});

let ok = true;

for (const { envVar, interval } of PRICE_VARS) {
  const priceId = process.env[envVar];

  if (!priceId) {
    console.error(`✗ ${envVar} is not set`);
    ok = false;
    continue;
  }

  try {
    const price = await stripe.prices.retrieve(priceId);
    const amount = typeof price.unit_amount === "number" ? price.unit_amount / 100 : null;
    const actualInterval = price.recurring?.interval ?? null;
    const intervalMatches = actualInterval === interval;

    console.log(
      `${intervalMatches && price.active ? "✓" : "✗"} ${envVar}=${priceId} ` +
        `amount=${amount ?? "n/a"} currency=${price.currency} ` +
        `interval=${actualInterval ?? "n/a"} active=${price.active} ` +
        `expectedInterval=${interval} intervalMatches=${intervalMatches}`
    );

    if (!price.active) {
      console.error(`✗ ${envVar} (${priceId}) is not active`);
      ok = false;
    }
    if (!intervalMatches) {
      console.error(
        `✗ ${envVar} (${priceId}) has interval "${actualInterval}", expected "${interval}"`
      );
      ok = false;
    }
  } catch (err) {
    console.error(`✗ ${envVar} (${priceId}) failed to retrieve: ${err.message}`);
    ok = false;
  }
}

process.exit(ok ? 0 : 1);
