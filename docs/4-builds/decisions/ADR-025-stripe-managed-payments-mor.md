# ADR-025 — Stripe Managed Payments is the merchant of record

**Status:** accepted
**Date:** 2026-09-25
**Related:** MOS-59 (migration) · MOS-29 (checkout errors, same routes) · MOS-49 (pricing) · MOS-62 (affiliates) · research: [`2-research/payment-provider-mor.md`](../../2-research/payment-provider-mor.md)

## Context

Mo Speech sells subscriptions worldwide from a UK Ltd, and the launch markets are **India and the EU**. On plain Stripe (Checkout + Billing + Stripe Tax) the Ltd is the merchant of record: Stripe Tax *calculates* tax, but the Ltd has to register, file and pay it everywhere. That means India GST (18% IGST from the first rupee, no threshold for foreign online-service suppliers), EU VAT via OSS, and more. For a solo founder that's unworkable.

A merchant of record (MoR) takes on that liability. The candidates researched on 2026-09-25 were Stripe Managed Payments (SMP), Paddle, Lemon Squeezy and Polar.

## Decision

**Use Stripe Managed Payments** as the merchant of record, on an account opened in the Ltd's name.

- **Tax coverage for our markets:** SMP registers, files and remits for India, all 27 EU states, the UK, Japan, Korea, Thailand and 80+ countries in total.
- **India payments:** UPI (one-off and AutoPay) in INR; Indian card e-mandates are handled by Checkout.
- **Smallest change:** one flag on the existing Checkout Sessions, a product tax code, and removal of incompatible params. **Webhooks and the Convex entitlement schema stay the same.** Pre-revenue, so there are no subscriptions to migrate.
- **Policy fit:** no exclusion for products used by children was found. Polar was ruled out because it bans products aimed at minors.

## Consequences

- **No Stripe Connect** on an SMP account. The affiliate payouts in `16-affiliates.md` (Connect Express) can't be built as written; MOS-62 moves to a third-party affiliate tool (Tolt / Rewardful) or Global Payouts.
- **Higher fees on small tickets:** about 13–15% all-in on a £5 international subscription. This pushes pricing (MOS-49) towards £9.99+ tiers and annual plans.
- **China is a restricted customer country** on SMP. Accepted: China isn't a target market, and the stack (Clerk, Google, Vercel) has separate problems there.
- **Schools:** SMP has no one-off invoices. Purchase-order and invoice sales need a manual path later.
- **Less control:** "Sold through Onelink" appears on receipts; Stripe may refund within 60 days if a dispute isn't answered within 48h; a customer's data-deletion request cancels their subscriptions.
- **Eligibility is Stripe's decision** and can be withdrawn (e.g. for a high dispute rate).

## Fallback

**Paddle** is the documented fallback if Stripe refuses or withdraws SMP eligibility. It accepts sole traders, covers India, and has the strongest Korean payment methods. Its costs: about a week of migration (new SDK, webhooks and IDs), and weaker economics under $10 (50¢ fixed fee, $0.70 minimum).
