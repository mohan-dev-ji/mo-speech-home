# FEAT-408 · Product analytics

**Layer 4 · Admin** · [Back to the index](README.md)

- Anonymous usage events, sent to PostHog, to learn how Mo Speech is used
- **Never** the words, symbols or sentences a child says
- No automatic click capture, no session recording, no IP addresses
- Every event is declared up front, and nothing else can be sent
- Families can switch it off in **Settings → Data & Privacy**
- Measures the journey that matters: pricing → sign-up → use → upgrade

---

## What it does

To improve Mo Speech, the team needs to know which features are used, where
people get stuck, and what leads to an upgrade, without learning anything
about what a child is saying. Product analytics does that with a short, fixed
list of anonymous events.

### What's measured

**The journey to a subscription**

- **viewed_pricing:** someone opened the pricing page.
- **signed_up:** a new account.
- **clicked_upgrade:** someone tapped an upgrade prompt, with which plan and
  from where.
- **started_checkout:** someone went to payment.

**Features in use** (how often, never what)

- **module_installed**, **module_uninstalled**: a library module added or
  removed, and which one.
- **theme_changed**, **theme_locked_click**: a theme chosen, or a locked
  premium theme tapped (a sign of demand).
- **language_switched:** from which language to which.
- **modelling_started:** a modelling session began.
- **image_search_used**, **ai_generate_used**, **ai_generate_adopted**,
  **ai_generate_quota_blocked**: the image features, with counts and whether a
  limit was hit.

**Admin**

- **module_published:** a module published, which one, and at what plan.

Each event carries a few plain facts such as the plan, the language or a theme
name. **Never text, symbols, sentences, names or recordings.**

### How privacy is protected

- **Only listed events.** Every event is declared in one place. Sending
  anything else won't even compile, so nothing extra can slip in by accident.
- **No automatic capture.** Taps and typing aren't recorded automatically.
- **No session recording**, which would otherwise capture what a child taps.
- **No page addresses** sent automatically (they could reveal things like an
  account ID).
- **No IP addresses.**
- **No anonymous profiles.** People are only linked to an account once they're
  signed in, which joins up pricing → sign-up without tracking strangers.
- **Opt out.** **Settings → Data & Privacy** has a switch: "Help improve Mo
  Speech with anonymous usage data". Turned off, nothing is sent from that
  account. See [FEAT-106](FEAT-106-settings.md).

## Why it helps

- **Decisions from evidence.** Which modules, themes and languages are wanted
  shapes what gets made next.
- **Pricing that works.** Seeing which locked features tempt people (a
  locked theme tapped, an upgrade prompt clicked) shows what's worth paying for.
- **Trust.** Families can see exactly what's collected, and turn it off.

## Audio

Nothing about audio or speech is ever sent.

## Edge cases

- **No analytics key, no analytics.** In development and previews, nothing is
  sent.
- **Opting out** takes effect for the whole account, on every device.
- **Referral data isn't recorded yet.** The sign-up event always says "no
  referral code", because referrals aren't tracked until the affiliates work
  (M3, [MOS-62](https://linear.app/mo-intelligence/issue/MOS-62)).

> **Known issues:**
> - **Eight declared events are never sent**, including the onboarding ones
>   (student profile created, first symbol tapped). They'll be wired up or
>   removed in [MOS-86](https://linear.app/mo-intelligence/issue/MOS-86) (M5).
> - **Analytics goes to PostHog's US region.** Moving to the EU region, under the
>   UK Children's Code and GDPR, is part of
>   [MOS-75](https://linear.app/mo-intelligence/issue/MOS-75) (M7).

## Where it lives

- The list of events, and sending them: `lib/analytics.ts`
- Starting analytics with its privacy settings: `app/contexts/PostHogProvider.tsx`
- Linking to the signed-in account, and respecting opt-out:
  `app/contexts/AppStateProvider.tsx`
- The opt-out switch: `app/components/app/settings/sections/PrivacyPanel.tsx`

## Links

- **Up from:** [FEAT-401 Admin dashboard](FEAT-401-admin-dashboard.md)
- **Related:** [FEAT-106 Settings](FEAT-106-settings.md) (Data & Privacy) ·
  [FEAT-108 Pricing & tiers](FEAT-108-pricing-and-tiers.md)
