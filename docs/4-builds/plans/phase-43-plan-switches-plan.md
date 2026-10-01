# Phase 43: Plan switches charge and land when they should (MOS-93)

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to work through this plan task by task. Steps
> use checkbox (`- [ ]`) syntax for tracking.

Milestone: Final straight · **M2 Billing truth**. Ticket:
[MOS-93](https://linear.app/mo-intelligence/issue/MOS-93): plan switches are wrong both ways.

**Goal:** an upgrade starts at once and charges the difference at once. A downgrade, or a switch
between monthly and yearly, starts at the end of the period already paid for, shows as a booked
change in Account & Billing, and can be undone until then. A Max family shares one AI picture
allowance.

**Architecture:** Stripe stays the source of truth. An upgrade is a subscription update with
`proration_behavior: "always_invoice"` and `payment_behavior: "pending_if_incomplete"`, so the
plan only changes once the charge is paid. A deferred change is a two-phase Stripe subscription
schedule. One function, `syncSubscription`, reads the subscription and its schedule from Stripe
and writes status, plan and the booked change to the user's row. The webhook and every billing
route call it, so there is one writer and one mapping.

**Tech stack:** Next.js 16 route handlers, Stripe SDK 22.2.1 (API `2026-05-27.dahlia`), Convex,
next-intl, Clerk.

## Owner decisions (2026-10-01)

1. **Upgrades charge now; everything else waits.** A higher tier is an upgrade, whatever the
   billing interval. A lower tier, or the same tier on the other interval, waits for the end of
   the billing period.
2. **The AI picture allowance is shared across the family.** 20 a day and 100 a month for the
   whole account, not per signed-in person.
3. **Pro yearly → Max monthly is allowed** (assumed: the owner was asked and the probe passed;
   veto before Task 2 if not wanted). Stripe puts the unused yearly credit on the customer's
   balance and it pays the following months. No refund.
4. **Image Search's daily limit stays per person.** Only the AI allowance was asked about.

## Facts this plan relies on (checked 2026-10-01 in the Stripe sandbox)

Checked on throwaway test-clock customers, on plain subscriptions and on a **Managed Payments**
subscription (`sub_1ULqKO8dMGCn4YxVaVZ12RZP`, customer `cus_VMR2kWky7AsqbD`, test clock
`clock_1ULiAl8dMGCn4YxVbTG7jOzM`, kept for Task 5).

| Fact | Plain | Managed Payments |
|---|---|---|
| Upgrade with `always_invoice` + `pending_if_incomplete` charges the prorated difference and changes the price | Yes (£3.38) | Yes (£4.05, tax added) |
| A two-phase schedule keeps the current price until period end, then switches | Yes | Yes |
| Monthly → yearly by schedule charges the yearly price at the switch **only** with `billing_cycle_anchor: "phase_start"` on the second phase | Yes (£134) | Yes (£218.40, tax added) |
| Releasing a schedule leaves the subscription untouched | Yes | Yes |
| `cancel_at_period_end` is refused while a schedule is attached | Yes | Yes |
| A credit from a yearly → monthly change sits on the customer balance and pays later invoices | Yes | Yes |
| A declined upgrade leaves the subscription active on the old price with `pending_update` set, and an open invoice with `hosted_invoice_url`; Stripe voids it after 23 hours | Yes | Not testable by API (see below) |
| A second upgrade click while one is pending replaces it and voids the first invoice | Yes | Not tested |
| An upgrade works on a subscription that is set to cancel, and leaves it set to cancel | Yes | Not tested |
| `subscriptions.cancel` (delete account) works with a schedule attached | Yes | Not tested |

More facts:

- **Today's interval switch is a free year.** `proration_behavior: "none"` with a monthly → yearly
  price change raises no invoice and stretches the paid month into a year (next invoice £134 in
  October 2027). The same happens with a schedule that lacks `phase_start`.
- **A direct upgrade does not clear a booked change.** The schedule's later phase stays and would
  land. `upgradeNow` must release the schedule first.
- **`customer.subscription.updated` fires** when a schedule is attached, released, and when a
  phase starts (`previous_attributes` carries `schedule` or `items`). No new webhook event types
  are needed.
- **Managed Payments refuses `default_payment_method` changes by API**, so a declining card can't
  be swapped onto the probe subscription. Task 5 tests a decline with a fresh trial checkout.
- **Managed Payments adds tax on top** of the price (£13.99 → £16.79 for a UK customer). That is
  a MOS-59 matter and is recorded there in Task 5, not fixed here.
- `invoice.payment_failed` today sets the account to `past_due` for **any** failed invoice. A
  failed upgrade charge would therefore lock a paying Pro customer out. Task 3 fixes it.
- Baselines: `npx tsc --noEmit` 0 errors, `npx tsc -p convex/tsconfig.json --noEmit` 0 errors,
  `npm run lint` 63 problems (34 errors, 29 warnings).

## Global constraints

- Work on `main`. One commit per task, with `(MOS-93)` in the subject. Push nothing.
- **Never run** `npm run dev`, `npx convex dev` or `stripe listen`. The owner runs them. The dev
  server is on port 3000 and `convex dev` pushes `convex/` edits on save.
- Read `convex/_generated/ai/guidelines.md` before editing anything under `convex/`.
- There is no test runner. Each task proves itself with the before and after checks written in
  its steps. Paste the real output into your report.
- After every task: `npx tsc --noEmit` and `npx tsc -p convex/tsconfig.json --noEmit` give 0
  errors, and `npm run lint` gives no more than 63 problems (34 errors, 29 warnings).
- UI copy: new keys in `messages/en.json` only. When English copy changes meaning, use a new key
  and delete the old one from every locale file that has it.
- AAC theme tokens only (`text-theme-*`, `gap-theme-*`, ...). No hard-coded colours or sizes.
- Server-only Convex functions take the shared secret (`convex/lib/serverSecret.ts`,
  `lib/convexServer.ts`). Billing routes go through `lib/billingOwner.ts`.
- Match thrown Convex errors with `.includes()`, never `===`.
- Stripe: sandbox only. Scripts must refuse a key that doesn't start with `sk_test_`.
- Writes go to test accounts only. **Never write to account B**
  (`j5717je37k1h19ndtjn0bsgc49892p0v`).
- Scratch scripts live in `.superpowers/sdd/tmp/` (git-ignored). Run TypeScript ones with:
  `npx esbuild <file>.ts --bundle --platform=node --packages=external --outfile=<file>.cjs --log-level=warning && node --env-file=.env.local <file>.cjs`
- Don't touch `convex/studentViewLock.ts`, `convex/studentViewSessions.ts`,
  `app/contexts/ProfileContext.tsx` or the view switcher (phase-41 is in another session).

## Test accounts (Stripe sandbox, dev Convex deployment)

| Account | Convex `users` id | Clerk subject | Stripe subscription | State |
|---|---|---|---|---|
| A | `j5761rg3dwe3r13bzj0s8j0xhd8fb81b` | `user_3JzdGwXIW79ALFbhhHE8ykSQCFG` | `sub_1UKwIf8dMGCn4YxVie1xpylD` | Pro monthly, renews 29 Oct 2026 |
| C, family | `j57bvzrhe81eap0b73kk65tdw58fah5x` | `user_3Jzw6rc4xEnze31jmBwKGW9QkYU` | `sub_1ULL968dMGCn4YxVbsg5BWDx` | Max monthly, renews 30 Oct 2026 |
| Carer of C | `j571dsrsra33kxkz6hx3jjw5z18fdr54` | `user_3K2r1cfBKvEvZcj1DAd8N3Neib0` | none | Free, active member of C |

## File map

| File | Responsibility |
|---|---|
| `convex/schema.ts`, `convex/users.ts` | Store and return the booked change (`pendingPlan`, `pendingPlanAt`) |
| `types/index.ts`, `app/contexts/AppStateProvider.tsx` | Carry the booked change to the client |
| `lib/planChange.ts` (new) | The rule: upgrade, deferred or none. Pure, client-safe |
| `lib/subscriptionState.ts` (new) | Stripe subscription + schedule → what we store. Pure |
| `lib/stripePlanChange.ts` (new) | The Stripe calls: upgrade now, book a change, release it |
| `lib/subscriptionSync.ts` (new) | Read Stripe, write Convex. The one writer |
| `app/api/stripe/switch-plan/route.ts` | Pick upgrade or deferred, then sync |
| `app/api/stripe/keep-plan/route.ts` (new) | Undo a booked change |
| `app/api/stripe/cancel/route.ts`, `reactivate/route.ts` | Release a booked change before cancelling; sync |
| `app/api/stripe/webhook/route.ts` | Use `syncSubscription`; a failed upgrade charge no longer marks the account past due |
| `app/components/app/settings/sections/AccountBillingPanel.tsx`, `messages/*.json` | Booked-change line, undo, honest messages |
| `convex/featureQuota.ts`, `AiGenerateTab.tsx` | One AI allowance per family |

---

## Task 1: Store a booked plan change on the account

**Files:**
- Modify: `convex/schema.ts` (the `users.subscription` object, after `stripeSubscriptionId`)
- Modify: `convex/users.ts` (`updateSubscription`, `getMyAccess`)
- Modify: `types/index.ts` (`UserSubscription`, `UserRecord`)
- Modify: `app/contexts/AppStateProvider.tsx` (the derived `subscription` object)

**Interfaces:**
- Produces: `users.subscription.pendingPlan?: "pro_monthly" | "pro_yearly" | "max_monthly" | "max_yearly"`
  and `users.subscription.pendingPlanAt?: number` (ms).
- Produces: `api.users.updateSubscription` accepts `pendingPlan` and `pendingPlanAt`. For both,
  `null` clears the field and leaving it out keeps what is stored.
- Produces: `api.users.getMyAccess` returns `pendingPlan: SubscriptionPlanId | null` and
  `pendingPlanAt: number | null`.
- Produces: `UserSubscription.pendingPlan` and `UserSubscription.pendingPlanAt` on the client
  (`useAppState().subscription`).

- [ ] **Step 1: Before check**

```bash
npx convex run users:getMyAccess '{}' --identity '{"subject":"user_3JzdGwXIW79ALFbhhHE8ykSQCFG"}'
```

Expected: an object with `plan: "pro_monthly"` and **no** `pendingPlan` key.

- [ ] **Step 2: Schema**

In `convex/schema.ts`, inside `users.subscription`, after `stripeSubscriptionId: v.optional(v.string()),`:

```ts
      // A plan change booked for the end of the current billing period
      // (MOS-93): a downgrade, or a monthly/yearly switch. Mirrors the Stripe
      // subscription schedule. `updateSubscription` writes and clears both.
      pendingPlan: v.optional(
        v.union(
          v.literal("pro_monthly"),
          v.literal("pro_yearly"),
          v.literal("max_monthly"),
          v.literal("max_yearly")
        )
      ),
      pendingPlanAt: v.optional(v.number()), // ms: when pendingPlan takes over
```

- [ ] **Step 3: `updateSubscription`**

In `convex/users.ts`, add two args after `subscriptionEndsAt`:

```ts
    // null clears the field; leaving it out keeps what is stored.
    pendingPlan: v.optional(
      v.union(
        v.literal("pro_monthly"),
        v.literal("pro_yearly"),
        v.literal("max_monthly"),
        v.literal("max_yearly"),
        v.null()
      )
    ),
    pendingPlanAt: v.optional(v.union(v.number(), v.null())),
```

Replace the handler with:

```ts
  handler: async (ctx, args) => {
    assertServerSecret(args.serverSecret);
    const { userId, serverSecret: _s, pendingPlan, pendingPlanAt, ...fields } = args;
    void _s;
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const subscription = { ...user.subscription, ...fields };
    if (pendingPlan === null) delete subscription.pendingPlan;
    else if (pendingPlan !== undefined) subscription.pendingPlan = pendingPlan;
    if (pendingPlanAt === null) delete subscription.pendingPlanAt;
    else if (pendingPlanAt !== undefined) subscription.pendingPlanAt = pendingPlanAt;

    await ctx.db.patch(userId, { subscription, lastActiveAt: Date.now() });
  },
```

- [ ] **Step 4: `getMyAccess`**

In the returned object of `getMyAccess`, after `subscriptionEndsAt: subscriptionEndsAt ?? null,`:

```ts
      pendingPlan: planUser.subscription.pendingPlan ?? null,
      pendingPlanAt: planUser.subscription.pendingPlanAt ?? null,
```

- [ ] **Step 5: Client types**

In `types/index.ts`, `UserSubscription` gains two fields after `subscriptionEndsAt`:

```ts
  pendingPlan: SubscriptionPlanId | null;   // a change booked for the next billing date
  pendingPlanAt: number | null;             // ms: when it takes over
```

and `UserRecord.subscription` gains, after `subscriptionEndsAt?: number | null;`:

```ts
    pendingPlan?: SubscriptionPlanId;
    pendingPlanAt?: number;
```

In `app/contexts/AppStateProvider.tsx`, in the derived `subscription` object, after
`subscriptionEndsAt: accessData?.subscriptionEndsAt ?? null,`:

```ts
    pendingPlan: accessData?.pendingPlan ?? null,
    pendingPlanAt: accessData?.pendingPlanAt ?? null,
```

- [ ] **Step 6: After check (writes to test account A only)**

Wait a few seconds for `convex dev` to push, then:

```bash
npx convex run users:getMyAccess '{}' --identity '{"subject":"user_3JzdGwXIW79ALFbhhHE8ykSQCFG"}'
```

Expected: `pendingPlan: null`, `pendingPlanAt: null`.

```bash
SECRET=$(node --env-file=.env.local -p 'process.env.CONVEX_SERVER_SECRET')
npx convex run users:updateSubscription "{\"userId\":\"j5761rg3dwe3r13bzj0s8j0xhd8fb81b\",\"status\":\"active\",\"pendingPlan\":\"pro_yearly\",\"pendingPlanAt\":1793262127000,\"serverSecret\":\"$SECRET\"}"
npx convex run users:getMyAccess '{}' --identity '{"subject":"user_3JzdGwXIW79ALFbhhHE8ykSQCFG"}'
```

Expected: `pendingPlan: "pro_yearly"`, `pendingPlanAt: 1793262127000`, and `plan` still
`"pro_monthly"`, `tier` still `"pro"`.

```bash
npx convex run users:updateSubscription "{\"userId\":\"j5761rg3dwe3r13bzj0s8j0xhd8fb81b\",\"status\":\"active\",\"pendingPlan\":null,\"pendingPlanAt\":null,\"serverSecret\":\"$SECRET\"}"
npx convex run users:getMyAccess '{}' --identity '{"subject":"user_3JzdGwXIW79ALFbhhHE8ykSQCFG"}'
```

Expected: both back to `null`, and the stored row has neither key.

```bash
npx convex run users:updateSubscription '{"userId":"j5761rg3dwe3r13bzj0s8j0xhd8fb81b","status":"active","pendingPlan":"max_yearly","serverSecret":"wrong"}'
```

Expected: fails with `Server-only function.` and nothing is written.

- [ ] **Step 7: Type-check, lint, commit**

```bash
npx tsc --noEmit && npx tsc -p convex/tsconfig.json --noEmit && npm run lint 2>&1 | grep problems
git add convex/schema.ts convex/users.ts convex/_generated types/index.ts app/contexts/AppStateProvider.tsx
git commit -m "feat(billing): store a booked plan change on the account (MOS-93)"
```

Expected: 0 errors twice, `63 problems (34 errors, 29 warnings)`.

---

## Task 2: The plan-change rule and the Stripe operations

**Files:**
- Create: `lib/planChange.ts`
- Create: `lib/subscriptionState.ts`
- Create: `lib/stripePlanChange.ts`
- Scratch (not committed): `.superpowers/sdd/tmp/check-plan-change.ts`

**Interfaces:**
- Produces (`lib/planChange.ts`):
  `type PlanChangeKind = "none" | "upgrade" | "deferred"` and
  `classifyPlanChange(current: SubscriptionPlanId, target: SubscriptionPlanId): PlanChangeKind`.
- Produces (`lib/subscriptionState.ts`):
  `type StoredStatus = "active" | "cancelled" | "past_due" | "expired"`,
  `planIdFromPriceId(priceId: string): SubscriptionPlanId | null`,
  `statusFromSubscription(sub: Stripe.Subscription): StoredStatus`,
  `type SubscriptionState = { status: StoredStatus; plan: SubscriptionPlanId | null; subscriptionEndsAt: number | null; pendingPlan: SubscriptionPlanId | null; pendingPlanAt: number | null; scheduleIsSpent: boolean }`,
  `subscriptionState(sub: Stripe.Subscription, schedule: Stripe.SubscriptionSchedule | null): SubscriptionState`.
- Produces (`lib/stripePlanChange.ts`):
  `releaseScheduleIfAny(sub: Stripe.Subscription): Promise<void>`,
  `type UpgradeResult = { applied: true } | { applied: false; payUrl: string | null }`,
  `upgradeNow(sub: Stripe.Subscription, priceId: string): Promise<UpgradeResult>`,
  `scheduleChangeAtPeriodEnd(sub: Stripe.Subscription, priceId: string, interval: "month" | "year"): Promise<{ effectiveAt: number }>`.

- [ ] **Step 1: Write the check script first**

Create `.superpowers/sdd/tmp/check-plan-change.ts`:

```ts
// Sandbox check for lib/planChange, lib/subscriptionState and lib/stripePlanChange.
// Throwaway test-clock customers only. Deletes its clocks at the end.
import type Stripe from "stripe";
import { stripe, getPriceId } from "@/lib/stripe";
import { classifyPlanChange } from "@/lib/planChange";
import { subscriptionState } from "@/lib/subscriptionState";
import { upgradeNow, scheduleChangeAtPeriodEnd, releaseScheduleIfAny } from "@/lib/stripePlanChange";

if (!(process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_")) throw new Error("Not a test key");

const DAY = 86400;
let failures = 0;
function expect(label: string, actual: unknown, wanted: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(wanted);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}: ${JSON.stringify(actual)}${ok ? "" : ` (wanted ${JSON.stringify(wanted)})`}`);
}
async function advance(clock: string, to: number) {
  await stripe.testHelpers.testClocks.advance(clock, { frozen_time: to });
  for (let i = 0; i < 90; i++) {
    const c = await stripe.testHelpers.testClocks.retrieve(clock);
    if (c.status === "ready") return;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("test clock did not settle");
}
async function customer(clock: string, card = "pm_card_visa") {
  const c = await stripe.customers.create({ test_clock: clock, name: "MOS-93 check" });
  const pm = await stripe.paymentMethods.attach(card, { customer: c.id });
  await stripe.customers.update(c.id, { invoice_settings: { default_payment_method: pm.id } });
  return c.id;
}
async function load(id: string) {
  const sub = await stripe.subscriptions.retrieve(id, { expand: ["schedule"] });
  const schedule = sub.schedule && typeof sub.schedule !== "string" ? sub.schedule : null;
  return { sub, state: subscriptionState(sub, schedule) };
}
async function lastInvoice(customerId: string): Promise<Stripe.Invoice> {
  return (await stripe.invoices.list({ customer: customerId, limit: 1 })).data[0];
}

(async () => {
  // ── The rule ────────────────────────────────────────────────────────────
  expect("pro_monthly → max_monthly", classifyPlanChange("pro_monthly", "max_monthly"), "upgrade");
  expect("pro_monthly → max_yearly", classifyPlanChange("pro_monthly", "max_yearly"), "upgrade");
  expect("pro_yearly → max_monthly", classifyPlanChange("pro_yearly", "max_monthly"), "upgrade");
  expect("max_monthly → pro_monthly", classifyPlanChange("max_monthly", "pro_monthly"), "deferred");
  expect("max_yearly → pro_monthly", classifyPlanChange("max_yearly", "pro_monthly"), "deferred");
  expect("pro_monthly → pro_yearly", classifyPlanChange("pro_monthly", "pro_yearly"), "deferred");
  expect("max_yearly → max_monthly", classifyPlanChange("max_yearly", "max_monthly"), "deferred");
  expect("max_monthly → max_monthly", classifyPlanChange("max_monthly", "max_monthly"), "none");

  const now = Math.floor(Date.now() / 1000);
  const clock = (await stripe.testHelpers.testClocks.create({ frozen_time: now, name: "MOS-93 check" })).id;
  const clockYear = (await stripe.testHelpers.testClocks.create({ frozen_time: now, name: "MOS-93 check yearly" })).id;
  try {
    // ── 1. Upgrade now ─────────────────────────────────────────────────────
    const c1 = await customer(clock);
    const s1 = await stripe.subscriptions.create({ customer: c1, items: [{ price: getPriceId("pro", "monthly") }] });
    await advance(clock, now + 10 * DAY);
    let { sub } = await load(s1.id);
    expect("1 upgrade applied", await upgradeNow(sub, getPriceId("max", "monthly")), { applied: true });
    let loaded = await load(s1.id);
    expect("1 plan is max_monthly", loaded.state.plan, "max_monthly");
    const inv1 = await lastInvoice(c1);
    expect("1 difference charged now", [inv1.billing_reason, inv1.status, inv1.total > 0 && inv1.total < 500], ["subscription_update", "paid", true]);

    // ── 2. Book a downgrade, undo it, book it again ────────────────────────
    const periodEnd = loaded.sub.items.data[0].current_period_end;
    const booked = await scheduleChangeAtPeriodEnd(loaded.sub, getPriceId("pro", "monthly"), "month");
    expect("2 effective at period end", booked.effectiveAt, periodEnd * 1000);
    loaded = await load(s1.id);
    expect("2 still max, change booked", [loaded.state.plan, loaded.state.pendingPlan, loaded.state.pendingPlanAt, loaded.state.scheduleIsSpent],
      ["max_monthly", "pro_monthly", periodEnd * 1000, false]);
    expect("2 no new invoice", (await lastInvoice(c1)).id, inv1.id);
    await releaseScheduleIfAny(loaded.sub);
    loaded = await load(s1.id);
    expect("2 undone", [loaded.state.plan, loaded.state.pendingPlan, loaded.sub.schedule], ["max_monthly", null, null]);
    await scheduleChangeAtPeriodEnd(loaded.sub, getPriceId("pro", "monthly"), "month");

    // ── 3. A booked change does not survive an upgrade ─────────────────────
    const c3 = await customer(clock);
    const s3 = await stripe.subscriptions.create({ customer: c3, items: [{ price: getPriceId("pro", "monthly") }] });
    await scheduleChangeAtPeriodEnd((await load(s3.id)).sub, getPriceId("pro", "yearly"), "year");
    expect("3 interval switch booked", (await load(s3.id)).state.pendingPlan, "pro_yearly");
    expect("3 upgrade applied", await upgradeNow((await load(s3.id)).sub, getPriceId("max", "monthly")), { applied: true });
    loaded = await load(s3.id);
    expect("3 max now, nothing booked", [loaded.state.plan, loaded.state.pendingPlan, loaded.sub.schedule], ["max_monthly", null, null]);

    // ── 4. Declined card, and a subscription that is set to cancel ─────────
    const c4 = await customer(clock);
    const s4 = await stripe.subscriptions.create({ customer: c4, items: [{ price: getPriceId("pro", "monthly") }] });
    const bad = await stripe.paymentMethods.attach("pm_card_chargeCustomerFail", { customer: c4 });
    await stripe.customers.update(c4, { invoice_settings: { default_payment_method: bad.id } });
    await stripe.subscriptions.update(s4.id, { cancel_at_period_end: true });
    await advance(clock, now + 15 * DAY);
    const declined = await upgradeNow((await load(s4.id)).sub, getPriceId("max", "monthly"));
    expect("4 declined: not applied, pay link given", [declined.applied, declined.applied === false && typeof declined.payUrl], [false, "string"]);
    loaded = await load(s4.id);
    expect("4 still pro, still active, still cancelling", [loaded.state.plan, loaded.state.status, loaded.sub.status], ["pro_monthly", "cancelled", "active"]);
    const good = await stripe.paymentMethods.attach("pm_card_visa", { customer: c4 });
    await stripe.customers.update(c4, { invoice_settings: { default_payment_method: good.id } });
    expect("4 good card: applied", await upgradeNow((await load(s4.id)).sub, getPriceId("max", "monthly")), { applied: true });
    loaded = await load(s4.id);
    expect("4 max, and no longer cancelling", [loaded.state.plan, loaded.state.status], ["max_monthly", "active"]);

    // ── 5. The booked downgrade lands at period end ────────────────────────
    await advance(clock, periodEnd + 2 * DAY);
    loaded = await load(s1.id);
    expect("5 landed on pro_monthly, schedule spent", [loaded.state.plan, loaded.state.pendingPlan, loaded.state.scheduleIsSpent], ["pro_monthly", null, true]);
    const inv5 = await lastInvoice(c1);
    expect("5 renewal charged at the Pro price", [inv5.status, inv5.total], ["paid", 1399]);

    // ── 6. Yearly → monthly lands at the year end (own clock) ──────────────
    const c6 = await customer(clockYear);
    const s6 = await stripe.subscriptions.create({ customer: c6, items: [{ price: getPriceId("max", "yearly") }] });
    const yearEnd = (await load(s6.id)).sub.items.data[0].current_period_end;
    await scheduleChangeAtPeriodEnd((await load(s6.id)).sub, getPriceId("pro", "monthly"), "month");
    // A test clock moves at most two billing intervals (here: two months) at a time.
    for (let t = now + 55 * DAY; t < yearEnd; t += 55 * DAY) await advance(clockYear, t);
    loaded = await load(s6.id);
    expect("6 still max_yearly before the year end", [loaded.state.plan, loaded.state.pendingPlan], ["max_yearly", "pro_monthly"]);
    await advance(clockYear, yearEnd + 2 * DAY);
    loaded = await load(s6.id);
    const inv6 = await lastInvoice(c6);
    expect("6 landed on pro_monthly, charged the monthly price", [loaded.state.plan, inv6.status, inv6.total], ["pro_monthly", "paid", 1399]);
  } finally {
    await stripe.testHelpers.testClocks.del(clock);
    await stripe.testHelpers.testClocks.del(clockYear);
  }
  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error("FATAL", e?.type, e?.code, e?.message ?? e);
  process.exit(1);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx esbuild .superpowers/sdd/tmp/check-plan-change.ts --bundle --platform=node --packages=external --outfile=.superpowers/sdd/tmp/check-plan-change.cjs --log-level=warning
```

Expected: esbuild fails with `Could not resolve "@/lib/planChange"`.

- [ ] **Step 3: `lib/planChange.ts`**

```ts
import type { SubscriptionPlanId } from "@/types";

/**
 * The rule for a plan switch (MOS-93). Pure, so the server route and the
 * billing panel agree on what a click will do.
 */
export type PlanChangeKind = "none" | "upgrade" | "deferred";

const tierRank = (plan: SubscriptionPlanId): number => (plan.startsWith("max") ? 2 : 1);

/**
 * - "upgrade": a higher tier, on either billing interval. Starts now, and the
 *   difference is charged now.
 * - "deferred": a lower tier, or the same tier on the other interval. Starts
 *   at the end of the period already paid for.
 * - "none": the same plan.
 */
export function classifyPlanChange(
  current: SubscriptionPlanId,
  target: SubscriptionPlanId,
): PlanChangeKind {
  if (current === target) return "none";
  return tierRank(target) > tierRank(current) ? "upgrade" : "deferred";
}
```

- [ ] **Step 4: `lib/subscriptionState.ts`**

`planIdFromPriceId` and `statusFromSubscription` move here from the webhook unchanged (Task 3
deletes the webhook's copies).

```ts
import type Stripe from "stripe";
import type { SubscriptionPlanId } from "@/types";

export type StoredStatus = "active" | "cancelled" | "past_due" | "expired";

// Map Stripe price ID to full plan ID (encodes tier + billing interval).
// An unknown price returns null and callers leave the stored plan untouched,
// so a misconfigured price can never silently grant or downgrade a tier.
export function planIdFromPriceId(priceId: string): SubscriptionPlanId | null {
  if (priceId === process.env.STRIPE_PRO_MONTHLY_PRICE_ID) return "pro_monthly";
  if (priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID) return "pro_yearly";
  if (priceId === process.env.STRIPE_MAX_MONTHLY_PRICE_ID) return "max_monthly";
  if (priceId === process.env.STRIPE_MAX_YEARLY_PRICE_ID) return "max_yearly";
  console.error("[stripe] unknown price", priceId);
  return null;
}

// Map a Stripe subscription onto our stored status. A scheduled cancellation
// stays usable until period end ("cancelled" + subscriptionEndsAt); anything
// that isn't paid-up or retrying payment is "expired" so it never unlocks.
export function statusFromSubscription(sub: Stripe.Subscription): StoredStatus {
  if (sub.cancel_at_period_end) return "cancelled";
  switch (sub.status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "incomplete":
    case "incomplete_expired":
    case "canceled":
    case "paused":
      return "expired";
  }
}

export type SubscriptionState = {
  status: StoredStatus;
  plan: SubscriptionPlanId | null;
  subscriptionEndsAt: number | null;
  /** A change booked for the end of the current period (MOS-93), or null. */
  pendingPlan: SubscriptionPlanId | null;
  pendingPlanAt: number | null;
  /** A schedule is attached but has nothing left to change. Release it. */
  scheduleIsSpent: boolean;
};

/**
 * What we store for a subscription, read from Stripe alone. The plan is the
 * price Stripe is billing **now**: an unpaid upgrade (`pending_update`) and a
 * booked change (a later schedule phase) don't move it.
 */
export function subscriptionState(
  sub: Stripe.Subscription,
  schedule: Stripe.SubscriptionSchedule | null,
): SubscriptionState {
  const item = sub.items.data[0];
  const plan = planIdFromPriceId(item?.price.id ?? "");

  let pendingPlan: SubscriptionPlanId | null = null;
  let pendingPlanAt: number | null = null;
  const current = schedule?.status === "active" ? schedule.current_phase : null;
  if (schedule && current) {
    const next = schedule.phases.find((phase) => phase.start_date >= current.end_date);
    const nextPrice = next?.items[0]?.price;
    const nextPlan = nextPrice
      ? planIdFromPriceId(typeof nextPrice === "string" ? nextPrice : nextPrice.id)
      : null;
    if (next && nextPlan && nextPlan !== plan) {
      pendingPlan = nextPlan;
      pendingPlanAt = next.start_date * 1000;
    }
  }

  return {
    status: statusFromSubscription(sub),
    plan,
    subscriptionEndsAt: sub.cancel_at_period_end
      ? (sub.cancel_at ?? item?.current_period_end ?? 0) * 1000
      : null,
    pendingPlan,
    pendingPlanAt,
    scheduleIsSpent: schedule != null && schedule.status === "active" && pendingPlan === null,
  };
}
```

- [ ] **Step 5: `lib/stripePlanChange.ts`**

```ts
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";

/**
 * The Stripe calls behind a plan switch (MOS-93). Every behaviour here was
 * checked in the sandbox on plain and Managed Payments subscriptions; see
 * docs/4-builds/plans/_done/phase-43-plan-switches-plan.md.
 */

/** Drop any booked plan change. The subscription itself is left as it is. */
export async function releaseScheduleIfAny(sub: Stripe.Subscription): Promise<void> {
  if (!sub.schedule) return;
  const id = typeof sub.schedule === "string" ? sub.schedule : sub.schedule.id;
  await stripe.subscriptionSchedules.release(id);
}

export type UpgradeResult =
  | { applied: true }
  /** The charge didn't go through. `payUrl` is Stripe's page to pay or authenticate. */
  | { applied: false; payUrl: string | null };

/**
 * Move to a higher tier now and charge the prorated difference now. The price
 * only changes once that charge is paid: until then Stripe keeps the old price
 * and holds the change as a pending update for 23 hours.
 */
export async function upgradeNow(
  sub: Stripe.Subscription,
  priceId: string,
): Promise<UpgradeResult> {
  const itemId = sub.items.data[0]?.id;
  if (!itemId) throw new Error("Subscription has no item");

  // A booked downgrade or interval switch would still land after the upgrade.
  await releaseScheduleIfAny(sub);

  const updated = await stripe.subscriptions.update(sub.id, {
    items: [{ id: itemId, price: priceId }],
    proration_behavior: "always_invoice",
    payment_behavior: "pending_if_incomplete",
    expand: ["latest_invoice"],
  });

  if (updated.pending_update) {
    const invoice = updated.latest_invoice;
    return {
      applied: false,
      payUrl: invoice && typeof invoice !== "string" ? invoice.hosted_invoice_url ?? null : null,
    };
  }

  // Upgrading a plan that was set to cancel keeps it going. Stripe won't take
  // this in the same call as a pending update, and it must not happen when the
  // charge failed.
  if (updated.cancel_at_period_end) {
    await stripe.subscriptions.update(sub.id, { cancel_at_period_end: false });
  }
  return { applied: true };
}

/**
 * Book a change of price for the end of the period already paid for. Nothing
 * is charged and nothing changes until then. `billing_cycle_anchor:
 * "phase_start"` is what makes the new price bill in full at the switch:
 * without it a monthly → yearly change stretches the paid month into a year.
 */
export async function scheduleChangeAtPeriodEnd(
  sub: Stripe.Subscription,
  priceId: string,
  interval: "month" | "year",
): Promise<{ effectiveAt: number }> {
  await releaseScheduleIfAny(sub);
  // Stripe refuses cancellation changes once a schedule is attached, and
  // choosing a new plan means the customer is staying.
  if (sub.cancel_at_period_end) {
    await stripe.subscriptions.update(sub.id, { cancel_at_period_end: false });
  }

  const schedule = await stripe.subscriptionSchedules.create({ from_subscription: sub.id });
  const current = schedule.phases[0];
  try {
    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: "release",
      phases: [
        {
          items: current.items.map((item) => ({
            price: typeof item.price === "string" ? item.price : item.price.id,
            quantity: item.quantity ?? 1,
          })),
          start_date: current.start_date,
          end_date: current.end_date,
        },
        {
          items: [{ price: priceId, quantity: 1 }],
          billing_cycle_anchor: "phase_start",
          proration_behavior: "none",
          duration: { interval, interval_count: 1 },
        },
      ],
    });
  } catch (err) {
    // Don't leave a one-phase schedule behind: it would block cancelling.
    await stripe.subscriptionSchedules.release(schedule.id).catch(() => undefined);
    throw err;
  }
  return { effectiveAt: current.end_date * 1000 };
}
```

- [ ] **Step 6: Run the check**

```bash
npx esbuild .superpowers/sdd/tmp/check-plan-change.ts --bundle --platform=node --packages=external --outfile=.superpowers/sdd/tmp/check-plan-change.cjs --log-level=warning && node --env-file=.env.local .superpowers/sdd/tmp/check-plan-change.cjs
```

Expected: every line starts `PASS`, the last line is `ALL PASS`. It takes three to five minutes
(test clocks). If a line fails, fix the library, not the expectation, unless Stripe's real
behaviour differs from "Facts this plan relies on". In that case stop and report it.

- [ ] **Step 7: Type-check, lint, commit**

```bash
npx tsc --noEmit && npm run lint 2>&1 | grep problems
git add lib/planChange.ts lib/subscriptionState.ts lib/stripePlanChange.ts
git commit -m "feat(billing): plan-change rule and Stripe operations (MOS-93)"
```

Expected: 0 errors, `63 problems (34 errors, 29 warnings)`. The webhook still has its own copies
of `planIdFromPriceId` and `statusFromSubscription`. That's expected until Task 3.

---

## Task 3: Routes and webhook use the new operations

**Files:**
- Create: `lib/subscriptionSync.ts`
- Modify: `app/api/stripe/switch-plan/route.ts` (the whole `try` block and imports)
- Create: `app/api/stripe/keep-plan/route.ts`
- Modify: `app/api/stripe/cancel/route.ts`, `app/api/stripe/reactivate/route.ts`
- Modify: `app/api/stripe/webhook/route.ts`
- Scratch (not committed): `.superpowers/sdd/tmp/check-sync.ts`

**Interfaces:**
- Consumes: `classifyPlanChange` (`lib/planChange.ts`); `planIdFromPriceId`, `subscriptionState`,
  `SubscriptionState` (`lib/subscriptionState.ts`); `upgradeNow`, `scheduleChangeAtPeriodEnd`,
  `releaseScheduleIfAny` (`lib/stripePlanChange.ts`); `api.users.updateSubscription` with
  `pendingPlan` / `pendingPlanAt` (Task 1).
- Produces (`lib/subscriptionSync.ts`):
  `syncSubscription(userId: Id<"users">, subscriptionId: string): Promise<SubscriptionState>` and
  `syncSubscriptionQuietly(userId: Id<"users">, subscriptionId: string): Promise<void>`.
- Produces: `POST /api/stripe/switch-plan` with body `{ tier, plan }` answers one of
  `{ success: true, outcome: "upgraded" }`,
  `{ success: true, outcome: "scheduled", effectiveAt: number }`,
  `{ success: true, outcome: "none" }`,
  `{ url: string }` (pay or authenticate on Stripe's page), or
  `{ error: "payment_problem" | "billing_misconfigured" | "unknown" | "owner_only" }`.
- Produces: `POST /api/stripe/keep-plan` (no body) answers `{ success: true }`.

- [ ] **Step 1: `lib/subscriptionSync.ts`**

```ts
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { stripe } from "@/lib/stripe";
import { serverSecret } from "@/lib/convexServer";
import { subscriptionState, type SubscriptionState } from "@/lib/subscriptionState";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Read a subscription from Stripe and store what it says: status, plan, and
 * any change booked for the next billing date (MOS-93). The webhook and every
 * billing route call this, so there is one writer and one mapping. It reads
 * Stripe fresh rather than trusting an event payload: events can arrive out
 * of order, and the booked change lives on the schedule, not the subscription.
 */
export async function syncSubscription(
  userId: Id<"users">,
  subscriptionId: string,
): Promise<SubscriptionState> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["schedule"] });
  const schedule = sub.schedule && typeof sub.schedule !== "string" ? sub.schedule : null;
  const state = subscriptionState(sub, schedule);

  // The booked change has landed. Stripe refuses to cancel a subscription
  // while a schedule is attached, so let it go.
  if (state.scheduleIsSpent && schedule) {
    await stripe.subscriptionSchedules.release(schedule.id);
  }

  await convex.mutation(api.users.updateSubscription, {
    userId,
    status: state.status,
    ...(state.plan ? { plan: state.plan } : {}),
    ...(state.subscriptionEndsAt != null ? { subscriptionEndsAt: state.subscriptionEndsAt } : {}),
    pendingPlan: state.pendingPlan,
    pendingPlanAt: state.pendingPlanAt,
    serverSecret: serverSecret(),
  });
  return state;
}

/**
 * For routes: the Stripe change already succeeded, so a failed write must not
 * turn into an error for the customer. The webhook writes the same state.
 */
export async function syncSubscriptionQuietly(
  userId: Id<"users">,
  subscriptionId: string,
): Promise<void> {
  try {
    await syncSubscription(userId, subscriptionId);
  } catch (err) {
    console.error("[stripe] sync after a billing action failed; the webhook will catch up", err);
  }
}
```

- [ ] **Step 2: `switch-plan` route**

Replace the imports and everything from `const user = await convex.query(` to the end of
`app/api/stripe/switch-plan/route.ts`. The auth, owner guard and body parsing above it stay.

Imports (replace the existing import block):

```ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { stripe, getPriceId, isPriceTier, isPricePlan } from "@/lib/stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { serverSecret } from "@/lib/convexServer";
import { requireBillingOwner } from "@/lib/billingOwner";
import { stripeErrorResponse } from "@/lib/stripeErrors";
import { classifyPlanChange } from "@/lib/planChange";
import { planIdFromPriceId } from "@/lib/subscriptionState";
import { upgradeNow, scheduleChangeAtPeriodEnd } from "@/lib/stripePlanChange";
import { syncSubscriptionQuietly } from "@/lib/subscriptionSync";
import type { SubscriptionPlanId } from "@/types";
```

Body:

```ts
  const user = await convex.query(api.users.getUserByClerkId, {
    clerkUserId: userId,
    serverSecret: serverSecret(),
  });
  const subscriptionId = user?.subscription.stripeSubscriptionId;
  if (!user || !subscriptionId) {
    return NextResponse.json({ error: "No active subscription found" }, { status: 400 });
  }

  try {
    const priceId = getPriceId(tier, plan);
    const targetPlan: SubscriptionPlanId = `${tier}_${plan}`;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // The price Stripe is billing decides what counts as an upgrade. The
    // stored plan covers a subscription on an archived price.
    const currentPlan =
      planIdFromPriceId(subscription.items.data[0]?.price.id ?? "") ??
      user.subscription.plan ??
      null;
    if (!currentPlan) {
      console.error("[stripe:switch-plan] can't tell the current plan", { subscriptionId });
      return NextResponse.json({ error: "billing_misconfigured" }, { status: 500 });
    }

    const kind = classifyPlanChange(currentPlan, targetPlan);
    if (kind === "none") {
      return NextResponse.json({ success: true, outcome: "none" });
    }

    if (kind === "upgrade") {
      // Starts now, charged now. The plan only changes once the charge is paid.
      const result = await upgradeNow(subscription, priceId);
      await syncSubscriptionQuietly(user._id, subscriptionId);
      if (result.applied) {
        return NextResponse.json({ success: true, outcome: "upgraded" });
      }
      if (result.payUrl) {
        // The card was declined or needs authentication: Stripe's page takes it.
        return NextResponse.json({ url: result.payUrl });
      }
      return NextResponse.json({ error: "payment_problem" }, { status: 402 });
    }

    // A lower tier, or the other billing interval: booked for the end of the
    // period already paid for.
    const { effectiveAt } = await scheduleChangeAtPeriodEnd(
      subscription,
      priceId,
      plan === "yearly" ? "year" : "month",
    );
    await syncSubscriptionQuietly(user._id, subscriptionId);
    return NextResponse.json({ success: true, outcome: "scheduled", effectiveAt });
  } catch (err) {
    return stripeErrorResponse("switch-plan", err);
  }
}
```

- [ ] **Step 3: `keep-plan` route (new)**

Create `app/api/stripe/keep-plan/route.ts`:

```ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { serverSecret } from "@/lib/convexServer";
import { requireBillingOwner } from "@/lib/billingOwner";
import { stripeErrorResponse } from "@/lib/stripeErrors";
import { releaseScheduleIfAny } from "@/lib/stripePlanChange";
import { syncSubscriptionQuietly } from "@/lib/subscriptionSync";

export const dynamic = "force-dynamic";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/** Undo a plan change booked for the next billing date (MOS-93). */
export async function POST() {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const denied = await requireBillingOwner(getToken);
  if (denied) return denied;

  const user = await convex.query(api.users.getUserByClerkId, {
    clerkUserId: userId,
    serverSecret: serverSecret(),
  });
  const subscriptionId = user?.subscription.stripeSubscriptionId;
  if (!user || !subscriptionId) {
    return NextResponse.json({ error: "No active subscription" }, { status: 400 });
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await releaseScheduleIfAny(subscription);
    await syncSubscriptionQuietly(user._id, subscriptionId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return stripeErrorResponse("keep-plan", err);
  }
}
```

- [ ] **Step 4: `cancel` and `reactivate` routes**

In `app/api/stripe/cancel/route.ts`, add the two imports:

```ts
import { releaseScheduleIfAny } from "@/lib/stripePlanChange";
import { syncSubscriptionQuietly } from "@/lib/subscriptionSync";
```

and replace from `if (!user?.subscription.stripeSubscriptionId) {` to the end of the file:

```ts
  const subscriptionId = user?.subscription.stripeSubscriptionId;
  if (!user || !subscriptionId) {
    return NextResponse.json({ error: "No active subscription" }, { status: 400 });
  }

  try {
    // Stripe refuses to cancel while a plan change is booked, and cancelling
    // replaces that change anyway.
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await releaseScheduleIfAny(subscription);
    await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
    await syncSubscriptionQuietly(user._id, subscriptionId);

    return NextResponse.json({ success: true });
  } catch (err) {
    return stripeErrorResponse("cancel", err);
  }
}
```

In `app/api/stripe/reactivate/route.ts`, add
`import { syncSubscriptionQuietly } from "@/lib/subscriptionSync";` and replace from
`if (!user?.subscription.stripeSubscriptionId) {` to the end of the file:

```ts
  const subscriptionId = user?.subscription.stripeSubscriptionId;
  if (!user || !subscriptionId) {
    return NextResponse.json({ error: "No subscription to reactivate" }, { status: 400 });
  }

  try {
    await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false });
    await syncSubscriptionQuietly(user._id, subscriptionId);

    return NextResponse.json({ success: true });
  } catch (err) {
    return stripeErrorResponse("reactivate", err);
  }
}
```

- [ ] **Step 5: Webhook**

In `app/api/stripe/webhook/route.ts`:

1. Delete the local `planIdFromPriceId`, `StoredStatus`, `statusFromSubscription` and
   `tierRank`, with their comments. Add:

```ts
import { classifyPlanChange } from "@/lib/planChange";
import { planIdFromPriceId } from "@/lib/subscriptionState";
import { syncSubscription } from "@/lib/subscriptionSync";
```

   Remove `import type { SubscriptionPlanId } from "@/types";` if nothing else in the file uses it.

2. Replace the `customer.subscription.updated` case, from `const priceId = sub.items.data[0]?.price.id ?? "";`
   down to and including the `isUpgrade` line's `trackServer(...)` call, so the case reads:

```ts
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const user = await convex.query(api.users.getUserByStripeCustomerId, {
          stripeCustomerId: sub.customer as string,
          serverSecret: serverSecret(),
        });
        if (!user) break;

        const oldPlan = user.subscription.plan;
        // Store what Stripe says now, not what this event carried: events can
        // arrive out of order, and a change booked for the next billing date
        // lives on the schedule, which the payload doesn't include. A booked
        // change or an unpaid upgrade leaves the plan where it is (MOS-93).
        const state = await syncSubscription(user._id, sub.id);
        const newPlan = state.plan;

        // Decode the diff into a meaningful analytics event. Stripe sends the
        // change in `event.data.previous_attributes`; we use the user's prior
        // stored plan as a fallback signal when previous_attributes is sparse.
        const prev = (event.data as { previous_attributes?: { cancel_at_period_end?: boolean } })
          .previous_attributes;
        const wasReactivated =
          prev?.cancel_at_period_end === true && sub.cancel_at_period_end === false;
        const wasCancelled =
          prev?.cancel_at_period_end === false && sub.cancel_at_period_end === true;
        const trackedPlan = newPlan ?? oldPlan ?? null;

        if (wasReactivated) {
          trackServer(user.clerkUserId, "reactivated", { plan: trackedPlan });
        } else if (wasCancelled) {
          trackServer(user.clerkUserId, "cancelled", { plan: trackedPlan });
        } else if (newPlan && oldPlan && oldPlan !== newPlan) {
          const isUpgrade = classifyPlanChange(oldPlan, newPlan) === "upgrade";
          trackServer(user.clerkUserId, isUpgrade ? "upgraded" : "downgraded", {
            from_plan: oldPlan,
            to_plan: newPlan,
          });
        }
        // Otherwise: a booked change, billing-cycle anchor change, etc. — no event.
        break;
      }
```

3. In `customer.subscription.deleted`, the mutation gains two fields:

```ts
        await convex.mutation(api.users.updateSubscription, {
          userId: user._id,
          status: "expired",
          pendingPlan: null,
          pendingPlanAt: null,
          serverSecret: serverSecret(),
        });
```

4. In `invoice.payment_failed`, replace the `updateSubscription` call with:

```ts
        // A failed renewal makes the subscription past due. A failed upgrade
        // charge doesn't: Stripe keeps the subscription active on the plan
        // already paid for (MOS-93). So store what the subscription says.
        if (user.subscription.stripeSubscriptionId) {
          await syncSubscription(user._id, user.subscription.stripeSubscriptionId);
        } else {
          await convex.mutation(api.users.updateSubscription, {
            userId: user._id,
            status: "past_due",
            serverSecret: serverSecret(),
          });
        }
```

The `checkout.session.completed` case keeps calling `planIdFromPriceId`, now imported.

- [ ] **Step 6: Check the sync against test account A (writes to A and its sandbox subscription only)**

Create `.superpowers/sdd/tmp/check-sync.ts`:

```ts
// Books and undoes a change on TEST ACCOUNT A's sandbox subscription and checks
// that syncSubscription stores it. Leaves A exactly as it found it.
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { stripe, getPriceId } from "@/lib/stripe";
import { serverSecret } from "@/lib/convexServer";
import { scheduleChangeAtPeriodEnd, releaseScheduleIfAny } from "@/lib/stripePlanChange";
import { syncSubscription } from "@/lib/subscriptionSync";

if (!(process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_")) throw new Error("Not a test key");
const CLERK_ID = "user_3JzdGwXIW79ALFbhhHE8ykSQCFG";
const SUB = "sub_1UKwIf8dMGCn4YxVie1xpylD";
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// What is stored on A's row, minus the Stripe IDs.
async function stored() {
  const user = await convex.query(api.users.getUserByClerkId, {
    clerkUserId: CLERK_ID,
    serverSecret: serverSecret(),
  });
  if (!user) throw new Error("Test account A not found");
  const { status, plan, pendingPlan, pendingPlanAt } = user.subscription;
  return { userId: user._id, row: { status, plan, pendingPlan, pendingPlanAt } };
}

(async () => {
  const { userId, row } = await stored();
  if (row.plan !== "pro_monthly" || row.status !== "active") {
    throw new Error(`A is not Pro monthly and active (${JSON.stringify(row)}). Stop and report.`);
  }

  await syncSubscription(userId, SUB);
  console.log("1 start    ", JSON.stringify((await stored()).row));

  let sub = await stripe.subscriptions.retrieve(SUB);
  const { effectiveAt } = await scheduleChangeAtPeriodEnd(sub, getPriceId("pro", "yearly"), "year");
  const state = await syncSubscription(userId, SUB);
  console.log("2 booked   ", JSON.stringify((await stored()).row), "effectiveAt", effectiveAt, "spent", state.scheduleIsSpent);

  sub = await stripe.subscriptions.retrieve(SUB);
  await releaseScheduleIfAny(sub);
  await syncSubscription(userId, SUB);
  console.log("3 undone   ", JSON.stringify((await stored()).row));
  console.log("3 schedule ", (await stripe.subscriptions.retrieve(SUB)).schedule);
})().catch((e) => {
  console.error("FATAL", e?.type, e?.code, e?.message ?? e);
  process.exit(1);
});
```

```bash
npx esbuild .superpowers/sdd/tmp/check-sync.ts --bundle --platform=node --packages=external --outfile=.superpowers/sdd/tmp/check-sync.cjs --log-level=warning && node --env-file=.env.local .superpowers/sdd/tmp/check-sync.cjs
```

Expected:
- `1 start`: `{"status":"active","plan":"pro_monthly"}` (no pending keys).
- `2 booked`: `"plan":"pro_monthly","pendingPlan":"pro_yearly","pendingPlanAt":<ms>` where the
  number equals `effectiveAt` and is 29 October 2026, and `spent false`.
- `3 undone`: `{"status":"active","plan":"pro_monthly"}` again, and `3 schedule null`.

Then, as the signed-in account sees it:

```bash
npx convex run users:getMyAccess '{}' --identity '{"subject":"user_3JzdGwXIW79ALFbhhHE8ykSQCFG"}'
```

Expected: `plan: "pro_monthly"`, `tier: "pro"`, `pendingPlan: null`.

- [ ] **Step 7: Routes exist and are guarded**

```bash
curl -s -X POST http://localhost:3000/api/stripe/keep-plan
curl -s -X POST http://localhost:3000/api/stripe/switch-plan -H 'Content-Type: application/json' -d '{"tier":"max","plan":"monthly"}'
```

Expected: `{"error":"Unauthorized"}` for both (signed out). The signed-in paths are checked in
the owner's browser in Task 5.

- [ ] **Step 8: Type-check, lint, commit**

```bash
npx tsc --noEmit && npm run lint 2>&1 | grep problems
git add lib/subscriptionSync.ts app/api/stripe
git commit -m "fix(billing): upgrades charge now, other plan changes wait for the billing date (MOS-93)"
```

Expected: 0 errors, `63 problems (34 errors, 29 warnings)`.

---

## Task 4: Account & Billing shows the booked change and tells the truth

**Files:**
- Modify: `app/components/app/settings/sections/AccountBillingPanel.tsx`
- Modify: `messages/en.json` (the `plan` block), `messages/es.json`, `messages/hi.json` (deletions only)

**Interfaces:**
- Consumes: `useAppState().subscription.pendingPlan` / `.pendingPlanAt` (Task 1);
  `POST /api/stripe/switch-plan` answers and `POST /api/stripe/keep-plan` (Task 3).

- [ ] **Step 1: Before check**

```bash
node -e 'for (const l of ["en","es","hi","pa"]) { const p = require(`./messages/${l}.json`).plan ?? {}; console.log(l, ["changeNotice","switchSuccess","planChangeNotice","changeScheduled","pendingChange","ctaKeepCurrentPlan","keepPlanSuccess","ctaScheduled","planLabel","intervalMonthly","intervalYearly"].filter((k) => k in p)); }'
```

Expected: `en`, `es` and `hi` each list `changeNotice` and `switchSuccess` only; `pa` lists nothing.

- [ ] **Step 2: Copy**

In `messages/en.json`, in the `plan` block, **delete** `changeNotice` and `switchSuccess` and
**add**:

```json
    "planChangeNotice": "Upgrades start straight away and you pay the difference today. Downgrades and monthly or yearly switches start at your next billing date. No refunds.",
    "planLabel": "{name} ({interval})",
    "intervalMonthly": "monthly",
    "intervalYearly": "yearly",
    "changeScheduled": "Your plan changes to {plan} on {date}. Nothing changes until then.",
    "pendingChange": "Changing to {plan} on {date}.",
    "ctaKeepCurrentPlan": "Keep current plan",
    "keepPlanSuccess": "Your plan stays as it is.",
    "ctaScheduled": "Scheduled",
```

`upgradeSuccess` ("Plan upgraded — new features are available now.") stays: it is still true.

Delete `changeNotice` and `switchSuccess` from `messages/es.json` and `messages/hi.json` too.
Their meaning changed, so the old translations must not survive. Add nothing to those files:
the translation pipeline fills in keys that are missing.

- [ ] **Step 3: Panel logic**

In `AccountBillingPanel.tsx`:

1. Add the type import next to the other imports:

```ts
import type { SubscriptionPlanId } from "@/types";
```

2. Replace the destructuring line:

```ts
  const { tier, status, plan, subscriptionEndsAt, pendingPlan, pendingPlanAt } = subscription;
```

3. Replace `callApi` with a version whose success message can depend on the answer:

```ts
  type ApiAnswer = { error?: string; url?: string; outcome?: string; effectiveAt?: number };

  const callApi = async (
    url: string,
    body?: object,
    successMsg?: string | ((data: ApiAnswer) => string),
  ) => {
    setActionState({ status: "loading" });
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = (await res.json()) as ApiAnswer;
      if (!res.ok || data.error) {
        const message =
          data.error === "billing_misconfigured" ? t("errorMisconfigured")
          : data.error === "payment_problem" ? t("errorPaymentProblem")
          : t("errorGeneric");
        setActionState({ status: "error", message });
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setActionState({
        status: "success",
        message: typeof successMsg === "function" ? successMsg(data) : successMsg ?? "",
      });
    } catch {
      setActionState({ status: "error", message: t("errorGeneric") });
    }
  };

  const planLabel = (p: SubscriptionPlanId) =>
    t("planLabel", {
      name: p.startsWith("max") ? t("maxName") : t("proName"),
      interval: p.endsWith("yearly") ? t("intervalYearly") : t("intervalMonthly"),
    });

  // The server decides whether a switch starts now or at the next billing
  // date (lib/planChange.ts), so the message comes from its answer.
  const switchPlan = (targetTier: "pro" | "max") =>
    callApi("/api/stripe/switch-plan", { tier: targetTier, plan: billingInterval }, (data) =>
      data.outcome === "scheduled" && data.effectiveAt
        ? t("changeScheduled", {
            plan: planLabel(`${targetTier}_${billingInterval}`),
            date: formatDate(data.effectiveAt),
          })
        : t("upgradeSuccess"),
    );
```

4. In `renderPaidCTA`, replace each of the three `onClick={() => callApi("/api/stripe/switch-plan", …)}`
   handlers (two "Switch to yearly/monthly" buttons and the final upgrade/downgrade button) with:

```tsx
            onClick={() => switchPlan(targetTier)}
```

5. In `renderPaidCTA`, directly after the `if (tier === "free" || isExpired) { … }` block, add:

```tsx
    if (pendingPlan === `${targetTier}_${billingInterval}`) {
      return (
        <Button variant="secondary" size="sm" disabled className="w-full opacity-60 cursor-default">
          {t("ctaScheduled")}
        </Button>
      );
    }
```

6. Replace the notice at the top of the section:

```tsx
          {isSubscribed ? (
            <p className="text-theme-s text-theme-secondary-alt-text">{t("changeNotice")}</p>
          ) : (
            <span />
          )}
```

   with:

```tsx
          {isSubscribed && pendingPlan && pendingPlanAt ? (
            <div className="flex flex-wrap items-center gap-theme-gap">
              <p className="text-theme-s text-theme-secondary-alt-text">
                {t("pendingChange", { plan: planLabel(pendingPlan), date: formatDate(pendingPlanAt) })}
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => callApi("/api/stripe/keep-plan", undefined, t("keepPlanSuccess"))}
                loading={isLoading}
              >
                {t("ctaKeepCurrentPlan")}
              </Button>
            </div>
          ) : isSubscribed ? (
            <p className="text-theme-s text-theme-secondary-alt-text">{t("planChangeNotice")}</p>
          ) : (
            <span />
          )}
```

- [ ] **Step 4: After check**

Run the Step 1 command again. Expected: `en` lists the nine new keys and neither old key; `es`,
`hi` and `pa` list nothing.

```bash
grep -rn "changeNotice\|switchSuccess" app lib messages | grep -v planChangeNotice
```

Expected: no output.

- [ ] **Step 5: Type-check, lint, commit**

```bash
npx tsc --noEmit && npm run lint 2>&1 | grep problems
git add app/components/app/settings/sections/AccountBillingPanel.tsx messages/en.json messages/es.json messages/hi.json
git commit -m "feat(billing): show a booked plan change, with a way to undo it (MOS-93)"
```

Expected: 0 errors, `63 problems (34 errors, 29 warnings)`. The browser check is Task 5.

---

## Task 4b: A family shares one AI picture allowance

Rides along with MOS-93 by the owner's decision (2026-10-01).

**Files:**
- Modify: `convex/featureQuota.ts` (`getRemainingDual`, `checkAndIncrementDual`, `refundOneDual`)
- Modify: `app/components/app/shared/modals/symbol-editor/AiGenerateTab.tsx:126-127`
- Modify: `messages/en.json`

**Interfaces:**
- Consumes: `resolveCallerAccountId(ctx)` from `convex/lib/account.ts`, which returns
  `{ accountId, user, planUser, role } | null`. `planUser` is the family owner's `users` row for
  an active carer and the caller's own row otherwise.
- Produces: the three `*Dual` functions keep their names, args and return shapes. Only the key
  they count under changes.

Image Search's single-meter functions (`getRemaining`, `checkAndIncrement`, `refundOne`) are
**not** changed.

- [ ] **Step 1: Before check (writes one count to the carer's own allowance, then takes it back)**

Run the four commands in one shell call, so `$ARGS` is set for all of them.

```bash
ARGS='{"feature":"aiImageGenerate","dailyLimit":20,"monthlyLimit":100}'
npx convex run featureQuota:getRemainingDual "$ARGS" --identity '{"subject":"user_3Jzw6rc4xEnze31jmBwKGW9QkYU"}'
npx convex run featureQuota:checkAndIncrementDual "$ARGS" --identity '{"subject":"user_3K2r1cfBKvEvZcj1DAd8N3Neib0"}'
npx convex run featureQuota:getRemainingDual "$ARGS" --identity '{"subject":"user_3Jzw6rc4xEnze31jmBwKGW9QkYU"}'
npx convex run featureQuota:refundOneDual '{"feature":"aiImageGenerate"}' --identity '{"subject":"user_3K2r1cfBKvEvZcj1DAd8N3Neib0"}'
```

Expected: owner C's `daily.used` is the **same** on the first and third lines. The carer's
generation didn't touch the family's allowance. That is the behaviour being changed.

- [ ] **Step 2: Share the key**

In `convex/featureQuota.ts`, add the import:

```ts
import { resolveCallerAccountId } from "./lib/account";
```

Add above `getRemainingDual`:

```ts
/**
 * Whose AI allowance a call spends (MOS-93). AI pictures are paid for by the
 * family's Max plan, so everyone working in a family draws on one allowance:
 * an invited carer counts under the family owner's Clerk ID, anyone else under
 * their own. Null when signed out or without an account row.
 */
async function sharedQuotaKey(ctx: QueryCtx | MutationCtx): Promise<string | null> {
  const resolved = await resolveCallerAccountId(ctx);
  return resolved ? resolved.planUser.clerkUserId : null;
}
```

In `getRemainingDual`, replace

```ts
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const dayRow = await findQuotaRow(ctx, identity.subject, args.feature, todayKey());
    const monthRow = await findQuotaRow(ctx, identity.subject, args.feature, monthKey());
```

with

```ts
    const userId = await sharedQuotaKey(ctx);
    if (!userId) return null;

    const dayRow = await findQuotaRow(ctx, userId, args.feature, todayKey());
    const monthRow = await findQuotaRow(ctx, userId, args.feature, monthKey());
```

In `checkAndIncrementDual` and in `refundOneDual`, replace

```ts
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const userId = identity.subject;
```

with

```ts
    const userId = await sharedQuotaKey(ctx);
    if (!userId) throw new Error("Unauthenticated");
```

- [ ] **Step 3: Copy**

The limit messages say "You've used…", which is no longer true when a carer used them. In
`messages/en.json` **delete** `aiQuotaExceeded` and `aiQuotaExceededMonth` and **add**, in the
same block:

```json
    "aiQuotaDayUsed": "Today's {limit} generations are used up. More tomorrow — this month's allowance still has room.",
    "aiQuotaMonthUsed": "This month's {limit} generations are used up. The allowance resets on the 1st.",
```

(`es`, `hi` and `pa` don't have the old keys; check with
`grep -c '"aiQuotaExceeded' messages/*.json` and delete any that appear.)

In `AiGenerateTab.tsx`, lines 126-127 become:

```tsx
            ? t("aiQuotaMonthUsed", { limit: body.limit ?? AI_IMAGE_MONTHLY_LIMIT_DEFAULT })
            : t("aiQuotaDayUsed", { limit: body?.limit ?? AI_IMAGE_DAILY_LIMIT_DEFAULT })
```

- [ ] **Step 4: After check**

Wait for `convex dev` to push, then run the four Step 1 commands again.

Expected: owner C's `daily.used` and `monthly.used` on the third line are each **one higher**
than on the first, and after the refund:

```bash
npx convex run featureQuota:getRemainingDual "$ARGS" --identity '{"subject":"user_3Jzw6rc4xEnze31jmBwKGW9QkYU"}'
npx convex run featureQuota:getRemainingDual "$ARGS" --identity '{"subject":"user_3K2r1cfBKvEvZcj1DAd8N3Neib0"}'
npx convex run featureQuota:getRemainingDual "$ARGS" --identity '{"subject":"user_3JzdGwXIW79ALFbhhHE8ykSQCFG"}'
```

Expected: C and the carer show the **same** numbers, back to the first line's values. Account A
(another account) is unaffected by any of it.

- [ ] **Step 5: Type-check, lint, commit**

```bash
npx tsc --noEmit && npx tsc -p convex/tsconfig.json --noEmit && npm run lint 2>&1 | grep problems
git add convex/featureQuota.ts app/components/app/shared/modals/symbol-editor/AiGenerateTab.tsx messages/en.json
git commit -m "feat(quota): a family shares one AI picture allowance (MOS-93)"
```

Expected: 0 errors twice, `63 problems (34 errors, 29 warnings)`.

---

## Task 5: Browser check, Managed Payments decline check, docs (controller)

Done by the controller with the owner, in the owner's Chrome through the Claude in Chrome
extension. The owner does every sign-in and card step.

- [ ] **Step 1: Account A in the browser** (owner signed in as A; A is Pro monthly, renews 29 Oct)

After each step, read the subscription back from Stripe with a read-only script
(`subscriptions.retrieve` with `expand: ["schedule"]`, plus the customer's last three invoices).

1. Settings → Account & Billing shows the new notice ("Upgrades start straight away…").
2. Toggle Yearly → **Switch to yearly** on Pro. Message: "Your plan changes to Pro (yearly) on
   29 October 2026…". The line "Changing to Pro (yearly) on 29 October 2026." appears with
   **Keep current plan**, and the Pro yearly button reads **Scheduled**. Stripe: still
   `pro_monthly`, a schedule attached, **no new invoice**.
3. **Keep current plan**. The line goes. Stripe: no schedule.
4. Toggle Monthly → **Upgrade to Max**. Message: "Plan upgraded…". The symbol editor's Upload
   tab is open. Stripe: `max_monthly`, a new **paid** invoice with reason `subscription_update`
   for the prorated difference (under £5), no schedule.
5. **Downgrade to Pro**. Message names 29 October. Upload tab **still open**. Stripe: still
   `max_monthly`, schedule attached.
6. **Cancel subscription** while the downgrade is booked. It works: "Cancels 29 October 2026",
   the booked line is gone. Stripe: `cancel_at_period_end: true`, no schedule.
7. **Reactivate**. Then **Downgrade to Pro** again and leave it booked. On or after 29 October,
   check that A is Pro and was charged £13.99. Note the date in the ledger.

- [ ] **Step 2: The family (account C and its carer)**

1. Signed in as C: **Downgrade to Pro**. Then from the command line:
   `npx convex run users:getMyAccess '{}' --identity '{"subject":"user_3K2r1cfBKvEvZcj1DAd8N3Neib0"}'`
   Expected: the carer still has `tier: "max"`, `hasFullAccess: true`, and sees
   `pendingPlan: "pro_monthly"`.
2. `curl` can't sign in, so check the guard in the browser as the carer:
   `fetch("/api/stripe/keep-plan", { method: "POST" })` answers 403 `owner_only`.
3. As C: **Keep current plan**. C stays on Max.

- [ ] **Step 3: A declined upgrade under Managed Payments**

Create a throwaway Managed Payments checkout with a trial, so a card that attaches but can't be
charged gets through checkout:

```ts
// scratch: stripe.checkout.sessions.create({
//   mode: "subscription", customer: <new test-clock customer>,
//   line_items: [{ price: getPriceId("pro", "monthly"), quantity: 1 }],
//   managed_payments: { enabled: true },
//   subscription_data: { trial_period_days: 3 },
//   success_url: "http://localhost:3000/en/settings?smp_probe=done",
// })
```

The owner pays it with Stripe's test card `4000 0000 0000 0341`. Then call
`upgradeNow(sub, getPriceId("max", "monthly"))` from a scratch script and record:
`applied`, whether `payUrl` is present, `sub.status`, and what `subscriptionState` returns.
Expected, as on a plain subscription: `applied: false`, a `payUrl`, the subscription still
active on Pro. If Managed Payments behaves differently, or refuses a trial, write what happened
on MOS-59 and decide with the owner whether the route needs a Managed Payments branch before
launch. Delete the probe clocks afterwards (`clock_1ULiAl8dMGCn4YxVbTG7jOzM` and the new one).

- [ ] **Step 4: Docs**

- `docs/4-builds/features/FEAT-108-pricing-and-tiers.md`:
  - "Managing a plan": an upgrade starts at once and the difference is paid at once; a downgrade
    or monthly/yearly switch starts at the next billing date, shows as a booked change and can
    be undone with **Keep current plan**; cancelling drops a booked change.
  - Edge cases: a failed upgrade payment leaves the plan as it was and sends the customer to
    Stripe's page to pay; a yearly plan upgraded to a monthly one keeps its unused credit, which
    pays the following months; the AI allowance is shared by the family.
  - "What the build still needs": the **Changing plan** row becomes Shipped with the date.
    Update the status banner.
- `docs/4-builds/features/FEAT-106-settings.md`, "Account & Billing": the booked-change line and
  **Keep current plan**.
- `docs/4-builds/features/FEAT-203-symbol-editor.md` (lines 65 and 171): the 20 a day and 100 a
  month are shared by everyone in the family.
- `docs/4-builds/decisions/ADR-025-stripe-managed-payments-mor.md`: append a dated note. Checked
  in the sandbox: schedules, prorated upgrade invoices and credit balances work on Managed
  Payments subscriptions; the card on file can't be changed by API; tax is added on top of the
  price unless the price is tax-inclusive.
- `docs/4-builds/changelog/<date>-plan-switches.md`: what changed, what it does to the working
  app, the free-year finding, how it was verified, files.
- `docs/01-final-straight.md`: a dated M2 note, and MOS-93 added to the M2 row of the table.
- Linear: MOS-93 → Done with a summary comment. MOS-59 gets a comment: tax on top (£13.99 →
  £16.79), no new webhook event types needed, card changes go through Onelink, and the result of
  Step 3.
- Move this plan to `docs/4-builds/plans/_done/`.

```bash
git add docs
git commit -m "docs: phase-43 plan switches verified; plan to _done (MOS-93)"
```

## Not in this plan

- **Account B's stored plan is out of step with Stripe** (its subscription is cancelled; Convex
  says active Max). Nothing reconciles a missed webhook. `syncSubscription` makes a reconcile
  job easy later; it needs its own ticket.
- Prices that include tax under Managed Payments (MOS-59).
- MOS-91 (client gates read the effective tier) and phase-41 (device lock).
