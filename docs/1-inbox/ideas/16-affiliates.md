# Affiliates

## Overview

The affiliate programme allows Mo Speech to grow internationally through trusted partners — SLTs, AAC specialists, teachers, and engaged parents — who promote the app and earn a commission on users they recruit.

Affiliates are managed by Mo Speech admins via the admin User Settings page. Payouts are fully automated via Stripe Connect — money flows from the Mo Speech Stripe balance directly to the affiliate's bank account without manual intervention.

This is separate from the existing Custom Access feature, which grants free platform access for goodwill reasons (SLPs, beta testers, hardship grants). An affiliate may also have custom access, but the two are independent.

---

## Admin UI — User Settings Page

The affiliate section lives on the existing admin User Settings page as a collapsible section beneath Custom Access. It has four states.

### State 1 — Not an affiliate

A single "Grant Affiliate Status" button. Tapping it expands the creation form inline.

### State 2 — Creation form

```
Affiliate Code        [KATE-UK        ]   ← auto-generated from name, editable
Commission Rate       [20            ]%   ← platform default, overridable per affiliate
Commission Model      [Recurring monthly ▼]
                        · First month only
                        · Recurring monthly
                        · One-time flat fee per conversion
Flat Fee Amount       [£ ___]             ← only shown if one-time flat fee selected
Notes (internal)      [                ]

[ Cancel ]  [ Save and Send Stripe Invite ]
```

On **Save and Send Stripe Invite**:
1. Affiliate record created in Convex with `status: "invited"`
2. Stripe Connected Account created via API (`type: "express"`)
3. Stripe account_link generated (one-time onboarding URL)
4. Invite email sent to the user containing the onboarding link

### State 3 — Invited, awaiting Stripe onboarding

```
┌─────────────────────────────────────────────┐
│ AFFILIATE                          [Invited] │
│                                             │
│ Code         KATE-UK                        │
│ Commission   20% recurring monthly          │
│ Stripe       ⏳ Awaiting onboarding         │
│                                             │
│ [ Resend Stripe Invite ]  [ Revoke ]        │
└─────────────────────────────────────────────┘
```

Stripe onboarding links expire after a few minutes. If the affiliate does not complete it in time they land on an expiry page and request a fresh link. Resend generates a new `account_link` and emails it again.

### State 4 — Active

```
┌─────────────────────────────────────────────┐
│ AFFILIATE                           [Active] │
│                                             │
│ Code         KATE-UK                        │
│ Commission   20% recurring monthly          │
│ Stripe       ✅ Connected                   │
│ Referral URL mospeech.app/join?ref=KATE-UK  │
│                                             │
│ Total Referrals      47                     │
│ Active Subscribers   31                     │
│ Lifetime Earnings    £618.00                │
│ Pending Payout       £42.00                 │
│                                             │
│ [ Edit ]  [ Pause ]  [ Revoke ]             │
└─────────────────────────────────────────────┘
```

**Edit** — change commission rate or model (takes effect on next billing cycle)
**Pause** — stops new commission events being created; existing payouts complete
**Revoke** — removes affiliate status entirely; Stripe Connect account remains but receives no further transfers

---

## Stripe Connect Onboarding Flow

Mo Speech uses **Stripe Connect Express** — the quickest onboarding path for affiliates. They do not need an existing Stripe account.

### Step 1 — Admin saves the affiliate record

A Convex HTTP action calls the Stripe API:

```
POST /v1/accounts
{ type: "express", country: "GB", capabilities: { transfers: { requested: true } } }
```

Stripe returns a Connected Account ID (e.g. `acct_1234XYZ`). Stored on the affiliate record with `status: "invited"`.

### Step 2 — Generate the onboarding link

```
POST /v1/account_links
{
  account: "acct_1234XYZ",
  refresh_url: "https://mospeech.app/affiliate/onboarding-expired",
  return_url: "https://mospeech.app/affiliate/welcome",
  type: "account_onboarding"
}
```

Stripe returns a one-time URL. This URL is sent to the affiliate in an invite email.

### Step 3 — Affiliate completes Stripe onboarding

The affiliate clicks the link and lands on a Stripe-hosted page. Mo Speech does not design this — Stripe renders it. The affiliate enters:
- Legal name and date of birth
- Bank account details
- Government ID if required by their country

Takes approximately 3–5 minutes. No existing Stripe account required.

### Step 4 — Stripe webhooks back

On completion Stripe fires `account.updated` with `capabilities.transfers = "active"`. The Mo Speech webhook handler updates the affiliate record `status` from `"invited"` to `"active"`. The admin dashboard reflects this instantly via Convex.

### Step 5 — Affiliate lands on the welcome page

After completing onboarding they are redirected to `mospeech.app/affiliate/welcome`:

```
┌────────────────────────────────────────┐
│  You're all set! 🎉                    │
│                                        │
│  Your affiliate account is active.     │
│  Share your link to start earning.     │
│                                        │
│  mospeech.app/join?ref=KATE-UK         │
│  [ Copy link ]                         │
│                                        │
│  Commission: 20% recurring monthly     │
│  Questions? hello@mospeech.app         │
└────────────────────────────────────────┘
```

---

## Referral Tracking

1. Affiliate shares their link: `mospeech.app/join?ref=KATE-UK`
2. New user clicks the link → referral code stored in a cookie (30-day expiry)
3. User signs up → `referredBy: "KATE-UK"` stored on their user record
4. User subscribes → Stripe `checkout.session.completed` webhook fires
5. Convex checks `referredBy` → looks up affiliate → creates a `commissionEvent` record
6. Commission transfer sent to affiliate's Stripe Connected Account automatically

The 30-day cookie means the affiliate still gets credit if the user signs up a few weeks after first clicking the link.

---

## Automatic Payouts

When a `commissionEvent` is created, a Convex HTTP action calls:

```
POST /v1/transfers
{
  amount: 199,                    ← pence — 20% of £9.99 = £1.998, rounded to £2.00
  currency: "gbp",
  destination: "acct_1234XYZ",   ← affiliate's Stripe Connected Account
  transfer_group: "commission-2026-04"
}
```

Stripe moves money from the Mo Speech Stripe balance to the affiliate's connected account. Stripe then pays out to their bank on whatever schedule they chose during onboarding (daily, weekly, or monthly). Mo Speech never handles the money directly.

### Commission calculation by model

| Model | When event fires | Amount |
|---|---|---|
| First month only | On first successful subscription payment | `subscriptionAmount × rate` |
| Recurring monthly | On every successful subscription renewal | `subscriptionAmount × rate` |
| One-time flat fee | On first successful subscription payment | `flatFeeAmount` (fixed) |

For recurring model, the commission event fires on every Stripe `invoice.payment_succeeded` webhook where the user has a `referredBy` code and the affiliate status is `"active"`.

### Stripe fees on transfers

Stripe Connect charges ~0.25% + 25p per payout on top of normal processing fees. This is taken from the transfer amount. Factor this into the commission rate when setting platform defaults.

---

## Onboarding Expired Page

If the affiliate's onboarding link expires before they complete it:

```
┌────────────────────────────────────────┐
│  This link has expired                 │
│                                        │
│  Stripe onboarding links expire        │
│  after a short time for security.      │
│                                        │
│  [ Request a new link ]                │
│                                        │
│  Or contact hello@mospeech.app         │
└────────────────────────────────────────┘
```

Tapping "Request a new link" calls a Mo Speech API route that generates a fresh `account_link` for the existing Connected Account and emails it to the affiliate.

---

## Environment Variables Required

```
STRIPE_SECRET_KEY                    ← existing
STRIPE_WEBHOOK_SECRET                ← existing
STRIPE_CONNECT_CLIENT_ID            ← new — from Stripe Connect settings
STRIPE_AFFILIATE_COMMISSION_DEFAULT ← new — e.g. "20" (percentage)
```

---

## Convex Schema

### affiliates (new table — convex-home)

```typescript
affiliates: {
  _id: Id<"affiliates">
  userId: Id<"users">                    // the Mo Speech user being made an affiliate
  affiliateCode: string                  // unique — "KATE-UK"
  status: "invited" | "active" | "paused" | "revoked"

  // Commission
  commissionModel: "first_month" | "recurring" | "flat_fee"
  commissionRate?: number                // percentage — e.g. 20
  flatFeeAmount?: number                 // pence — if commissionModel = "flat_fee"

  // Stripe Connect
  stripeAccountId?: string              // "acct_1234XYZ" — set when account created
  stripeOnboardingComplete: boolean     // true when transfers capability active

  // Stats (denormalised for fast admin reads)
  totalReferrals: number
  activeSubscribers: number
  lifetimeEarningsPence: number
  pendingPayoutPence: number

  notes?: string                        // internal admin notes
  createdAt: number
  updatedAt: number
}
```

### commissionEvents (new table — convex-home)

```typescript
commissionEvents: {
  _id: Id<"commissionEvents">
  affiliateId: Id<"affiliates">
  referredUserId: Id<"users">
  stripeInvoiceId: string              // the Stripe invoice that triggered this
  stripeTransferId?: string            // set when transfer is sent to affiliate
  amountPence: number                  // commission amount sent
  status: "pending" | "transferred" | "failed"
  commissionModel: string              // snapshot of model at time of event
  createdAt: number
  transferredAt?: number
}
```

### Addition to users table

```typescript
// Add to existing users schema:
referredBy?: string                    // affiliate code — set on signup if ref param present
```

---

## Screens to Design in Figma

### To be design by Claude code during build

**Admin — User Settings page (affiliate section):**
- State 1: No affiliate status — grant button
- State 2: Creation form (code, rate, model, notes)
- State 3: Invited — awaiting Stripe, resend option
- State 4: Active — stats, earnings, edit/pause/revoke actions

**Affiliate facing pages (on mospeech.app):**
- Invite email (mock as Figma component)
- Onboarding expired page — request new link button
- Welcome / confirmation page after Stripe onboarding complete

**Stripe hosted onboarding pages** — not designed by Mo Speech. Stripe renders these.

---

## Future Considerations

- **Affiliate dashboard** — a lightweight logged-in page on mospeech.app where affiliates can see their own stats, referral link, and payout history without contacting admin
- **Stripe Connect migration for manual affiliates** — if any manual payment affiliates exist from before this feature, they can be migrated by creating a Connected Account for them
- **Tiered commission** — higher rate after a certain number of active referrals (e.g. 20% for first 10, 25% thereafter)
- **Multi-language affiliate materials** — marketing copy in Hindi, Punjabi etc. for international affiliates to share in their communities
