# FEAT-106 · Settings

**Layer 1 · Page** · [Back to the index](README.md)

- Six tabs: Instructor Profile, Student Profiles, Account & Billing, Invites,
  Data & Privacy and Credits
- The instructor's own language, voice, theme and layout
- Student profiles: create, switch, and shape each student's view
- Per student: language, voice, theme, grid size, symbol labels, sidebar, and
  which pages and controls they can use
- Account details, plan and subscription, and deleting the account
- Invite family and carers to share the account (Max)
- Choose whether anonymous usage data is shared
- Credits for every Image Search photo in use

---

## What it does

Settings is where an instructor sets up Mo Speech: for themselves, for each
student, and for the account. It's a single page with a row of tabs.

### Instructor Profile

How the app looks and sounds for the instructor:

- **Language** of the app. Changing it reloads the app in that language.
- **Voice**: a male or female voice for the language, with a preview.
- **Theme**, **symbol grid** size, and **symbols** (whether text labels show,
  and how large).
- **Sidebar**: full or icon-only, and on the left or the right for left- or
  right-handed use on a tablet.

### Student Profiles

An account can have several students, each with their own profile. At the top,
**Create new profile** adds a student. Each profile shows whether it's the
active one, with **Switch to this profile** to change.

For each student, the instructor shapes the student's view:

- **Name.**
- **Language.** Each student can have their own board language: symbols, labels
  and voice follow it. On Free, students use the app's language.
- **Voice**, with a preview.
- **Theme**. Some themes belong to higher plans and show as locked.
- **Symbol grid**: large (4 across), medium (8) or small (12).
- **Symbols in categories**: show or hide text labels, and label size.
- **Sidebar**: full or icon-only, left or right.
- **Top bar**: whether the student gets **Quick Settings**.
- **Header**: on or off, and whether it starts in **Talker mode** or **Banner
  mode**. Off removes the whole strip at the top of Search and Categories (the
  talker, and the banner with its Edit, Create and Modelling buttons), so the
  student sees only the board. In banner mode, two more permissions appear:
  - **Allow Editing**: the student can use Edit and Create.
  - **Allow Modelling**: the student can start modelling sessions
    themselves.
- **Pages**: which of Home, Search, Categories, Lists, Sentences and Settings
  the student can see. Settings is off by default.
- **Delete Profile**, with a warning that it can't be undone.

This is where the instructor view governs the student view. See
[FEAT-301](FEAT-301-instructor-and-student-views.md).

### Account & Billing

- **Your account**: photo, first and last name, email (a change is confirmed
  by email first) and password.
- **Plan**: Free, Pro and Max, monthly or yearly (yearly saves 20%), with the
  current plan marked. From here you can upgrade, downgrade, switch between
  monthly and yearly, cancel, or reactivate a cancelled plan. See
  [FEAT-108](FEAT-108-pricing-and-tiers.md).
- **Danger zone**: **Delete my account**. It asks you to type DELETE to
  confirm, then permanently removes the account, every student profile, all
  content and the subscription.

### Invites

On Max, an instructor can invite family members and carers by email to share
the same students, so home and school work from the same boards. A table shows
each invite, and whether it's **Waiting** or **Accepted**. On other plans, this
tab explains the feature and offers **Upgrade to Max**.

Only the family's owner, on Max, can invite. A carer can't, and you can't
invite your own email address. If the invite email can't be sent, the panel
says so. The invite stays in the table, so it can be removed or tried again.

Someone who has accepted an invite is a **collaborator**. They work inside the
family's account with the family's plan. They see only Instructor Profile,
Data & Privacy and Credits, with a note that the account owner handles the
plan and invites. The Account & Billing tab is hidden for them, and the
billing actions (checkout, the billing portal, switching, cancelling and
reactivating a plan) refuse anyone who isn't the owner. Managing students (adding, deleting,
renaming, language and voice) stays with the owner.

### Data & Privacy

Mo Speech uses privacy-first analytics to learn which screens and features are
used. It never sends the words, symbols or sentences a child says, and IP
addresses are anonymised. A single switch turns sharing off for the account, on every device it signs in on.
See [FEAT-408](FEAT-408-product-analytics.md).

### Credits

Image Search photos are Creative Commons, and their licences require credit.
This tab lists each Image Search photo the account uses, with the
photographer, the licence, what it's used on and a link to the source.
AI-generated images are grouped separately with a count. Only images still in
use are listed. A photo that's been replaced or removed drops off, and comes
back if it's used again.

## Why it helps

- **One place per student.** An instructor with several students can give each
  a language, a voice, a look and a set of permissions that suits them.
- **Gradual independence.** Pages and permissions can be switched on one at a
  time as a student grows, starting with a single page if needed.
- **Home and school together.** Invites let a parent, carer or teacher work on
  the same boards.
- **Trust.** Privacy is explained plainly, with a real off switch, and photo
  credits are handled for you.

## Audio

Each voice card has a preview, so the instructor hears a voice before choosing
it. The voice chosen for a student is the one their symbols, lists and
sentences speak with. See [FEAT-305](FEAT-305-languages-and-voices.md).

## Edge cases

- **Free accounts.** Students can't have a different language from the app on
  Free. The language section offers **Upgrade for more**. Higher-plan themes are
  locked.
- **Invites are Max.** Other plans see an upgrade message on the Invites tab.
- **An invite is claimed only by its real owner.** Signing up joins a pending
  invite only when it's the same email address, once Clerk has confirmed the
  visitor really controls that address, whatever the capital letters.
- **Someone who already has an account** joins the family the next time they
  sign in, as long as their own account has no students. If it does, they stay
  as they are, and Home shows a notice asking the family to invite a different
  email address. Nothing of theirs is hidden. **Known edge case:** an owner
  who has carers but no students can still accept another family's invite.
- **Collaborators** can't see the plan or send invites, and can't delete the
  account. Deleting explains that only the owner can. They work on the family's
  boards, so what they add, change or delete is shared with everyone in the
  family, and there's no undo yet.
- **Personal and shared settings.** In instructor view, each adult's own grid
  size, text size, theme and language stay their own, so a carer's choices
  never change the owner's. A student's view settings belong to the child and
  are shared by the whole family.
- **Deleting a student profile** permanently removes that student's content.
- **Deep links.** Other screens can open Settings on a particular tab. For
  example, the upgrade prompt's **See plans** opens Account & Billing.
- **Settings hidden for a student.** Students can't see Settings unless the
  instructor switches it on for them.

## Where it lives

- The page: `app/[locale]/(app)/settings/`
- The tabs and their panels: `app/components/app/settings/`

## Links

- **Down to:** [FEAT-108 Pricing & tiers](FEAT-108-pricing-and-tiers.md) ·
  [FEAT-301 Instructor & student views](FEAT-301-instructor-and-student-views.md)
- **Related:** [FEAT-109 Sign-up & onboarding](FEAT-109-sign-up-and-onboarding.md)
  · [FEAT-203 Symbol editor](FEAT-203-symbol-editor.md) (where Image Search
  photos come from) · [FEAT-206 App shell](FEAT-206-app-shell.md) (sidebar and
  top bar) · [FEAT-304 Themes](FEAT-304-themes.md) ·
  [FEAT-305 Languages & voices](FEAT-305-languages-and-voices.md) ·
  [FEAT-408 Product analytics](FEAT-408-product-analytics.md)
