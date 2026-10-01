# Phase 42: continuation prompt for the rest of M2 (MOS-93, MOS-59)

Paste everything below the line into a new Claude Code session opened in this repo.

---

Let's finish **M2 Billing truth** in the Final straight project on Linear. This continues work from
earlier sessions, so start by reading:

1. `docs/01-final-straight.md` (the M2 section and its dated notes)
2. `docs/4-builds/features/FEAT-108-pricing-and-tiers.md` (the "Managing a plan" section and the
   "Changing plan" row of "What the build still needs")
3. `docs/4-builds/decisions/ADR-025-stripe-managed-payments-mor.md`
4. Linear **MOS-93** and **MOS-59**, including their comments
5. The last three changelogs in `docs/4-builds/changelog/` (2026-09-28, 2026-09-29, 2026-09-30)

## Where M2 stands (2026-10-01)

Done and verified: MOS-87, MOS-28, MOS-29, MOS-49, MOS-90, MOS-92, MOS-88, MOS-94. Their plans are
in `docs/4-builds/plans/_done/` (phase-38, phase-39, phase-40).

Still open in M2:

- **MOS-93 (next, code):** plan switches are wrong both ways. `app/api/stripe/switch-plan/route.ts`
  uses `proration_behavior: "none"`, and the webhook applies the new plan at once. So an upgrade
  unlocks Max without charging, and a downgrade removes features immediately, although FEAT-108 and
  the toast promise "at your next billing date". Wanted: upgrades charge the prorated difference
  now; downgrades and monthly/yearly switches wait for the end of the billing period.
- **MOS-59 (waits on me):** the Stripe Managed Payments steps that need the Ltd. The code side is
  ready behind `STRIPE_MANAGED_PAYMENTS` (off). The remaining steps are listed in a comment on
  MOS-59.
- **MOS-57 and MOS-58** are my business tickets (IP side letter, incorporating the Ltd). Don't plan
  code that needs the Ltd's Stripe account.

**First thing to find out for MOS-93:** whether Stripe **Managed Payments** supports subscription
schedules and prorated upgrade invoices. The current test account accepts
`managed_payments: { enabled: true }` on Checkout Sessions, so try it there in test mode. If
schedules aren't supported, the fallback is to store the pending change on the user and apply it on
the renewal webhook. Tell me what you find before writing the plan.

## One decision waiting on me

The daily AI picture allowance is per person (`featureQuota` is keyed on the signed-in identity).
Since phase-40, each carer in a Max family gets their own allowance, at about $0.04 a picture.
Ask me whether it should be shared across the family or stay per person. If shared, it can ride
along with MOS-93 or get its own small ticket.

## How we've been working (keep doing this)

- **Work on `main`.** One commit per task, ticket ID in the subject. Nothing is pushed unless I
  ask. `main` is about 11 commits ahead of `origin`.
- **Plan first, then build with one subagent per task and a review after each**
  (superpowers `writing-plans`, then `subagent-driven-development`). The next plan number is
  **phase-43** (phase-41 is the device lock spec, phase-42 is this file). Put it in
  `docs/4-builds/plans/`, and move it to `_done/` when the work is verified.
- **Never run `npm run dev`, `npx convex dev` or `stripe listen`.** I run them. The dev server is
  on port 3000, and `convex dev` auto-pushes `convex/` edits on save.
- **There's no test runner.** Each task proves itself with before and after checks:
  - `npx convex run <fn> '<args>' --identity '{"subject":"<clerk id>"}'` runs a function as a
    specific user. Read-only probes against real accounts; writes only to test accounts.
  - `npx tsc --noEmit`, `npx tsc -p convex/tsconfig.json --noEmit` (0 errors) and `npm run lint`
    (baseline 63 problems: 34 errors, 29 warnings; add none).
  - `node --env-file=.env.local scripts/check-stripe-prices.mjs` after any Stripe price change.
- **Then verify in my Chrome** with the Claude in Chrome extension (not the in-app browser), with
  me doing any step that needs a sign-in or a card.
- **UI copy:** new keys in `messages/en.json` only. When English copy changes meaning, use a new
  key and delete the old one from every locale file.
- **Convex:** read `convex/_generated/ai/guidelines.md` first. Server-only functions take the
  shared secret (`convex/lib/serverSecret.ts`, `lib/convexServer.ts`). Plan checks read
  `planUser` from `resolveCallerAccountId` (the family owner's plan for a carer). Billing routes go
  through `lib/billingOwner.ts` (owner only).
- **Match thrown Convex errors with `.includes()`**, never `===`.
- **Explain findings in plain terms:** what it does to the working app, and whether it's
  recoverable.

## Test accounts (Stripe sandbox, dev Convex deployment)

| Account | Convex `users` id | Clerk subject | State |
|---|---|---|---|
| A, test | `j5761rg3dwe3r13bzj0s8j0xhd8fb81b` | `user_3JzdGwXIW79ALFbhhHE8ykSQCFG` | Pro (test subscription) |
| C, test family | `j57bvzrhe81eap0b73kk65tdw58fah5x` | `user_3Jzw6rc4xEnze31jmBwKGW9QkYU` | Max (test subscription), one student |
| Carer of C | `j571dsrsra33kxkz6hx3jjw5z18fdr54` | `user_3K2r1cfBKvEvZcj1DAd8N3Neib0` | Free, active member of C |
| B, my main account | `j5717je37k1h19ndtjn0bsgc49892p0v` | `user_3FRyegzhjxRy5uokPusWO4wcytY` | Max on an old archived price. **Read only: never write to it** |

Test prices: Pro £13.99 / £134, Max £18.99 / £182. A and C both have live test subscriptions, so
they're good subjects for upgrade and downgrade tests. Check the ids are still right with
`npx convex data users` before relying on them.

## Not part of this session

- **Phase-41, the device lock with a PIN (MOS-82, M5).** The spec is approved at
  `docs/4-builds/plans/phase-41-device-lock-SPEC.md`, and its plan is being written in another
  session. Don't touch `convex/studentViewLock.ts`, `convex/studentViewSessions.ts`,
  `app/contexts/ProfileContext.tsx` or the view switcher here.
- **MOS-91** (client gates read the plan tier, M5) and **MOS-95** (account switcher, post-launch).

Start by reading the files above, then show me MOS-93's current state in the code and what you
found about Managed Payments and schedules, and propose the plan.
