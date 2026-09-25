---
title: Payment provider and MoR choice
type: research
domain: mo-speech
status: active
created: 2026-09-25
summary: Stripe alone is not a merchant of record; Stripe Managed Payments (MoR, GB-eligible, covers India GST + EU VAT) is the recommended pick, Paddle the runner-up, Polar ruled out (bans products for minors), Lemon Squeezy being folded into SMP
tags:
  - q
related:
  - "[[01-final-straight]]"
  - "[[16-affiliates]]"
aliases:
  - MoR payment processing
  - payment-provider-mor
---
# Payment provider and MoR choice

> Researched 25 Sep 2026 for the M2 *Decide payment provider* decision. It blocks MOS-29 (checkout errors), MOS-49 (pricing) and affiliates (M3). **Verify every fee and eligibility claim with the provider before building.** Items marked [UNVERIFIED] are open.

> **Decision 2026-09-25: Stripe Managed Payments** → [ADR-025](../4-builds/decisions/ADR-025-stripe-managed-payments-mor.md) · migration [MOS-59](https://linear.app/mo-intelligence/issue/MOS-59). India + EU are the target markets; China is not.

**The question:** Mo Speech sells worldwide, with a deliberate focus on India and other non-romanised markets. Will Stripe act as merchant of record for subscriptions bought outside the UK? If not, which MoR fits? It also needs affiliate payouts that can be automated and tracked from inside the app.


I checked these facts against provider docs and pricing pages on 25 Sep 2026. Third-party blogs are marked as such, and anything I couldn't confirm is marked **[UNVERIFIED]**.

## Does Stripe act as merchant of record (MoR)?

**Standard Stripe does not.** With Stripe Checkout, Billing and Tax, your company is the merchant of record. Stripe Tax calculates the tax, but you have to register, collect, file and pay it yourself. That means India GST from the first rupee, EU VAT through OSS, and US state sales tax once you pass their thresholds.

**Stripe Managed Payments (SMP) is Stripe's MoR product.** It's a flag you turn on per Checkout Session or Payment Link. Customers see the sale as *"Sold through Onelink"*, and their card statement reads `LINK.COM* <descriptor>`.

- **Status:** Stripe said at Sessions (29 Apr 2026) that "all digital businesses can now use Managed Payments". Lemon Squeezy's January 2026 post still described it as invite-only.
- **UK:** GB is on the list of eligible business locations. Access still depends on an eligibility review by Stripe that looks at "business type and geography".
- **Subscriptions:** supported through Billing, but only when the subscription is created via Checkout or Payment Links.
- **Tax:** Stripe handles tax filing and payment for more than 80 countries. India, all 27 EU states, the UK, the US, Thailand, Saudi Arabia, the UAE-region Gulf states, Turkey and others are on the list for cross-border sales. **Bangladesh, Egypt-adjacent Arabic markets outside the list, and other unlisted countries stay your responsibility**, although Stripe Tax calculation is free on SMP transactions.
- **Pricing:** 3.5% on the full amount including tax, **on top of** normal Stripe processing, plus the Billing fee on subscriptions, plus international and currency-conversion surcharges. Stripe's own help page estimates all-in costs at about 7–9% when comparing with other MoRs.

> Note: Bangladesh (BD) and the UAE (AE) are **not** in SMP's cross-border tax list. Egypt (EG) and Saudi Arabia (SA) are.

## Comparison

These are illustrative effective rates on a **£5 / ~$6.70 monthly subscription paid by a customer outside the UK**. They are rough estimates, not quotes.

| | Stripe + Stripe Tax | Stripe Managed Payments | Paddle | Lemon Squeezy | Polar |
|---|---|---|---|---|---|
| MoR | **No** | **Yes** (Stripe/Onelink) | **Yes** | **Yes** | **Yes** |
| Headline fee | UK card 1.5%+20p; EEA 2.5%+20p; international 3.15%+20p | 3.5% + all Stripe fees | 5% + 50¢ ("all-in") | 5% + 50¢ | 5% + 50¢ (free plan); 3.8%+40¢ on Pro ($20/mo) |
| Extra surcharges | +2% currency conversion; Billing 0.7%; Tax Basic 0.5% or 40p/txn | Same Stripe fees + Billing 0.7%; local methods +1.5% international and 1–2% currency conversion (conversion may be waived with Adaptive Pricing) | None published; under $10 is "contact sales" | +1.5% non-US; +0.5% renewals; +1.5% PayPal; affiliate +3% | +1.5% international cards; $15 per dispute |
| Payouts | Pricing page shows £0.50 per payout **[check, may be Connect-specific]** | Normal Stripe payouts | Not published **[UNVERIFIED]** | 1% to non-US bank; PayPal 3% (capped $30) | Stripe pass-through: $2/mo + 0.25%+25¢ + FX |
| Rough cost on £5 (international) | ~10% (**plus your own tax compliance**) | ~13–15% | ~12–13% on list price | ~14–15% | ~14% |
| India: pay in INR / UPI | UPI one-off and AutoPay in INR, available to GB accounts. Indian cards use RBI e-mandates | UPI (one-off + recurring, INR) and cards | UPI AutoPay (INR), **early access** since 17 Jun 2026 | **[UNVERIFIED]** | UPI in INR, one-off + recurring (per third-party review) **[verify]** |
| India GST handled | No, you register as a foreign OIDAR supplier | **Yes** (IN is listed) | Yes (core MoR offer) **[confirm IN]** | Yes (MoR) | Yes (MoR) |
| Low-price rules | £0.30 minimum charge (standard Stripe) | Same | **$0.70 minimum per transaction**; custom pricing under $10 | Custom pricing under $10 | 50¢ fixed fee hurts |
| Trials / coupons / dunning | Full Billing | Billing via Checkout. No one-off invoices, no invoice items, no subscriptions created outside Checkout | Full (trials, discounts, retain/dunning) | Yes | Yes |
| B2B invoices for schools | Yes | **No** (one-off invoices unsupported) | Invoicing on custom pricing | Limited | **[UNVERIFIED]** |
| Onboarding a solo founder | Sole trader or Ltd both fine | Eligibility review, discretionary | Sole traders explicitly OK (ID check only, no business verification) | Accepts individuals; support described as slow | Probably, but see policy row |
| Children / health policy | No specific ban found | "Fully automated digital product" required; no child-specific exclusion found | Bans "medical advice"; no child ban | Bans "services" and pharma | **Prohibits "services used by, intended for, or advertised towards minors" and "Medical and Health advice"**. Rules it out. |

## India

- **GST:** A foreign company selling online services to Indian consumers must register for GST and charge 18% IGST, with **no turnover threshold** (CGST Act s.24(xi)). Enforcement has picked up through 2025–26 (third-party tax advisors). This is the main reason to use an MoR. With plain Stripe you would have to register in India yourself.
- **Recurring payments:** Under RBI e-mandate rules, the first payment needs extra authentication (3DS or the UPI PIN). Customers get a pre-debit notice at least 24h before each charge (Stripe waits 26h). Recurring charges above ₹15,000 need authentication every time. At under $10/mo you're far below that cap.
  - Stripe gotcha: on subscriptions not priced in INR, the mandate is only registered if an Indian payment method is attached **when the subscription is created**. Checkout takes care of this.
- **UPI:** Stripe accounts in GB can accept UPI, including AutoPay. Recurring UPI is capped at ₹15,000. SMP lists UPI with recurring support, and it requires the price to be shown in INR. Paddle's UPI AutoPay is still early access.
- **Pricing in INR:** With SMP, Adaptive Pricing is always on. Setting your own INR price points (for purchasing-power pricing) would need explicit multi-currency prices. **[Verify that explicit INR prices work together with forced Adaptive Pricing on SMP.]**
- **Other markets:** SMP covers TH, SA, EG, IN, EU and GB. **BD and AE are not covered**, so check where your Bengali and Arabic buyers actually are.

## China, Japan, Korea (added 2026-09-25)

| | Stripe Managed Payments | Paddle |
|---|---|---|
| **China** | ❌ Restricted customer country: Chinese customers can't buy | ✅ Sells there; Alipay + WeChat Pay (Alipay subscriptions "coming soon"). Buyer-withheld China VAT handling undocumented |
| **Japan** | ✅ JP on the tax list (consumption tax); cards | ✅ Supported; confirm JP tax handling |
| **Korea** | ✅ KR on the tax list (VAT); local wallets unconfirmed | ✅ Strongest: Korean local cards, KakaoPay, Naver Pay, Samsung Pay, Payco; KakaoPay/Naver Pay recurring |

China also has non-payment blockers: Google services are blocked, Clerk/Vercel reachability is unreliable, and hosting in China needs an ICP licence. Treat it as post-launch whatever the provider.

Sources: [SMP eligibility](https://docs.stripe.com/payments/managed-payments/eligibility) · [SMP tax compliance](https://docs.stripe.com/payments/managed-payments/tax-compliance) · [Paddle payment methods](https://developer.paddle.com/concepts/payment-methods/overview) · [Paddle KakaoPay/Naver Pay subscriptions](https://developer.paddle.com/changelog/2025/recurring-kakaopay-naverpay-subscriptions)

## Affiliates

| Provider | Native affiliates | Auto payouts | Third-party tools |
|---|---|---|---|
| Stripe (standard) | None | Via Connect or **Global Payouts** (public preview, US/UK accounts, 160+ countries) | Rewardful, Tolt, FirstPromoter, Refgrow, LinkJolt all support Stripe |
| **SMP** | None | **Connect is not supported on an SMP account** (no `transfer_data` or application fees). Global Payouts from the same account is **[UNVERIFIED]** | SMP creates normal Subscription and Invoice objects in your own account, so Stripe-based tools *should* pick them up. **[UNVERIFIED — ask Rewardful/Tolt]** |
| Paddle | None | Only through third-party tools | Rewardful, Tolt, FirstPromoter, Partnero and Refgrow list Paddle integrations |
| Lemon Squeezy | **Yes**: built-in affiliate hub, fees of +3% to merchant and +2% to affiliate | Yes, built in | Refgrow, LinkJolt. **Built-in hub isn't part of SMP**, so its future is unclear after the migration |
| Polar | None by design | Only through third-party tools | Rekomi, Affonso, Refgrow |

**Can you pay affiliates through Stripe Connect when an MoR sells the product?** Not on the same flow. MoR money arrives as a lump payout to you, so there's no per-charge split. You could hold a separate Stripe balance and send payments via Global Payouts or Connect as ordinary third-party payments. That's workable but has to be done manually or scripted, and paying affiliates in India from a UK account is **[UNVERIFIED]**.

**Practical route:** use Tolt or Rewardful with their managed auto-payouts (PayPal, Wise, Payoneer).
- Tolt: from $49/mo, auto-payouts about 2% or a card fee.
- Rewardful: "Managed Payouts" for automatic payments, plus PayPal/Wise bulk payouts.
- Rewardful's own site lists Paddle support; one third-party roundup calls it Stripe-only, so confirm.

## Migration effort from the current Stripe Checkout + webhooks setup

| Target | Effort | What changes |
|---|---|---|
| Stripe + Tax | Very low | Set `automatic_tax`. But you take on India, EU and UK tax registrations and filing yourself |
| **SMP** | **Low (1–2 days)** | Needs API version `2025-03-31.basil` or later. Set `managed_payments[enabled]=true` and an eligible `tax_code` on each product (probably `txcd_10103000` SaaS personal use). Remove `automatic_tax`, `tax_id_collection`, `payment_method_types`/`_configuration`, `customer_update[name/address]`, `adaptive_pricing`, `invoice_creation` and `subscription_data.invoice_settings`. **Webhooks stay the same.** Existing subscriptions can't be converted, but you're pre-revenue so that doesn't matter. No custom checkout domain |
| Paddle | Medium (about 1 week) | New SDK and Paddle.js overlay or inline checkout, new webhook events and signature check, new customer/subscription IDs in Convex, new customer portal |
| Lemon Squeezy | Medium, and a dead end | Its stores are being moved to SMP. Don't start a new build on it |
| Polar | Medium, and blocked by policy | Not viable because of its rules on products for minors |

## Recommendation

**First choice: Stripe Managed Payments**, opened on the new UK Ltd rather than as a sole trader.
- It's the smallest change from the current code: one flag plus parameter clean-up, and the same webhooks and Convex schema.
- GB businesses are eligible, and it handles India GST, EU VAT and UK VAT.
- It supports UPI AutoPay in INR and Indian card mandates.
- It covers trials, coupons and Stripe's failed-payment retries through Billing.
- Nothing in its policies bans products for children.
- The downsides:
  - It's the most expensive option on small tickets because the fees stack: about 13–15% at £5.
  - No Connect.
  - Customer and school invoicing is limited.
  - The "Onelink" branding appears on checkout and receipts.
- Before building, email Stripe to confirm the account is eligible.

**Runner-up: Paddle.** It's a mature MoR that explicitly accepts sole traders, supports UPI AutoPay (early access), and works with most affiliate tools (Tolt, FirstPromoter, Rewardful). It has invoicing for schools on custom pricing. Its 50¢ fixed fee and $0.70 minimum hurt at under-$10 prices, so ask for sub-$10 custom pricing first. The migration is about a week.

**Avoid:**
- **Polar**, because its acceptable-use policy bans products for minors.
- **Lemon Squeezy**, because it's being folded into SMP.
- **Plain Stripe + Tax** for now, because Indian GST and EU OSS filing is too much admin for a solo founder. Revisit at scale when the ~3.5% MoR premium outweighs the cost of doing compliance yourself.

**For affiliates:** use Tolt (or Rewardful) with auto-payouts on top of whichever provider you pick. Confirm first that it tracks SMP subscriptions.

## Key risks

1. **SMP eligibility is Stripe's call.** Stripe can drop you for a high dispute rate or by deciding the product doesn't qualify, which would leave you liable for the tax. Keep the Paddle integration as a documented fallback.
2. **Loss of control in SMP.** If you don't reply within 48h, Stripe can refund without asking you, within 60 days. A customer data-deletion request **cancels their subscriptions**.
3. **Low-price economics.** Fixed fees (20p, 50¢) eat 7–10% of a £5 plan. Push annual plans, especially in India.
4. **Health positioning.** Present Mo Speech as communication or education software, not therapy or medical advice. Paddle and Polar both ban "medical advice".
5. **Schools and purchase orders** don't fit SMP's Checkout-only model. You may need a Paddle invoice or a manual invoice path.
6. **Legal entity.** Open the account on the Ltd. Moving a Stripe account from sole trader to company usually needs support's help or a new account **[UNVERIFIED]**.
7. **Children's data** (UK Children's Code, COPPA, India's DPDP Act) applies whichever provider you use. It's outside this research but worth tracking.

## Questions to put to each provider

- **Stripe:**
  - Is a UK Ltd selling AAC software for children eligible for SMP?
  - Can you set explicit INR prices alongside Adaptive Pricing?
  - Does UPI AutoPay work with a 3-day trial (mandate set up at ₹0)?
  - Can the SMP account use Global Payouts to pay affiliates, including in India?
  - What exactly is the £0.50 payout fee?
- **Rewardful and Tolt:** do you track SMP subscriptions, given Onelink is the merchant? Can you auto-pay affiliates in India?
- **Paddle:** what's your pricing under $10? Is India on your tax-remittance list? When does UPI AutoPay leave early access? What are the payout fees? Can schools buy via invoice?
- **Accountant:** check the UK VAT treatment of MoR payouts, and whether any direct Stripe sales (outside SMP) create an India OIDAR obligation.

## Apple and Google (if native apps come later)

- Digital subscriptions unlocked inside iOS or Android apps generally have to use in-app purchase, at a 15–30% commission. The 15% small-business rate is from memory **[UNVERIFIED for 2026]**.
- **US:** linking out to web checkout is allowed after the Epic ruling.
- **EU:** alternative payment options exist under the DMA, with their own fees.
- **UK:** the CMA consulted on steering rules until 28 Jul 2026, with a decision expected later this year. Apple objected in July 2026.
- **Strategy:** keep web billing as the main route, treat app-store purchases as a second revenue channel, and bring both into one entitlements table in Convex.
- SMP has a "mobile app payments" guide worth checking.

## Sources (all accessed 2026-09-25)

- Stripe Managed Payments overview — https://docs.stripe.com/payments/managed-payments
- SMP eligibility (GB listed, product codes, restricted countries) — https://docs.stripe.com/payments/managed-payments/eligibility
- SMP tax compliance (IN, EU, GB listed) — https://docs.stripe.com/payments/managed-payments/tax-compliance
- SMP how it works (Onelink, UPI, refunds, data deletion) — https://docs.stripe.com/payments/managed-payments/how-it-works
- SMP migrating an existing Checkout integration — https://docs.stripe.com/payments/managed-payments/update-checkout
- SMP pricing — https://support.stripe.com/questions/managed-payments-pricing
- Stripe Sessions 2026 announcements (29 Apr 2026) — https://stripe.com/blog/everything-we-announced-at-sessions-2026
- Stripe UK pricing — https://stripe.com/gb/pricing · Stripe Tax pricing — https://stripe.com/gb/tax/pricing
- Stripe UPI — https://docs.stripe.com/payments/upi · India recurring payments — https://docs.stripe.com/india-recurring-payments
- Stripe Global Payouts — https://stripe.com/payouts
- Lemon Squeezy 2026 update (28 Jan 2026) — https://www.lemonsqueezy.com/blog/2026-update · Fees — https://docs.lemonsqueezy.com/help/getting-started/fees · Prohibited products — https://docs.lemonsqueezy.com/help/getting-started/prohibited-products · Affiliates — https://www.lemonsqueezy.com/marketing/affiliates
- Paddle pricing — https://www.paddle.com/pricing · UPI AutoPay (17 Jun 2026) — https://developer.paddle.com/changelog/2026/upi-autopay/ · $0.70 minimum — https://developer.paddle.com/errors/transactions/transaction_balance_less_than_charge_limit · Acceptable use policy — https://www.paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle · Identity verification — https://www.paddle.com/help/start/account-verification/what-is-identity-verification
- Polar fees — https://polar.sh/docs/merchant-of-record/fees · Acceptable use — https://polar.sh/docs/merchant-of-record/acceptable-use
- Rewardful Paddle integration — https://www.rewardful.com/paddle · Rewardful payouts — https://www.rewardful.com/paypal-and-wise-mass-payouts · Tolt pricing — https://tolt.com/pricing
- India OIDAR GST (secondary source) — https://treelife.in/legal/oidar-registration-in-india/ ; https://www.casahuja.com/2026/09/foreign-oidar-supplier-in-india-what.html
- UK CMA steering consultation — https://www.gov.uk/government/news/cma-consults-on-new-requirements-for-apple-and-googles-mobile-platforms ; https://www.macrumors.com/2026/07/29/app-store-uk-rules-highly-intrusive/
- Secondary sources (claims conflict, used as context only) — https://dodopayments.com/blogs/stripe-managed-payments-fees-explained ; https://fungies.io/lemon-squeezy-stripe-acquisition-saas-founders-2026/. One of these says SMP costs "5% + $0.50", which contradicts Stripe's own 3.5% + processing figure. I went with Stripe.