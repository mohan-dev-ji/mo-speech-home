# FEAT-109 · Sign-up & onboarding

**Layer 1 · Page** · [Back to the index](README.md)

- Sign up with an email, and you start on Free
- A short welcome asks for the first student's name, language and (optionally)
  date of birth
- The student's language becomes the app's language
- A full set of default boards arrives straight away: categories, core words,
  phrases, lists and sentences
- Invited family and carers skip setup and join the inviting account
- Returning users go straight to Home

---

## What it does

Sign-up gets a family from "never heard of it" to a child tapping symbols in a
couple of minutes, with no card and no set-up work.

### Signing up

**Sign up** asks for an email and a password, with the usual email check. There
are no payment details. Every new account starts on **Free**, which never
expires. See [FEAT-108](FEAT-108-pricing-and-tiers.md).

After sign-up, Mo Speech opens on Home in the language the visitor was already
using on the website.

### Meeting the first student

The first time the app opens, a welcome window sits over everything: **"Let's
get started. Create a profile for your student to set up their AAC board."** It
asks for:

- **Student's name** (for example Amir or Priya).
- **Language**, from the languages Mo Speech offers. A language that's still
  new is marked **preview**.
- **Date of birth**, which is optional.

**Create profile** is the only way forward, because Mo Speech is built around a
student and needs one to work. The chosen language becomes the language for the
whole account as well as the student, so everything matches from the first
tap.

### The default boards

The moment the first student is created, the account is filled with Mo Speech's
**default content**, in the order the Mo Speech team arranged it:

- **Categories**, a full starter board of everyday topics.
- **Core words** and **phrases** in the talker dropdown.
- **Lists** for common routines.
- **Sentences** for things students say often.

It's all SymbolStix content, available in every supported language, so a Hindi
account gets Hindi boards. The account can be used straight away. Nothing needs
building first.

More students can be added later in Settings. They all share the account's
boards. See [FEAT-106](FEAT-106-settings.md).

### Joining an invited account

Someone invited by email (a parent, carer or teacher) signs up with that same
email address and is joined to the inviting account automatically, once Clerk
has confirmed they really control that address (matched whatever the capital
letters). They skip the welcome window and go straight to the students and
boards they were invited to share. See [FEAT-106](FEAT-106-settings.md).

### Coming back

A signed-in visitor to the site goes straight to Home in their language. The
welcome window never appears again once a student exists.

## Why it helps

- **No barrier.** No card, no trial clock, no empty app. A child can be using
  real AAC within minutes of a parent finding Mo Speech.
- **Ready-made boards** mean the first experience is using Mo Speech, not
  setting it up.
- **Language from the start.** Choosing the student's language first means a
  Hindi-speaking family never has to find a language setting.
- **Shared from day one.** Invited carers land on the same boards without doing
  anything.

## Audio

Default content speaks in the chosen language's default voice from the first
tap. A different voice can be chosen per student in Settings. See
[FEAT-305](FEAT-305-languages-and-voices.md).

## Edge cases

- **The welcome can't be skipped.** It has no close button, because the app
  needs a student. It's never shown to invited collaborators.
- **A name is required.** Pressing Create without one says "Please enter the
  student's name."
- **Language on Free.** On Free the account has one language. Setting the
  account language from the first student keeps Free accounts consistent.
  Different languages for different students are a Pro feature.
- **Defaults are added once.** Adding a second student doesn't add a second
  copy of the default boards.
- **Referrals aren't tracked yet.** Remembering which affiliate a family came
  from is part of the affiliates work in M3
  ([MOS-62](https://linear.app/mo-intelligence/issue/MOS-62)).

> **Known issue:** new accounts are recorded as being on a 14-day "trial" that
> doesn't exist in the pricing and grants nothing extra. It's harmless to the
> user today, but it's misleading in the data. It's being removed in
> [MOS-28](https://linear.app/mo-intelligence/issue/MOS-28) (M2).
>
> **Planned:** a visitor who pressed **Sign up to load** on a library module
> will have that module added and opened after sign-up
> ([MOS-80](https://linear.app/mo-intelligence/issue/MOS-80), M6).

## Where it lives

- Sign-up and sign-in pages: `app/(auth)/`
- Where sign-up lands: `app/post-signup/`
- The welcome window: `app/components/app/onboarding/StudentOnboardingGate.tsx`
- Creating the account record and joining invites: `convex/users.ts`
- Adding the default boards: the default-account seed in
  `convex/profileCategories.ts`

## Links

- **Down to:** [FEAT-106 Settings](FEAT-106-settings.md) ·
  [FEAT-301 Instructor & student views](FEAT-301-instructor-and-student-views.md)
- **Up from:** [FEAT-110 Public website](FEAT-110-public-website.md) ·
  [FEAT-107 Resource library](FEAT-107-resource-library.md)
- **Related:** [FEAT-101 Home](FEAT-101-home.md) (where new accounts land) ·
  [FEAT-108 Pricing & tiers](FEAT-108-pricing-and-tiers.md) ·
  [FEAT-402 Admin authoring](FEAT-402-admin-authoring.md) (how content
  becomes a default)
