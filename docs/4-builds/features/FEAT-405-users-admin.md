# FEAT-405 · Users admin

**Layer 4 · Admin** · [Back to the index](README.md)

- Every Mo Speech account in one searchable list
- Search by email or name, and filter by subscription status
- Open an account to see its details, subscription and student profiles
- **Custom access:** give an account full Max features without payment, for a
  reason, optionally until a date
- Every grant and revoke is recorded, with who did it and why
- Read-only otherwise: payments are managed in Stripe, not here

---

## What it does

When a family writes in, a school asks for a trial, or a tester needs access,
the team needs to see the account and sometimes change what it can use. The
**Users** page of the admin dashboard (see [FEAT-401](FEAT-401-admin-dashboard.md))
is where that happens.

### The list

Every account, with a search box (**email or name**) and a status filter:
**Active**, **Cancelled**, **Past due**, **Expired**, or **Free (legacy)** (see
below). Each row shows:

- the **user**, and when they **joined**,
- their **plan**, with a **Custom** badge if they have custom access,
- how many **student profiles** they have,
- when they were **last active**,
- whether they're linked to **Stripe** (the payment service).

The list is paged for when there are many accounts.

### An account

Opening an account shows:

- **Account:** when they joined, when they were last active, and their
  sign-in and database IDs, for support and debugging.
- **Subscription:** plan, monthly or yearly billing, when it renews or ends,
  and their Stripe customer and subscription IDs.
- **Profiles:** their student profiles, with a **Locked** badge on any whose
  view is locked. See [FEAT-301](FEAT-301-instructor-and-student-views.md).
- **Custom access** (below).

### Custom access

**Grant** gives an account every Max feature without paying. It asks for:

- a **reason**: Compassionate access, Partner / school trial, Support
  compensation, Beta tester, Family or friend, Press / demo, Affiliate gift, or
  Other (notes are required for Other, so no grant is ever unexplained),
- an optional **expiry date**. With no date, the grant lasts until revoked,
- optional **notes**.

**Revoke** ends it. The card shows the grant's state (**Active**, **Expired** or
**None**), and a **history** of every grant and revoke, newest first: the
reason, who did it, when, and the expiry.

A grant stops working the moment its expiry passes, and a daily clean-up marks
expired grants as ended.

## Why it helps

- **Support in one place.** Everything needed to help a family is on one
  page.
- **Generosity with a record.** Compassionate access, school trials and
  testers can be given in seconds, and every grant has a reason and a name
  against it.
- **Time-limited trials.** An expiry date means a school trial ends on its
  own, with nothing to remember.

## Audio

Not applicable.

## Edge cases

- **Custom access means Max.** A grant unlocks every Max feature, whatever the
  account's own plan. When the grant ends, the account falls back to its own
  plan. See [FEAT-108](FEAT-108-pricing-and-tiers.md).
- **"Free (legacy)"** is the filter for accounts carrying the old 14-day
  "trial" marker that new accounts are still given. It grants nothing. It's
  being removed in [MOS-28](https://linear.app/mo-intelligence/issue/MOS-28).
- **Payments aren't changed here.** Refunds, plan changes for paying customers
  and billing problems are handled in Stripe.
- **Not yet shown:** storage used by an account, and its recent activity. They
  need data the app doesn't collect yet.
- **Planned: affiliates.** Making someone an affiliate, and seeing their
  referrals and earnings, will be a card on this page, next to Custom access
  (M3, [MOS-62](https://linear.app/mo-intelligence/issue/MOS-62)).

## Where it lives

- The pages: `app/(admin)/admin/users/` (the list, and each account)
- The list, custom access card and grant/revoke windows:
  `app/components/admin/`
- The access rules (what a grant allows, and when it expires):
  `convex/lib/access.ts`

## Links

- **Up from:** [FEAT-401 Admin dashboard](FEAT-401-admin-dashboard.md)
- **Related:** [FEAT-108 Pricing & tiers](FEAT-108-pricing-and-tiers.md) ·
  [FEAT-301 Instructor & student views](FEAT-301-instructor-and-student-views.md)
