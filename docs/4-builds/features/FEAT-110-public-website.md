# FEAT-110 · Public website

**Layer 1 · Page** · [Back to the index](README.md)

> **Status: a sketch.** The public website works, but most of its words are
> still the starter template's placeholders. It's redesigned and rewritten in
> M6 Marketing ([MOS-70](https://linear.app/mo-intelligence/issue/MOS-70)
> design, [MOS-71](https://linear.app/mo-intelligence/issue/MOS-71) build),
> with copy from `5-prd/`. This spec records what exists, so M6 starts from
> the truth.

- Everything a visitor can see without signing in
- A first-visit welcome that asks which language to use
- A landing page, a pricing page and the resource library
- No features page yet. One is planned for M6
- A top bar with the library, pricing, language, light/dark, and sign in or
  sign up
- Signed-in visitors are taken into the app instead

---

## What it does

The public website is the front door: how a family finds out what Mo Speech is
before creating an account.

### First visit: choose a language

A brand-new visitor is greeted before anything else with a simple bilingual
choice: **English** or **हिन्दी**. Their choice is remembered, and everything
after it (the website, then the app after sign-up) is in that language.
Returning visitors skip straight past it.

### The landing page

A hero with the Mo Speech name, a "Now in beta" badge, and two buttons:
**Start for free** (sign-up) and **See pricing**. Below it are a row of feature
highlights and a closing call to sign up.

### The pricing page

The three plans side by side, with a monthly or yearly switch and a comparison
table of what each plan includes. Each plan has a button to start it. See
[FEAT-108](FEAT-108-pricing-and-tiers.md) for the plans themselves.

A signed-in visitor who opens the pricing page is taken to Settings → Account &
Billing instead, so there's only ever one place to manage a real plan.

### The resource library

The library is public too, so families can browse ready-made content before
signing up. See [FEAT-107](FEAT-107-resource-library.md).

### The top bar and footer

On every public page, the top bar has:

- the Mo Speech name, linking home,
- **Resource Library** and **Pricing**,
- a **language switcher** and a **light/dark** switch,
- **Sign in** and **Get started**. Once signed in, these become **Go to App**
  and **Sign out**.

The footer repeats Pricing and Sign in.

### Signed-in visitors

Anyone already signed in who visits the site's front door goes straight into
the app, on Home, in their language.

## Why it helps

- **Language first.** A Hindi-speaking family never sees an English-only front
  door.
- **Try before you commit.** The library and pricing are open to everyone, and
  **Start for free** needs only an email.
- **One place for plans.** Signed-in users are always sent to Settings for
  billing, so the website and the app can't disagree about someone's plan.

## What M6 needs to change

| Area | Today | Needed |
|---|---|---|
| Features page | None. The landing page's "Everything you need" section has three placeholder cards ("Feature one", "Feature two", "Feature three") | A dedicated **Features** page, linked from the top bar, telling the product story from the Layer 1–3 specs in this index (via `5-prd/`). The landing section becomes a short teaser that links to it |
| Landing page words | Template placeholders ("Replace this with your product's value proposition…", "Feature one", "Join thousands of teams") | Real copy from `5-prd/` |
| Name | "Mo Speech Home" in the top bar, hero and footer | Confirm the public name (likely "Mo Speech") |
| Pricing page | Old prices (£9.99 / £14.99), "first-thens", "Unlimited student profiles" | The FEAT-108 model and prices, landing with M2 |
| Welcome languages | English and Hindi, hard-coded | Follow the languages Mo Speech has published, like the in-app language list |
| Design | The starter template's styling | The M6 marketing design |

## Edge cases

- **A bare visit with no language chosen** always shows the welcome first, even
  if the browser prefers another language, so the family chooses for
  themselves.
- **Signed-in visitors** never see the landing or pricing pages. They go to
  the app or to Settings.

## Where it lives

- Public pages: `app/[locale]/(public)/` (landing, pricing, library)
- The front-door decision (welcome, landing or app): `app/page.tsx`
- Public sections and parts (hero, features, pricing, top bar, footer, welcome,
  library): `app/components/marketing/`

## Links

- **Down to:** [FEAT-107 Resource library](FEAT-107-resource-library.md) ·
  [FEAT-108 Pricing & tiers](FEAT-108-pricing-and-tiers.md) ·
  [FEAT-109 Sign-up & onboarding](FEAT-109-sign-up-and-onboarding.md)
- **Related:** [FEAT-305 Languages & voices](FEAT-305-languages-and-voices.md)
