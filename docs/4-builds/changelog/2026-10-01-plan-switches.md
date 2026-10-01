# 2026-10-01: Plan switches

**Milestone:** M2 Billing truth (Final straight project) · **Issue:** MOS-93
**Spec:** [FEAT-108](../features/FEAT-108-pricing-and-tiers.md) ·
[FEAT-106](../features/FEAT-106-settings.md) ·
[FEAT-203](../features/FEAT-203-symbol-editor.md) · **Plan:**
[phase-43-plan-switches-plan](../plans/phase-43-plan-switches-plan.md) · **Decisions:**
[ADR-025](../decisions/ADR-025-stripe-managed-payments-mor.md)

Changing plan now charges and takes effect when the app says it does. Built and on `main`,
checked against the Stripe sandbox; the owner's browser check is still to do.

## What was wrong

- **An upgrade wasn't charged.** Pro to Max unlocked Max at once and billed nothing until the
  next renewal.
- **A downgrade took the features away at once**, although the message said "at your next billing
  date".
- **Switching monthly to yearly gave a year for one month's price.** Found while planning: the
  switch raised no invoice and stretched the paid month into a year. Pay £13.99, click "Switch to
  yearly", and Pro ran until the following October.
- **A failed upgrade charge would have locked out a paying customer.** The webhook marked any
  failed invoice as past due.

No live customers are on this build, so no money was lost.

## What it does now

- **Upgrade (Pro to Max):** starts at once and charges the difference for the rest of the period
  at once. The plan only changes when that payment goes through. If the card is declined or the
  bank wants to confirm it, the page moves to Stripe's payment page; the old plan stays until
  it's paid.
- **Downgrade, or monthly/yearly switch:** booked for the end of the period already paid for.
  Nothing changes and nothing is charged until then. Account & Billing shows "Changing to Pro
  (monthly) on 29 October 2026" with **Keep current plan** to undo it.
- **Cancel** drops a booked change. Upgrading or booking a change on a cancelled plan keeps the
  plan going.
- **One AI picture allowance per family.** The 20 a day and 100 a month are counted for the
  account, not for each signed-in person. Before, every carer in a Max family had a full
  allowance of their own. Image Search's daily limit is still per person.

## How it works

Stripe stays the source of truth. An upgrade is a subscription update that Stripe holds as
pending until the charge is paid. A deferred change is a two-phase Stripe subscription schedule.
One function (`lib/subscriptionSync.ts`) reads the subscription and its schedule from Stripe and
writes status, plan and the booked change to the account; the webhook and every billing route
use it.

## Stripe Managed Payments

Checked on a sandbox subscription bought through a Managed Payments checkout: schedules, prorated
upgrade charges and credit balances all work, so the same code serves both. Two things for MOS-59:

- **Tax is added on top of the price** (£13.99 charged £16.79 to a UK address). Prices need to
  include tax before launch.
- **The live webhook endpoint needs two more event types:** `subscription_schedule.updated` and
  `customer.subscription.pending_update_applied`.

## Checked so far

- A sandbox script on Stripe test clocks exercises the real code: upgrade charged and applied;
  declined upgrade leaves the plan alone; a booked downgrade and a booked monthly/yearly switch
  both land on the billing date at the right price (including yearly to monthly at the year
  end); undo; booking on a cancelled plan; a failed booking puts the cancellation back;
  upgrades across billing intervals; an upgrade paid later.
- On test account A (a real Checkout subscription): a booked change is stored and cleared
  correctly, and the card stays attached.
- In the owner's Chrome as the carer: all five billing routes refuse (403). With a downgrade
  booked on the family, the carer keeps Max.
- From the command line: a carer's AI picture now counts against the family's allowance.

**Still to do:** the browser check as the owner (the upgrade, the booked change and its undo,
cancel with a change booked, a declined card), and a declined upgrade on a Managed Payments
subscription.

## Found, not fixed here

- **The quota functions can be called from the browser with limits the caller picks**, so a Max
  user could refund their own AI counter without limit. Older than this work. Needs a ticket.
- **Checkout doesn't stop an owner who already has a subscription** from starting a second one.
  Needs a ticket.
- **Nothing reconciles a missed webhook.** The owner's main account still shows Max although its
  Stripe subscription ended in September. Needs a ticket; the new sync function makes it small.
- A booked change drops any trial or discount on the subscription. There are none today.
- A past-due account has no way to fix its card from the billing page.

**Files:** `lib/planChange.ts`, `lib/subscriptionState.ts`, `lib/stripePlanChange.ts`,
`lib/subscriptionSync.ts`, `app/api/stripe/{switch-plan,keep-plan,cancel,reactivate,webhook}/route.ts`,
`convex/schema.ts`, `convex/users.ts`, `convex/featureQuota.ts`, `types/index.ts`,
`app/contexts/AppStateProvider.tsx`,
`app/components/app/settings/sections/AccountBillingPanel.tsx`,
`app/components/app/shared/modals/symbol-editor/AiGenerateTab.tsx`, `messages/{en,es,hi}.json`.

**Code review:** each task's commit was reviewed separately, then the whole phase. Two fix rounds
came out of it: one for failure paths in the booking code and a race that could drop a booked
change, one for how a subscription's status is read. See the plan's "Fix rounds".
