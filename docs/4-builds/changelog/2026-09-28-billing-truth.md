# 2026-09-28: Billing truth

**Milestone:** M2 Billing truth (Final straight project) · **Issues:** MOS-87, MOS-28, MOS-29, MOS-49, MOS-59 (part)
**Spec:** [FEAT-108](../features/FEAT-108-pricing-and-tiers.md) · [FEAT-203](../features/FEAT-203-symbol-editor.md) · [FEAT-107](../features/FEAT-107-resource-library.md) · **Plan:** [phase-38-billing-truth-plan](../plans/phase-38-billing-truth-plan.md) · **Decisions:** [ADR-025](../decisions/ADR-025-stripe-managed-payments-mor.md)

Closed the gap between the owner's three-tier pricing decision (2026-09-26) and what the app
actually did, and locked down the billing functions that set a plan directly. Built and on `main`;
awaiting the owner's browser and webhook verification before it counts as shipped.

- **MOS-87**: the Convex functions that write a plan or subscription status directly are now
  gated behind a shared server secret, so only the app's own server routes can call them.
  `devSetTier` (the dev-only tier switcher) was made `internal`, closing the same hole a first
  round of review had missed.
- **MOS-28**: no trial. New accounts are created already in the free state, and the trial status
  and its fields are gone from the schema. Both existing accounts turned out to carry a stale
  `trialEndsAt` left over from before the schema change (the first migration pass only handled
  rows still in `status: "trial"`; these two were already `"active"`). They were stripped by hand
  before the field was removed, so no row keeps a trial date that no longer means anything.
- **MOS-29**: all five Stripe routes (checkout, switch-plan, cancel, reactivate, portal) now log
  the real Stripe error server-side and return one of `billing_misconfigured`,
  `payment_problem` or `unknown` to the client, so the billing panel shows an accurate message
  instead of a generic failure. `scripts/check-stripe-prices.mjs` checks the configured price IDs
  are live, to catch a rotated key before a customer hits it.
- **MOS-49**: the three-tier model is built:
  - Upload and My Images are Max on both the server (`upload-asset`, `accountImages`) and the
    client (both tabs show the Max upsell panel below Max; My Images' library query is skipped
    entirely while locked).
  - Expired admin custom-access grants no longer unlock Max (imagen and both image-search routes
    now gate on the effective tier), and the lock panel no longer flashes unlocked content while
    access is loading.
  - Module installs now compare tier **rank** server-side, so a Pro account can't install a
    Max-tier module by calling the mutation directly (the library button already blocked it
    client-side).
  - The **Instruments** and **Clothes** resource-library modules are now Max (they used
    Image Search and uploaded pictures, not SymbolStix, so they couldn't stay Free under the
    SymbolStix-only rule).
  - Prices are Pro £13.99/mo · £134/yr and Max £18.99/mo · £182/yr, replacing the old
    £9.99/£79 and £14.99/£119. The plan copy in the billing panel and the public pricing page
    were rewritten from FEAT-108.
  - The symbol editor's default tab for a brand-new symbol was **not** changed. The plan's step
    to do so was withdrawn once the implementer confirmed new symbols already open on SymbolStix,
    and that a stored `'upload'` value is provenance, not a stale default.
- **MOS-59 (part)**: Checkout can request Stripe Managed Payments behind a
  `STRIPE_MANAGED_PAYMENTS` flag (off by default). With the flag on, Managed Payments picks the
  payment methods per country; with it off, Checkout offers cards only (see the fix round below).
  The Stripe **test** account already accepts Managed Payments sessions. The actual cut-over,
  turning the flag on against the Ltd's live account, waits on MOS-58 (incorporation) per
  [ADR-025](../decisions/ADR-025-stripe-managed-payments-mor.md).

**New, open: MOS-88.** While fixing MOS-49's gates, every one of them (`getMyAccess`,
`requireProTier`, the image record/upload routes) turned out to read the **calling** user's own
plan, not the host account's. A Family-invited collaborator signed in on their own Free account
under a Max host therefore can't edit, upload or record: the invite doesn't unlock anything for
them. Not a regression from this work, but not what FEAT-106/FEAT-108 describe either. Filed as
MOS-88 and added to M2.

## Whole-phase review fix round

A review of the whole phase found a few more holes and some drift. Fixed on `main`:

- **Public user-data functions locked (MOS-87).** `users.getUserById` now requires an admin
  caller. `users.listAllUsers` was deleted: nothing used it and anyone could call it to list every
  user. `users.updateLastActive` now finds the caller from their sign-in instead of trusting a
  user ID sent by the browser, and does nothing when signed out.
- **One Max rule (MOS-49).** Expressive TTS tones and family invites now use the same rule as
  imagen and image-search: the effective tier must be Max. Before, tones also let through a
  custom-access grant that had expired, and invites read the stored plan name, so an expired or
  unpaid Max plan could still invite.
- **Honest webhook statuses (MOS-49).**
  - A Stripe price the app doesn't recognise is logged and leaves the stored plan alone. It used
    to be recorded as Pro monthly, which could silently change someone's tier.
  - Subscription updates now map every Stripe status: active and trialing unlock; past due and
    unpaid become past due; incomplete, expired, cancelled and paused become expired. Before,
    anything unrecognised was treated as active.
  - A completed Checkout only activates the plan when the payment has actually gone through (or
    none was needed). Otherwise it waits for the subscription events that follow.
- **Cards only while Managed Payments is off (MOS-59).** Delayed methods such as Bacs or SEPA
  aren't offered until the webhook can handle a payment that settles later.
- **Tidy-ups.** The dev tier switcher's "free" setting now writes the free status, and
  `.env.local.example` names the Max price ID variables the code actually reads.

**New tickets from the review:**

- **MOS-90 (M2)**: invite takeover via `createUser`. The sign-up mutation takes the Clerk user ID
  and email from the browser and activates any pending invite for that email, so someone could
  claim another person's invite. Needs to read identity from the sign-in token instead.
- **MOS-91 (M5)**: client-side gates read the stored plan tier rather than the effective tier, so
  the UI can disagree with the server after a plan expires.

**Files:** `convex/users.ts`, `convex/accountImages.ts`, `convex/accountMembers.ts`,
`convex/lib/contentModuleInstall.ts`, `convex/lib/serverSecret.ts`, `convex/contentModules/*.ts`,
`convex/data/categories/{instruments,clothes}.json`, `convex/admin/overviewStats.ts`,
`convex/migrations.ts`, `convex/schema.ts`, `app/api/stripe/*/route.ts`,
`app/api/upload-asset/route.ts`, `app/api/ai-generate/imagen/route.ts`,
`app/api/image-search/{search,proxy}/route.ts`, `app/api/tts/route.ts`,
`app/api/delete-account/route.ts`,
`app/components/app/shared/modals/symbol-editor/{UploadTab,MyImagesTab,MaxLockPanel,ImagesTab,AiGenerateTab}.tsx`,
`app/components/app/settings/sections/AccountBillingPanel.tsx`,
`app/components/marketing/sections/PricingPageContent.tsx`,
`app/components/admin/{modals/GrantCustomAccessModal,sections/UsersAdminTable}.tsx`,
`app/contexts/AppStateProvider.tsx`, `lib/{stripe,stripeErrors,env,convexServer}.ts`,
`types/index.ts`, `messages/{en,es,hi}.json`, `.env.local.example`,
`scripts/check-stripe-prices.mjs`.

**Code review:** each ticket's commit was reviewed separately (see
`.superpowers/sdd/progress.md` for the per-task ledger); all Approved, with one fix round on
MOS-87 (the `devSetTier` hole) and one on MOS-49 (expired-grant leaks and the loading flash). A
whole-phase review then produced the fix round above. Minor deferred items (constant-time secret
comparison, an unused `env` export, duplicated tier/plan parsing across routes) are recorded in
the ledger, not fixed here.
