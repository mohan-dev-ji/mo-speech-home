# FEAT-108 · Pricing & tiers

**Layer 1 · Page** · [Back to the index](README.md)

> **Status:** the three-tier model below was decided by the owner on
> 2026-09-26, built on 2026-09-28 and verified in the browser and against
> Stripe's webhook events on 2026-09-29
> ([MOS-49](https://linear.app/mo-intelligence/issue/MOS-49)). Every row in
> [What the build still needs](#what-the-build-still-needs) is shipped except
> **Checkout**, which still runs on plain Stripe Checkout and waits for
> [MOS-59](https://linear.app/mo-intelligence/issue/MOS-59)'s remaining steps
> (the Ltd has to exist first). An invited carer now gets the family's plan
> ([MOS-88](https://linear.app/mo-intelligence/issue/MOS-88), verified
> 2026-09-30). Plan changes charge and start when
> [Managing a plan](#managing-a-plan) says they do
> ([MOS-93](https://linear.app/mo-intelligence/issue/MOS-93), verified
> 2026-10-02).

- Three plans: **Free**, **Pro** and **Max**
- **Free:** sign up with an email and use the SymbolStix symbols, tap and play
- **Pro:** make Mo Speech your own: save, edit and model, using the whole
  SymbolStix library
- **Max:** go beyond SymbolStix: your own photos, Image Search, AI pictures,
  plus expressive tones, premium themes and family invites
- Monthly or yearly billing
- Locked features say which plan they need, with a way to see plans
- Plans are managed in Settings → Account & Billing

---

## The idea

One line separates each plan:

- **Free** is for **using** Mo Speech.
- **Pro** is for **shaping** it, with SymbolStix.
- **Max** is for going **beyond** SymbolStix.

SymbolStix is a large professional symbol library, licensed for everyone on Mo
Speech. Free lets you use it. Pro lets you build with it. Max adds every
picture that isn't a SymbolStix symbol, plus the extras.

## The plans

### Free: £0

A free account needs only an email address. It never expires and isn't a
trial.

- The default boards every new account gets: categories, lists, sentences,
  core words and phrases, all SymbolStix.
- **Search** the whole SymbolStix library, by typing or by voice, and tap any
  symbol to hear it.
- Tap and play everything, and build sentences in the talker.
- **Free modules** from the resource library, added in one tap. Like
  everything on Free, they're SymbolStix-only, so they give more to explore
  and play with. That's the route in to Pro.
- One language across the app.
- The base colour themes.

Free can't save, edit, create or model. Anything that would change a board
shows the upgrade prompt instead.

### Pro: £13.99 a month

Everything in Free, plus:

- **Save, edit and create:** categories, lists, sentences, phrases and core
  words, from any SymbolStix symbol.
- **Save sentences from the talker.**
- **Record your own audio** for any symbol, step or sentence.
- **Modelling mode.**
- **A language per student**, with its own voice.
- **Pro modules** from the resource library.

### Max: £18.99 a month

Everything in Pro, plus everything outside the SymbolStix library:

- **Upload** your own photos and pictures.
- **Image Search:** Creative Commons photos, with credits handled for you.
- **AI Generate:** draw a picture that doesn't exist anywhere else, in one of
  four styles.
- **My Images:** the account's own image library.

And the extras:

- **Expressive tones:** play a sentence angry, neutral or excited.
- **Premium themes:** tiled and animated backgrounds.
- **Family invites:** share the account's students with carers and school.
- **Max modules** from the resource library.

## How plans show in the app

- **Locked actions** open an upgrade prompt instead of doing nothing. It says
  **Pro feature** or **Max feature**, explains what's included, and offers
  **See plans** or **Maybe later**. See plans opens Settings → Account &
  Billing.
- **Locked options** show as locked where they appear: premium themes in the
  theme picker, the Image Search and AI tabs in the symbol editor, and modules
  in the library, whose button says **Upgrade to load**.
- **The plan badge** in the app shows the current plan.

## Managing a plan

Everything happens in Settings → Account & Billing. See
[FEAT-106](FEAT-106-settings.md).

- Choose **monthly** or **yearly**. Yearly costs less.
- **Upgrade** (Pro to Max): starts straight away. The difference for the rest
  of the period already paid for is charged at once, and the new features
  unlock when that payment goes through.
- **Downgrade** (Max to Pro) or **switch between monthly and yearly:** starts
  at the next billing date. Nothing is charged and nothing changes until
  then. The new price is charged in full on that date.
- **A booked change shows on the page:** "Changing to Pro (monthly) on
  29 October 2026", with **Keep current plan** to undo it. The plan it will
  change to shows **Scheduled**.
- **Cancel:** the plan runs to the end of the period already paid for, and can
  be **reactivated** until then. Cancelling drops a booked change.
- There are no refunds.

## Why it helps

- **Families can start for nothing.** A child can be using real AAC today, with
  no card and no trial clock.
- **The line is easy to explain.** Use it, shape it, go beyond it.
- **The price tracks the cost.** Max features cost money to run (image
  providers, AI generation, expressive voices), so they sit on the plan that
  pays for them.
- **Pro reflects the depth of the product**: the translation pipeline and the
  per-language versions of content that make Mo Speech work across languages.

## Edge cases

- **Downgrading keeps content.** Things made on a higher plan stay on the
  boards and keep working. Only making or changing them needs the plan again.
- **A cancelled plan** keeps its features until the end of the paid period.
- **A payment that hasn't gone through** doesn't unlock a plan. Checkout takes
  cards only for now, so a plan starts the moment the card payment succeeds.
  A subscription Stripe reports as unpaid, incomplete or paused stops
  unlocking paid features.
- **Collaborators** (invited carers) work with the family's plan, whatever
  their own plan is. If the family is on Max, the carer gets Max features
  in the family's account. They can't see or change the plan, and can't open
  a subscription of their own from there. The account owner manages it. See
  [FEAT-106](FEAT-106-settings.md).
- **An upgrade payment that doesn't go through.** The plan stays as it was,
  and nothing is lost. If the card is declined or the bank wants to confirm
  the payment, the page moves to Stripe's payment page to finish it. The new
  plan starts once it's paid. An unpaid upgrade lapses after about a day.
- **Upgrading or booking a change on a cancelled plan** keeps the plan going:
  choosing a new plan means the customer is staying.
- **A booked change is replaced by the next choice.** Booking a different
  change, upgrading or cancelling drops the one already booked. That includes
  an upgrade whose payment then fails: the earlier booking is gone and has to
  be made again.
- **Upgrading from a yearly plan to a monthly one.** The unused part of the
  year isn't refunded. It stays on the account as credit and pays the
  following months.
- **The AI picture allowance is the family's.** The 20 a day and 100 a month
  are shared by the owner and every carer working in the account. See
  [FEAT-203](FEAT-203-symbol-editor.md).
- **Downgrading and My Images.** A downgraded account's My Images tab is
  locked like the rest of Max, so its existing pictures can't be deleted from
  the app. Only the account owner going back to Max reopens that. The
  pictures themselves stay wherever they're already used on boards; nothing
  disappears.

## What the build still needs

Today's app against the decided model. Every row is shipped (verified 2026-09-29, and the collaborators row 2026-09-30), except **Checkout**, which waits on MOS-59's remaining
steps (the Ltd has to exist first, see
[ADR-025](../decisions/ADR-025-stripe-managed-payments-mor.md)).

| Area | Today | Decided |
|---|---|---|
| Upload tab and My Images | **Max** | Max. Shipped |
| Pro price | **£13.99 / mo · £134 / yr** | Shipped |
| Max price | **£18.99 / mo · £182 / yr** | Shipped |
| Plan tab feature lists | Rewritten from this spec | Shipped |
| Free library modules | A Free module is **SymbolStix-only**. **Instruments** and **Clothes** (which used Image Search photos and uploads) moved to Max rather than being re-authored | Shipped |
| New-account trial | No trial. Free is free from sign-up | Shipped |
| Collaborators and the host's plan | An invited carer works with the **family's** plan, whatever their own plan is ([MOS-88](https://linear.app/mo-intelligence/issue/MOS-88)) | Shipped (verified 2026-09-30) |
| Changing plan | Upgrades charge the difference and start at once. Downgrades and monthly/yearly switches are booked for the next billing date and can be undone ([MOS-93](https://linear.app/mo-intelligence/issue/MOS-93)) | Shipped (verified 2026-10-02) |
| Checkout | Stripe Checkout | Stripe Managed Payments, waiting on MOS-58 and MOS-59 |

## Where it lives

- Plan and billing screen: `app/components/app/settings/sections/AccountBillingPanel.tsx`
- The upgrade prompt: `app/components/app/shared/ui/UpgradeNudge.tsx`
- What each plan can do, on the server: `convex/lib/access.ts`
- Plan changes: the rule in `lib/planChange.ts`, the Stripe calls in
  `lib/stripePlanChange.ts`, and what gets stored in `lib/subscriptionState.ts`
  and `lib/subscriptionSync.ts`
- The public pricing page: `app/[locale]/(public)/pricing/`. See
  [FEAT-110](FEAT-110-public-website.md).

## Links

- **Up from:** [FEAT-106 Settings](FEAT-106-settings.md) ·
  [FEAT-107 Resource library](FEAT-107-resource-library.md) ·
  [FEAT-110 Public website](FEAT-110-public-website.md)
- **Related:** every page and component with a locked feature, especially
  [FEAT-203 Symbol editor](FEAT-203-symbol-editor.md),
  [FEAT-204 Play modal](FEAT-204-play-modal.md),
  [FEAT-303 Modelling mode](FEAT-303-modelling-mode.md) and
  [FEAT-304 Themes](FEAT-304-themes.md)
