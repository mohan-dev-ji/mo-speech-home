# Phase 38: Billing truth (M2, code that doesn't need the Ltd)

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to work through this plan task by task. Steps
> use checkbox (`- [ ]`) syntax for tracking.

Milestone: Final straight · **M2 Billing truth**. Tickets: MOS-87, MOS-28, MOS-29, MOS-49, and
the part of MOS-59 that doesn't need the Ltd's Stripe account. The business tickets (MOS-57 side
letter, MOS-58 incorporation) are the owner's and happen outside the code. MOS-59's final step
(turning on Managed Payments on the Ltd's account, live prices, end-to-end test) is blocked on
MOS-58 and is **not** in this plan. It stays open on MOS-59.

**Goal:** the app charges, gates and describes exactly the three plans in FEAT-108, and nobody can
give themselves a plan without paying.

**Architecture:** no new tables. Server gates stay in `convex/lib/access.ts` and the API routes.
The Upload tab and My Images gain a Max gate on both the server and the client. Module installs
start comparing tier *rank* instead of "any paid plan". The subscription status loses `"trial"`
and gains `"free"`. Checkout stays on Stripe Checkout Sessions and gets the Managed Payments flag
behind an env var, so switching on the Ltd's account is a config change.

**Tech stack:** Next.js 16 route handlers, Convex, Stripe SDK `stripe@22` (API `2026-05-27.dahlia`),
next-intl.

## Decisions (owner, 2026-09-28)

- **Yearly = a 20% saving.** Pro **£134 / yr** (12 × £13.99 × 0.8 = £134.30), Max **£182 / yr**
  (12 × £18.99 × 0.8 = £182.30). Rounded down, so "Save 20%" stays true (the real saving is
  20.2%).
- **Instruments and Clothes move to Max.** They aren't re-authored.
- **Work on `main`**, one commit per task, ticket ID in each commit message. No worktree.

## Global constraints

- **UI copy:** every string comes from `useTranslations`. New keys go in `messages/en.json`
  **only**. When English copy *changes meaning*, give it a **new key** and delete the old key
  from every locale file (`en`, `es`, `hi`, `pa`). The translation pipeline only translates keys
  that are missing, so an edited value under an old key would keep the stale Hindi and Spanish
  forever. See CLAUDE.md rule 1.
- **Theme tokens only** in app UI (CLAUDE.md rule 5). Reuse the existing lock-panel markup from
  `ImagesTab.tsx`.
- **Convex:** read `convex/_generated/ai/guidelines.md` before touching `convex/`. Every function
  has argument validators.
- **Schema changes are two deploys:** widen the validator and migrate the data first, narrow the
  validator second. Take a backup first:
  `npx convex export --path backups/2026-09-28-pre-phase-38.zip`.
- **There is no unit-test runner in this repo.** The check for each task is:
  `npx tsc --noEmit` (app), `npx tsc -p convex/tsconfig.json --noEmit` (backend), `npm run lint`
  (no new errors against the MOS-51 baseline: 36 errors, 29 warnings), plus the manual or CLI
  check written in the task. Each task states what should go wrong before the change and work
  after it.
- The owner runs `npx convex dev` on `main`, so `convex/` changes auto-push. Don't start a second
  `convex dev` or `npm run dev` (the dev server is already on port 3001).
- Browser checks of the signed-in app go through Claude in Chrome, not the in-app browser (see
  memory).

---

## Task 1: Lock the server-only Convex functions (MOS-87)

**Problem.** `users.updateSubscription`, `users.getUserByClerkId` and
`users.getUserByStripeCustomerId` are public functions with no check. Anyone with the (public)
Convex URL can call `updateSubscription` and set themselves to `max_yearly`.

**Files:**
- Create: `convex/lib/serverSecret.ts`, `lib/convexServer.ts`
- Modify: `convex/users.ts` (the three functions)
- Modify: `app/api/stripe/webhook/route.ts`, `app/api/stripe/cancel/route.ts`,
  `app/api/stripe/portal/route.ts`, `app/api/stripe/reactivate/route.ts`,
  `app/api/stripe/switch-plan/route.ts`, `app/api/delete-account/route.ts`,
  `app/api/upload-asset/route.ts`
- Modify: `lib/env.ts`, `.env.local.example`

**Interfaces:**
- Produces: `assertServerSecret(secret: string): void` (throws `ConvexError({ code: "FORBIDDEN" })`).
- Produces: all three functions take a new required arg `serverSecret: v.string()`.
- Produces: `lib/convexServer.ts` exports `serverSecret(): string`, which reads
  `process.env.CONVEX_SERVER_SECRET` and throws if it's missing. Every route uses it.

- [ ] **Step 1: Confirm the hole is real, read-only.** `npx convex run` uses admin rights, so it
  proves nothing. Call the public HTTP API with no credentials instead, as an attacker would:

```bash
curl -s -X POST "$NEXT_PUBLIC_CONVEX_URL/api/query" -H 'Content-Type: application/json' \
  -d '{"path":"users:getUserByClerkId","args":{"clerkUserId":"<a test account Clerk ID>"},"format":"json"}'
```

  (Load the URL with `source <(grep NEXT_PUBLIC_CONVEX_URL .env.local)` first.) Expected: the full
  user row comes back, email included. Don't test the write path against real data. The same
  endpoint at `/api/mutation` reaches `updateSubscription` in the same way.

- [ ] **Step 2: Generate the secret and set it on both sides.**

```bash
openssl rand -hex 32
npx convex env set CONVEX_SERVER_SECRET <value>
```

  Add `CONVEX_SERVER_SECRET=<value>` to `.env.local`, and `CONVEX_SERVER_SECRET=` to
  `.env.local.example`. Add `CONVEX_SERVER_SECRET: z.string().min(32)` to the schema in
  `lib/env.ts`. The secret must be set on Convex **before** step 4 deploys, or the webhook starts
  failing.

- [ ] **Step 3: Write the helper.** `convex/lib/serverSecret.ts`:

```ts
import { ConvexError } from "convex/values";

/**
 * Gate for functions only our Next.js server may call (MOS-87).
 *
 * Public Convex functions are reachable by anyone holding NEXT_PUBLIC_CONVEX_URL,
 * so "only the webhook calls this" is not a protection. The server passes a
 * secret shared through the CONVEX_SERVER_SECRET env var on both sides.
 */
export function assertServerSecret(secret: string): void {
  const expected = process.env.CONVEX_SERVER_SECRET;
  if (!expected || secret !== expected) {
    throw new ConvexError({ code: "FORBIDDEN", message: "Server-only function." });
  }
}
```

- [ ] **Step 4: Gate the three functions.** In `convex/users.ts`, add `serverSecret: v.string()`
  to each function's `args`. Make `assertServerSecret(args.serverSecret)` the first line of each
  handler, and destructure `serverSecret` out before spreading `fields` in `updateSubscription`
  (`const { userId, serverSecret: _s, ...fields } = args;`) so the secret is never written to the
  row.

- [ ] **Step 5: Pass the secret from every caller.** Create `lib/convexServer.ts`:

```ts
/** The shared secret for server-only Convex functions (MOS-87). Server code only. */
export function serverSecret(): string {
  const s = process.env.CONVEX_SERVER_SECRET;
  if (!s) throw new Error("CONVEX_SERVER_SECRET is not set");
  return s;
}
```

  Add `serverSecret: serverSecret()` to every `getUserByClerkId`, `getUserByStripeCustomerId`
  and `updateSubscription` call in the seven routes listed above. To find them all:
  `grep -rn 'getUserByClerkId\|getUserByStripeCustomerId\|updateSubscription' app lib`.

- [ ] **Step 6: Verify.** Both `tsc` runs are clean. Re-run the step 1 `curl`: expected, an
  error for the missing `serverSecret` argument. Add `"serverSecret":"wrong"` to the args:
  expected, `FORBIDDEN`. Then, in the signed-in app, open Settings → Account &
  Billing and use **Manage billing** (portal route) on a subscribed test account. Expected: it
  still opens Stripe.

- [ ] **Step 7: Commit.** `fix(billing): gate server-only user functions behind a shared secret (MOS-87)`

---

## Task 2: New accounts start as `free`, existing `trial` rows migrated (MOS-28, deploy 1 of 2)

**Problem.** `createUser` inserts `status: "trial"` with a 14-day `trialEndsAt`. There's no
trial in the product. The status is inert (tier comes from `plan`), but it's wrong in the data
and in the admin table.

**Decision.** Add a `"free"` status meaning "has never subscribed". A subscription that ends
still goes to `"expired"` (the webhook is unchanged). `trialEndsAt`, `isTrialing` and
`trialDaysRemaining` go in Task 3.

**Files:**
- Modify: `convex/schema.ts` (users.subscription.status union, around line 497)
- Modify: `convex/users.ts` (`createUser` around line 138, `updateSubscription` status validator)
- Modify: `types/index.ts:5` (`SubscriptionStatus`)
- Modify: `app/contexts/AppStateProvider.tsx:177` (fallback `"trial"` → `"free"`)
- Modify: `convex/migrations.ts` (new internal mutation)

- [ ] **Step 1: Back up.** `npx convex export --path backups/2026-09-28-pre-phase-38.zip`

- [ ] **Step 2: Widen the status.** Add `v.literal("free")` to the union in `schema.ts` and in
  `updateSubscription`'s `status` validator. Keep `"trial"` for now. Add `"free"` to
  `SubscriptionStatus` in `types/index.ts`.

- [ ] **Step 3: New accounts are free.** In `createUser`, delete the `trialEndsAt` line and write:

```ts
      subscription: {
        status: "free",
      },
```

  In `AppStateProvider.tsx`, change `accessData?.status ?? "trial"` to `?? "free"`.

- [ ] **Step 4: The migration.** Append to `convex/migrations.ts`:

```ts
/**
 * MOS-28: the template's 14-day "trial" was never a real state (tier comes from
 * `plan`, so trial accounts already behaved as Free). Rewrite every trial row to
 * the Free status and drop its trialEndsAt. Idempotent; safe to re-run.
 * Run: npx convex run migrations:clearTrialStatus
 */
export const clearTrialStatus = internalMutation({
  args: {},
  handler: async (ctx) => {
    let changed = 0;
    for await (const user of ctx.db.query("users")) {
      if (user.subscription.status !== "trial") continue;
      const { trialEndsAt: _drop, ...rest } = user.subscription;
      await ctx.db.patch(user._id, { subscription: { ...rest, status: "free" } });
      changed++;
    }
    return { changed };
  },
});
```

  (The users table is small: MVP users are in the MVP deployment, not this one. If it ever grows
  past a few thousand rows, page it like `backfillSequenceSentenceText`.)

- [ ] **Step 5: Run it and verify.** After `convex dev` pushes: `npx convex run migrations:clearTrialStatus`
  → `{ changed: N }`. Run it a second time → `{ changed: 0 }`. Sign up a fresh test account and
  check its row in the Convex dashboard: `status: "free"`, no `trialEndsAt`. It can use the app
  as Free.

- [ ] **Step 6: Commit.** `fix(billing): new accounts start as free, migrate trial rows (MOS-28)`

---

## Task 3: Remove `trial` everywhere (MOS-28, deploy 2 of 2)

Only after Task 2's migration reports `changed: 0` on a re-run.

**Files:**
- Modify: `convex/schema.ts` (drop `v.literal("trial")` and `trialEndsAt`)
- Modify: `convex/users.ts` (drop `"trial"` and `trialEndsAt` from `updateSubscription`; in
  `getMyAccess` drop `trialEndsAt` from the destructure, and delete `isTrialing`,
  `trialDaysRemaining` and both return fields)
- Modify: `types/index.ts:5`
- Modify: `app/components/admin/sections/UsersAdminTable.tsx` (filter option around line 111,
  doc comment at lines 42–44)
- Modify: `app/api/stripe/webhook/route.ts:136` (comment says "trial extension")
- Modify: comments in `convex/admin/overviewStats.ts:16-17`, `app/(admin)/admin/page.tsx:16-17`,
  `app/components/admin/modals/GrantCustomAccessModal.tsx:35` (they refer to a "No-Trial
  callout" in an old plan; reword to "this build has no trial (MOS-28)")

- [ ] **Step 1: Check nothing reads the removed fields.**
  `grep -rn 'isTrialing\|trialDaysRemaining\|trialEndsAt\|"trial"' app lib convex types --include='*.ts' --include='*.tsx' | grep -v _generated | grep -v symbols_backups`
  Expected: only the lines this task edits. `constants.ts:20`, "Partner / school trial", is a
  custom-access *reason* label, not a status. Leave it.

- [ ] **Step 2: Narrow.** Remove the literal, the field and the computed values listed above. In
  `UsersAdminTable.tsx`, replace `<option value="trial">Free (legacy)</option>` with
  `<option value="free">Free</option>`, and change the `StatusFilter` type to match. Admin UI is
  English-only by convention (the neighbouring options are hard-coded), so no message keys.

- [ ] **Step 3: Verify.** Both `tsc` runs are clean. `convex dev` accepts the schema. If it
  rejects the schema, a trial row is left: re-run Task 2 step 5. Open `/admin` → Users and filter
  by Free: the migrated accounts show.

- [ ] **Step 4: Commit.** `fix(billing): drop the trial status and its fields (MOS-28)`

---

## Task 4: Stripe routes report real errors (MOS-29)

**Problem.** None of the five Stripe routes (`checkout`, `portal`, `switch-plan`, `reactivate`,
`cancel`) catches Stripe errors, so every failure becomes a bare 500 and the panel shows
"Something went wrong". The real error (such as `resource_missing: No such price`) is lost.
`checkout` and `switch-plan` also trust `tier` and `plan` from the request body without checking
them.

**Files:**
- Create: `lib/stripeErrors.ts`
- Modify: the five route files under `app/api/stripe/`
- Modify: `app/components/app/settings/sections/AccountBillingPanel.tsx` (the error branch
  around lines 262–281)
- Modify: `messages/en.json` (`plan` namespace: two new keys)
- Create: `scripts/check-stripe-prices.mjs`

**Interfaces:**
- Produces: `stripeErrorResponse(route: string, err: unknown): NextResponse`, which returns
  `{ error: "billing_misconfigured" }` (status 500) or `{ error: "payment_problem" }` (status 402)
  or `{ error: "unknown" }` (status 500), and logs the full detail server-side.
- Produces: `isPriceTier(x): x is PriceTier` and `isPricePlan(x): x is PricePlan` in `lib/stripe.ts`.

- [ ] **Step 1: Reproduce the failure.** In `.env.local`, temporarily set
  `STRIPE_PRO_MONTHLY_PRICE_ID=price_doesnotexist` (`next dev` reloads `.env.local` on save; if
  the terminal doesn't log "Reload env", ask the owner to restart the dev server). Click **Start Pro** (monthly) as a Free test account. Expected before the fix: generic toast,
  and the terminal shows an unhandled error with no Stripe code attached.

- [ ] **Step 2: The helper.** `lib/stripeErrors.ts`:

```ts
import { NextResponse } from "next/server";
import Stripe from "stripe";

/**
 * One place that turns a thrown Stripe error into a safe client response
 * (MOS-29). The full type/code/message goes to the server log, never the client.
 *
 * - Our config is wrong (bad price ID, bad key, wrong account): "billing_misconfigured".
 * - The customer's card or bank said no: "payment_problem".
 * - Anything else: "unknown".
 */
export function stripeErrorResponse(route: string, err: unknown): NextResponse {
  if (err instanceof Stripe.errors.StripeError) {
    console.error(`[stripe:${route}]`, {
      type: err.type,
      code: err.code,
      message: err.message,
      requestId: err.requestId,
    });
    if (err instanceof Stripe.errors.StripeCardError) {
      return NextResponse.json({ error: "payment_problem" }, { status: 402 });
    }
    if (
      err instanceof Stripe.errors.StripeInvalidRequestError ||
      err instanceof Stripe.errors.StripeAuthenticationError ||
      err instanceof Stripe.errors.StripePermissionError
    ) {
      return NextResponse.json({ error: "billing_misconfigured" }, { status: 500 });
    }
  } else {
    console.error(`[stripe:${route}]`, err);
  }
  return NextResponse.json({ error: "unknown" }, { status: 500 });
}
```

  Check that the class names exist in `node_modules/stripe/types/Errors.d.ts` before relying on
  them. If `StripeCardError` has another name in v22, use the name that's there.

- [ ] **Step 3: Validate input.** In `lib/stripe.ts`:

```ts
export function isPriceTier(x: unknown): x is PriceTier {
  return x === "pro" || x === "max";
}
export function isPricePlan(x: unknown): x is PricePlan {
  return x === "monthly" || x === "yearly";
}
```

  In `checkout` and `switch-plan`, replace the body cast with a check that returns
  `{ error: "tier and plan are required" }` (status 400) unless both guards pass. Also wrap
  `request.json()` in its own try/catch and return 400 on a bad body.

- [ ] **Step 4: Wrap every Stripe call.** In each of the five routes, put the Stripe call(s) and
  the response in `try { … } catch (err) { return stripeErrorResponse("<route>", err); }`. Keep
  the auth and user-lookup code outside the try, because it already returns its own 4xx.

- [ ] **Step 5: Tell the user the right thing.** Add to `en.json` under `plan`:

```json
    "errorMisconfigured": "Payments aren't available right now. We've been notified. Please try again later.",
    "errorPaymentProblem": "Your payment didn't go through. Please check your card details and try again."
```

  In `AccountBillingPanel.tsx`, where the panel reads a non-OK response, parse
  `{ error }` and pick `t("errorMisconfigured")` for `billing_misconfigured`,
  `t("errorPaymentProblem")` for `payment_problem`, and otherwise the existing
  `t("errorGeneric")`.

- [ ] **Step 6: A price health check.** `scripts/check-stripe-prices.mjs`: load the four
  `STRIPE_*_PRICE_ID` env vars, call `stripe.prices.retrieve` for each with the current
  `STRIPE_SECRET_KEY`, and print one line per price: ID, `unit_amount` / 100, `currency`,
  `recurring.interval`, `active`, and whether its interval matches the env var name (monthly vs
  yearly). Exit 1 if any price is missing, inactive or the wrong interval. Run it with
  `node --env-file=.env.local scripts/check-stripe-prices.mjs`. Add a short "Stripe price check"
  section to CLAUDE.md, straight after "Backups": run this after any Stripe key or account change.

- [ ] **Step 7: Verify.** With the bad price ID from step 1: the toast now says payments aren't
  available, and the terminal logs `[stripe:checkout] { type: 'invalid_request_error', code:
  'resource_missing', … }`. The health check script exits 1 and names the bad variable. Put the
  real ID back: checkout opens, and the script exits 0. Declines inside Stripe's hosted Checkout
  page never reach our routes, so `payment_problem` only matters for `switch-plan`. To check it,
  attach test card `4000 0000 0000 0341` (it attaches, then declines on charge) to a subscribed
  test customer in the portal, then switch plan.

- [ ] **Step 8: Commit.** `fix(billing): surface Stripe errors from all five routes, validate tier/plan, add price health check (MOS-29)`

---

## Task 5: Upload and My Images become Max (MOS-49)

**Problem.** FEAT-108 puts everything outside SymbolStix on Max. Today Upload and My Images work
on any plan that can edit. Upload has **no** server tier check at all (`upload-asset` only checks
sign-in), and the symbol editor opens on the Upload tab by default.

**Files:**
- Modify: `app/api/upload-asset/route.ts`
- Modify: `convex/accountImages.ts` (`record`)
- Modify: `app/components/app/shared/modals/symbol-editor/UploadTab.tsx`
- Modify: `app/components/app/shared/modals/symbol-editor/MyImagesTab.tsx`
- Modify: `app/components/app/shared/modals/symbol-editor/ImagesTab.tsx:57`,
  `AiGenerateTab.tsx:68` (the same `isMax` expression)
- Modify: `app/components/app/shared/modals/symbol-editor/SymbolEditorModal.tsx` (default tab,
  lines ~306 and ~318)
- Modify: `messages/en.json` (`symbolEditor`: four new keys)

**Interfaces:**
- Consumes: `effectiveUserTier(user)` from `convex/lib/access.ts`.
- Consumes: `api.users.getMyAccess` returns `{ accountId, tier, hasFullAccess, customAccess, … }`
  (after Task 3, no trial fields).

- [ ] **Step 1: Server, upload route.** In `upload-asset/route.ts`, replace the
  `getUserByClerkId` lookup (Task 1 gave it a secret) with `api.users.getMyAccess`, which the
  route can call with the Clerk token it already has. Use `access.accountId` in the allowed-key
  regex (`^accounts/${access.accountId}/(images|audio)/[^/]+$`). That also resolves a
  collaborator to the host account, which fixes the first item of MOS-53. Then gate by folder:

```ts
  const isImage = key.startsWith(`accounts/${access.accountId}/images/`);
  // `tier` alone isn't enough: getMyAccess derives it from the plan whatever the
  // status, so a lapsed Max still reads "max". hasFullAccess folds in billing
  // status and custom grants (which getMyAccess already lifts to tier "max").
  const isMax = access.tier === "max" && access.hasFullAccess;
  if (isImage && !isMax) {
    return NextResponse.json({ error: "max_tier_required" }, { status: 403 });
  }
  if (!isImage && !access.hasFullAccess) {
    // audio recording is a Pro feature (FEAT-108)
    return NextResponse.json({ error: "pro_tier_required" }, { status: 403 });
  }
```

- [ ] **Step 2: Server, library record.** In `convex/accountImages.ts`, `record` (the public
  mutation that adds an upload or Image Search pick to My Images) throws
  `ConvexError({ code: "TIER_REQUIRED", required: "max", message: "My Images is a Max feature." })`
  when `effectiveUserTier(user) !== "max"`. Leave `listMine`, `usageCount` and `deleteIfUnused`
  open: after a downgrade, the account's own pictures stay on its boards (FEAT-108 "Downgrading
  keeps content").

- [ ] **Step 3: Client lock panels.** Add to `en.json` under `symbolEditor`:

```json
    "uploadUpsellTitle": "Upload is a Max feature",
    "uploadUpsellBody": "Use your own photos and pictures on any symbol. Upgrade to Max in Settings → Account & Billing.",
    "myImagesUpsellTitle": "My Images is a Max feature",
    "myImagesUpsellBody": "Keep every picture you've uploaded, found or generated in one place. Upgrade to Max in Settings → Account & Billing."
```

  In `UploadTab.tsx` and `MyImagesTab.tsx`, read `useAppState().subscription` and return the same
  lock panel `ImagesTab.tsx:184-203` renders (Lock icon, title, body, the same tokens) unless
  `subscription.tier === "max" && subscription.hasFullAccess` (same reason as step 1; the
  existing `ImagesTab`/`AiGenerateTab` `isMax` checks have the lapsed-Max gap too, so fix all four
  tabs to this one expression). In `MyImagesTab`, pass `"skip"` to `usePaginatedQuery` and
  `useQuery` while locked, so a Pro user doesn't run the library query. That's the second MOS-53
  item, for non-Max users.

- [ ] **Step 4: Default tab.** In `SymbolEditorModal.tsx`, the fallback `'upload'` at ~306 and
  ~318 becomes `'symbolstix'` when the user isn't Max (read `subscription.tier` from
  `useAppState()` near the other hooks). A stored `initialImageSourceType` still wins, so
  re-editing an uploaded symbol still opens on Upload, where a Pro user sees the lock panel and
  the current picture stays in the preview.

- [ ] **Step 5: Verify (Claude in Chrome).** Pro test account: open the symbol editor on a new
  symbol. It opens on SymbolStix. The Upload and My Images tabs show their lock panels. Saving a
  SymbolStix symbol still works. Recording audio in `AudioAuthorModal` still works (audio path).
  Re-edit a symbol that already has an uploaded picture: it opens on Upload, locked, and the
  preview still shows the picture. Max test account: upload works, and the picture appears in My
  Images. From the console as the Pro account, `fetch('/api/upload-asset', …)` with an `images/`
  key returns 403.

- [ ] **Step 6: Commit.** `feat(billing): Upload and My Images are Max (MOS-49)`

---

## Task 6: Module installs check tier rank, and Instruments and Clothes move to Max (MOS-49)

**Problem.** `assertModuleInstallable` (`convex/lib/contentModuleInstall.ts:72-79`) allows any
non-free module for any paid account (`hasFullAccess`), so a Pro account can install a Max module
through the API. The library button (`InstallModuleButton.tsx:140-143`) already checks the rank
correctly, so only the server is wrong.

**Files:**
- Modify: `convex/lib/contentModuleInstall.ts`
- Modify: `convex/contentModules/categories.ts`, `lists.ts`, `sentences.ts`, `phrases.ts` (each
  caller of `assertModuleInstallable`)
- Modify: `convex/data/categories/instruments.json:103`, `convex/data/categories/clothes.json:5`
- Modify: `convex/migrations.ts` (a one-off internal mutation)

**Interfaces:**
- Changes: `assertModuleInstallable` swaps `hasFullAccess: boolean` for
  `userTier: "free" | "pro" | "max"`.

- [ ] **Step 1: Rank, not "paid".** In `contentModuleInstall.ts`:

```ts
const TIER_RANK = { free: 0, pro: 1, max: 2 } as const;
```

  Replace the `hasFullAccess` option with `userTier: "free" | "pro" | "max"`, and the check with
  `if (TIER_RANK[userTier] < TIER_RANK[effectiveTier]) throw …` (same `TIER_REQUIRED` error, with
  message `"This module needs the ${effectiveTier} plan."`). Update the doc comment. In the four
  callers, pass `userTier: effectiveUserTier(user)` in place of
  `hasFullAccess: userHasFullAccess(user)`, and drop the now-unused import if nothing else in the
  file uses it.

- [ ] **Step 2: Move the two modules.** Set `"defaultTier": "max"` in both JSON files, so a
  re-seed agrees. Add to `migrations.ts`:

```ts
/**
 * MOS-49: Instruments (Image Search pictures) and Clothes (uploads) aren't
 * SymbolStix-only, so they leave the Free class for Max.
 * Run: npx convex run migrations:setCategoryModuleDefaultTier '{"slug":"instruments","tier":"max"}'
 */
export const setCategoryModuleDefaultTier = internalMutation({
  args: {
    slug: v.string(),
    tier: v.union(v.literal("free"), v.literal("pro"), v.literal("max")),
  },
  handler: async (ctx, { slug, tier }) => {
    const row = await ctx.db
      .query("libraryModules")
      .withIndex("by_tree_and_slug", (q) => q.eq("tree", "categories").eq("slug", slug))
      .unique();
    if (!row) throw new Error(`No category module "${slug}"`);
    await ctx.db.patch(row._id, { defaultTier: tier, updatedAt: Date.now() });
    return { slug, from: row.defaultTier, to: tier, tierOverride: row.tierOverride ?? null };
  },
});
```

  Run it for `instruments` and for `clothes`. If either reports a non-null `tierOverride`, stop
  and tell the owner, because an override would beat the new default.

- [ ] **Step 3: Verify.** Library as a Free test account: Instruments and Clothes show the Max
  badge and **Upgrade to load**. As Pro: still **Upgrade to load**. As Max: they install. From the
  console as Pro, calling the categories install mutation for `instruments` throws
  `TIER_REQUIRED`. A Free or Pro account that installed either module before keeps it (nothing
  is uninstalled).

- [ ] **Step 4: Commit.** `feat(billing): module installs compare tier rank; Instruments and Clothes are Max (MOS-49)`

---

## Task 7: Prices and plan copy match FEAT-108 (MOS-49)

**Files:**
- Modify: `messages/en.json` (`plan` namespace, lines ~623–673; pricing namespace, lines
  ~1075–1130), `messages/es.json`, `messages/hi.json`, `messages/pa.json` (delete retired keys)
- Modify: `app/components/app/settings/sections/AccountBillingPanel.tsx:434-452`
- Modify: `app/components/marketing/sections/PricingPageContent.tsx`
- Stripe test account: four new prices

- [ ] **Step 1: New test prices.** In the current Stripe **test** account, add prices to the
  existing Pro and Max products: Pro £13.99 / month, Pro £134 / year, Max £18.99 / month, Max
  £182 / year. Archive the old four. (The owner does this in the dashboard, or Claude does it with
  `stripe prices create` after the owner confirms.) Put the new IDs in `.env.local`, then run
  `node --env-file=.env.local scripts/check-stripe-prices.mjs` from Task 4. Expected: 4 OK lines
  with the right amounts.

- [ ] **Step 2: Rewrite the copy under new keys.** Everything changes meaning, so every price and
  feature key is new, and the old ones are deleted from all four locale files. In `plan`:

```json
    "freeFeatureUse": "Tap and play every default board",
    "freeFeatureSearch": "Search all of SymbolStix by typing or voice",
    "freeFeatureTalker": "Build sentences in the talker",
    "freeFeatureModules": "Free modules from the resource library",
    "proPerMonth": "£13.99",
    "proPerYear": "£134",
    "proFeatureEverythingFree": "Everything in Free",
    "proFeatureEdit": "Save, edit and create with any SymbolStix symbol",
    "proFeatureModelling": "Modelling mode",
    "proFeatureAudio": "Record your own audio",
    "proFeatureLanguages": "A language per student",
    "proFeatureModules": "Pro modules",
    "maxPerMonth": "£18.99",
    "maxPerYear": "£182",
    "maxFeatureEverythingPro": "Everything in Pro",
    "maxFeatureImages": "Upload, Image Search, AI pictures and My Images",
    "maxFeatureTones": "Expressive tones",
    "maxFeatureThemes": "Premium themes",
    "maxFeatureInvites": "Family invites",
    "maxFeatureModules": "Max modules"
```

  Retire `freeFeature0-3`, `proMonthlyPrice`, `proYearlyPrice`, `proFeature0-4`, `maxMonthlyPrice`,
  `maxYearlyPrice`, `maxFeature0-4`. Keep `save20` (still true). Update
  `AccountBillingPanel.tsx:434-452` to the new keys.

  Do the same for the public pricing namespace (the one `PricingPageContent.tsx` passes to
  `useTranslations`; its price keys are `proPriceMonthly` etc., so name the new ones differently
  there too): new `freeDesc`/`proDesc`/`maxDesc` keys written
  from FEAT-108's "The idea" (use it / shape it / go beyond it), new price keys, new feature keys,
  and a comparison table with one row per FEAT-108 line. **Delete** "Unlimited student profiles"
  and "Mo Speech School connection" (not in FEAT-108). Show the draft copy to the owner before
  committing: this is public copy.

- [ ] **Step 3: Delete retired keys from every locale.** For each retired key, remove it from
  `en.json`, `es.json`, `hi.json` and `pa.json`. Then check nothing still references it:
  `grep -rn '<key>' app` for each. The next `translate-ui-strings` run fills the new keys in the
  other languages.

- [ ] **Step 4: Verify (Claude in Chrome).** Settings → Account & Billing on Free, Pro and Max
  test accounts: prices £13.99 / £18.99 monthly and £134 / £182 yearly, and the features match
  FEAT-108. Start Max (yearly) as Free: Checkout shows £182.00. `/en/pricing` (signed out): the
  same numbers and lists. Switch to `/hi/pricing`: new keys show in English until the translation
  run, and no stale "£9.99" anywhere.

- [ ] **Step 5: Commit.** `feat(billing): three-tier prices and plan copy from FEAT-108 (MOS-49)`

---

## Task 8: Checkout ready for Managed Payments (MOS-59, the part that doesn't need the Ltd)

**Files:**
- Modify: `app/api/stripe/checkout/route.ts`
- Modify: `lib/env.ts`, `.env.local.example`

- [ ] **Step 1: Check the SDK knows the parameter.**
  `grep -rn "managed_payments" node_modules/stripe/types | head`. If it's there, use it typed. If
  it isn't, **stop and report**: don't add an untyped cast without the owner agreeing, because it
  may mean the SDK needs a bump.

- [ ] **Step 2: Remove the incompatible parameter.** Delete `payment_method_types: ["card"]` from
  the Checkout Session. It's the only one of ADR-025's incompatible parameters this route sets.
  Leaving it out lets Stripe choose methods (UPI for India under Managed Payments; cards and
  wallets now).

- [ ] **Step 3: The flag, off by default.**

```ts
const managedPayments = process.env.STRIPE_MANAGED_PAYMENTS === "true";
// …
    ...(managedPayments ? { managed_payments: { enabled: true } } : {}),
```

  Add `STRIPE_MANAGED_PAYMENTS: z.enum(["true", "false"]).optional()` to `lib/env.ts` and
  `STRIPE_MANAGED_PAYMENTS=false` to `.env.local.example`, with a comment pointing to ADR-025.

- [ ] **Step 4: Verify.** With the flag unset, checkout works exactly as before in the test
  account. If the test account allows Managed Payments (the owner asks Stripe, per MOS-59's "Before
  building" list), set the flag to `true` and run one checkout. The webhook should still set the
  plan. If Stripe refuses in test mode, record that on MOS-59 and leave the flag off.

- [ ] **Step 5: Commit.** `feat(billing): checkout ready for Stripe Managed Payments behind a flag (MOS-59)`

  Then comment on MOS-59 with what remains for the Ltd: account on the Ltd, `tax_code`
  (`txcd_10103000`) on both products, live prices at the Task 7 amounts, the flag on, a real
  end-to-end purchase, and `check-stripe-prices` against live keys.

---

## Task 9: Docs and close-out

- [ ] FEAT-108: update the status callout and the "What the build still needs" table. Every row is
  done except Checkout, which waits for MOS-59. Set the yearly prices to £134 and £182.
- [ ] FEAT-203 (symbol editor): Upload and My Images are Max. The editor opens on SymbolStix for
  non-Max accounts.
- [ ] FEAT-107 (resource library): Instruments and Clothes are Max. A Free module is
  SymbolStix-only.
- [ ] `docs/01-final-straight.md` M2: mark MOS-87, MOS-28, MOS-29 and MOS-49 done, note the MOS-59
  remainder, and add MOS-87 to the M2 row of the housekeeping table.
- [ ] MOS-53: comment that both items were fixed here (upload route resolves the host account;
  My Images query is skipped when locked). The "skip until first opened" half for Max users is
  still open.
- [ ] Changelog `docs/4-builds/changelog/2026-MM-DD-billing-truth.md`.
- [ ] Move this plan to `docs/4-builds/plans/_done/`.
- [ ] Linear: fix the MOS-59 → MOS-29 "blocks" link (MOS-29 shipped first), and move the done
  tickets to Done.
