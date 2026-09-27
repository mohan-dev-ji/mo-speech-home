# FEAT-407 · Themes admin

**Layer 4 · Admin** · [Back to the index](README.md)

> **Status:** controls which themes are available, and on which plan. It stays
> that way. **New themes are made in code** (a rough design in Figma, then
> built and fine-tuned by an agent in the theme files), not in the dashboard.
> M4 reviews this page for the new Pro & Max themes
> ([MOS-65](https://linear.app/mo-intelligence/issue/MOS-65)).

- Every theme in one list, with its **status**, **plan** and publish window
- **Built-in** themes are always available to everyone
- Other themes are published, scheduled, or taken away from here
- Set which **plan** a theme needs (Free, Pro or Max)
- Changes a theme's availability, not its colours. Colours live in the code

---

## What it does

The **Themes** page of the admin dashboard (see
[FEAT-401](FEAT-401-admin-dashboard.md)) controls which themes families can
choose, and on which plan. It lists every theme with:

- **Theme:** its name.
- **Status:** **always-on** for built-in themes, otherwise draft, scheduled,
  live or expired.
- **Tier:** the plan it needs.
- **Window:** when it's available from, and until.
- **Updated:** when it was last changed.

Filters narrow the list by status and plan.

### Built-in and other themes

- **Built-in themes** (Classic, Amber, Fuchsia, Lime, Rose, Sky) are part of the
  app and **always available**. Their row shows **always-on**. A plan or window
  can still be set on top.
- **Other themes** (today, Midnight Glass) only appear to families once
  they're **published** and inside their window.

### Row actions

- **Publish now** / **Unpublish**: make a theme available straight away, or
  take it away.
- **Edit lifecycle…**: set **Publish at** and **Expires at** (to schedule a
  seasonal theme, for example), the **Tier override** (which plan it needs),
  the **Featured** flag, and **Notes**. Clearing a field removes the override.
- **Remove from library.**

### What this page doesn't do

A theme's **colours and backgrounds** aren't edited here, by design. They're
defined in the theme's file in the code, and made or changed by building them
there (from a Figma design) and releasing. This page only controls
availability. See [FEAT-304](FEAT-304-themes.md).

## Why it helps

- **Plans without code.** Moving a theme between Free, Pro and Max is a
  setting, not a release.
- **Seasonal and timed themes.** A theme can be scheduled in and out, for
  example for a holiday.
- **Safe defaults.** Built-in themes can never be accidentally hidden, so every
  account always has themes to choose from.

## Audio

Not applicable.

## Edge cases

- **Unpublishing a theme someone is using.** The profile falls back to Classic.
- **Built-in themes can't be hidden.** Publish controls don't take them away.
- **Featured does nothing yet.** The flag can be set, but nothing in the app
  shows featured themes today. It was meant for the library's themes tab,
  which isn't shown. To be settled in M4
  ([MOS-65](https://linear.app/mo-intelligence/issue/MOS-65)).
- **The plan also needs the account.** A Max theme shows as locked for other
  plans in the picker, with the upgrade prompt. See
  [FEAT-108](FEAT-108-pricing-and-tiers.md).

## Where it lives

- The page: `app/(admin)/admin/themes/`
- The table and edit window: `app/components/admin/` (`ThemesAdminTable`,
  `EditThemeLifecycleModal`, `ConfirmDeleteThemeLifecycleModal`)
- The themes themselves: `convex/data/themes/`
- What families can see: `convex/lib/themes.ts`

## Links

- **Up from:** [FEAT-401 Admin dashboard](FEAT-401-admin-dashboard.md)
- **Feeds:** [FEAT-304 Themes](FEAT-304-themes.md)
- **Related:** [FEAT-108 Pricing & tiers](FEAT-108-pricing-and-tiers.md)
