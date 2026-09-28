# FEAT-107 · Resource library

**Layer 1 · Page** · [Back to the index](README.md)

- Ready-made content by Mo Speech: categories, lists and sentences
- Tabs for Categories, Lists and Sentences, with filters by plan
- Each module has its own page showing everything inside it
- **Add to profile** installs a module in one tap
- Public: anyone can browse it without signing in
- Buttons adapt: sign up, upgrade, add, or already added
- Everything comes in every supported language
- Removing is done in the app, not here

---

## What it does

The resource library is a shop window of ready-made content, built by Mo Speech
with specialist input. Each item is a **module**: one category, one list or one
sentence group, ready to drop into a student's profile.

### Browsing

The library has three tabs: **Categories**, **Lists** and **Sentences**, each
showing how many modules it holds. Each module is a card with its cover, name
and size (for example "24 symbols" or "6 lists"), plus a badge saying which
plan it belongs to:

- **Default**: included for everyone, and already added to new accounts.
- **Free**, **Pro** or **Max**: the plan needed to add it.

A Free module is always **SymbolStix-only**: a module that uses Image Search
photos or uploaded pictures needs at least Max, even if it isn't otherwise a
premium topic. **Instruments** and **Clothes**, for example, sit on Max
because they're built from Image Search photos and uploads, not because
they're advanced content.

Filters above the grid narrow the list to one of these. Only filters with
modules in them are shown.

Each tab has its own web address, so a link can open straight onto Lists, and
the browser's Back button returns to the tab you were on.

### A module's page

Tapping a card opens that module's page: its cover and description, then
everything inside it. A category shows its symbols, a list shows its steps, and
a sentence group shows each sentence with its symbols. Block sentences show
their phrases grouped the way they play. The page shows the module in the
viewer's language, and **Back to library** returns to the tab it came from.

### Adding a module

At the bottom of each card and module page is one button. What it says depends
on who's looking:

- **Not signed in:** **Sign up to load** goes to sign-up. For now the new
  account lands on Home, and the module is added from the library afterwards.
  Adding it straight after sign-up is planned in
  [MOS-80](https://linear.app/mo-intelligence/issue/MOS-80).
- **Signed in, but the module needs a higher plan:** **Upgrade to load** opens
  the plan options in Settings.
- **Signed in, on the right plan:** **Add to profile** adds it to the active
  student profile and takes you to it. For example, a category lands in
  Categories.
- **Already added:** **Already in your profile**.

A module arrives as one folder: a category on the categories grid, or a group of
lists or sentences. From then on it's the student's own, to use and personalise
like anything else.

### Removing a module

There is no remove button in the library. A module is removed where it lives in
the app, from edit mode, like anything else there. The warning says that any
changes made to it are lost too. Adding it again gives a fresh copy, as it was
originally published. See [FEAT-103](FEAT-103-categories.md) and
[FEAT-302](FEAT-302-edit-mode.md).

## Why it helps

- **Instructors** get a head start: good boards for common topics and routines
  without building them from nothing.
- **Families** can see what Mo Speech offers before signing up, because the
  library is public.
- **Language comes built in.** Modules are made complete in every supported
  language, so a Hindi board gets Hindi content, not a translation to tidy up.
- **Content keeps growing.** New modules appear as Mo Speech publishes them,
  with no app update needed.

## Audio

The library pages are for looking, and don't play audio. Once added, a module's
symbols, steps and sentences speak like any other content, in the student's
language and voice. See [FEAT-305](FEAT-305-languages-and-voices.md).

## Edge cases

- **Already added.** The button says so, and a module can't be added twice.
  Adding one again after deleting it works.
- **The plan changes.** Modules above the account's plan show **Upgrade to
  load**. Modules already added stay in the profile.
- **Installing needs at least the module's plan.** A Pro account can't add a
  Max module, and this is checked on the server as well as in the button, so
  it holds even if the button is bypassed.
- **Old links.** The previous library's addresses (from before modules) send
  visitors to the current library.
- **Phrases aren't here.** Phrase modules exist, but they arrive with the
  talker dropdown's defaults rather than through the library. See
  [FEAT-202](FEAT-202-talker-dropdown.md).

## Where it lives

- The pages (public, no sign-in needed): `app/[locale]/(public)/library/`
- The library, cards, module page and add button:
  `app/components/marketing/`
- What's published comes from admin authoring. See
  [FEAT-402](FEAT-402-admin-authoring.md).

## Links

- **Down to:** [FEAT-108 Pricing & tiers](FEAT-108-pricing-and-tiers.md) ·
  [FEAT-402 Admin authoring](FEAT-402-admin-authoring.md)
- **Up from:** [FEAT-101 Home](FEAT-101-home.md) (the resource library banner) ·
  [FEAT-110 Public website](FEAT-110-public-website.md)
- **Related:** [FEAT-103 Categories](FEAT-103-categories.md) ·
  [FEAT-104 Lists](FEAT-104-lists.md) · [FEAT-105 Sentences](FEAT-105-sentences.md)
  · [FEAT-109 Sign-up & onboarding](FEAT-109-sign-up-and-onboarding.md)
