# FEAT-301 · Instructor & student views

**Layer 3 · Modes & looks** · [Back to the index](README.md)

- Three views, chosen from the view switcher in the top bar
- **Instructor** (the default): everything visible, everything editable
- **Student**: what the instructor has chosen for that student, and nothing
  else
- **Admin**: the instructor view plus publishing tools, for Mo Speech staff only
- The instructor shapes each student's view in Settings
- A student's view can be **locked** so the student can't leave it
- Each student's view uses their own language, voice, theme and layout

---

## What it does

One Mo Speech account serves two very different people: the adult who sets
things up, and the student who uses them. Views keep the two apart. The
instructor sees and controls everything. The student sees only what's right for
them.

### Instructor view

The default. The instructor view is the "parent control": every page, every
button, every editing surface. From here the instructor creates student
profiles and decides, for each one, what the student's view shows and how much
the student can change.

### Student view

Picking a student in the **view switcher** (top bar, left) turns the device
into that student's view. Everything follows the student's profile:

- **Their pages.** Only the pages allowed for them appear in the sidebar.
  Typing the address of a hidden page takes the student to the first page they
  are allowed to see instead.
- **Their controls.** Whether they get the header (talker and banner), whether
  it starts in talker or banner mode, Quick Settings, editing and self-started
  modelling.
- **Their look and sound.** Their language (the app switches into it), their
  voice, theme, grid size, label size and sidebar.

All of this is set in **Settings → Student Profiles**. See
[FEAT-106](FEAT-106-settings.md).

In practice, the instructor signs in on the student's device, picks the student
in the view switcher, and hands it over.

### Locking a student's view

The view switcher can **lock** a student's view. While locked, the switcher on
that device becomes a plain label with a lock, and it can't be opened, so the
student can't switch back to the instructor view. The instructor unlocks it
from the view switcher on their own device.

If an instructor sees that a student's view is open somewhere and **not**
locked, a note tells them ("Student is using their profile") and suggests
locking it.

> **Known gap, being fixed in [MOS-82](https://linear.app/mo-intelligence/issue/MOS-82)
> (High, M5):** today's lock can be escaped. Closing the tab or the browser,
> or opening a new tab, returns to the instructor view, because which view a
> device shows is only remembered by that tab. MOS-82 adds an **instructor
> PIN** (set in Settings, instructor only) and makes the lock survive
> restarts, new tabs, typed addresses and every other route out. A locked
> device will always reopen in the same student's view, still locked, until
> the PIN is entered.

### Admin view

Only accounts with Mo Speech's admin role see **Admin** in the view switcher.
It's the instructor view with extra tools: publishing content as defaults for
new accounts, or as library modules for each plan, plus reminders when
something being edited is already published. It's not customer facing. See
[FEAT-401](FEAT-401-admin-dashboard.md) and
[FEAT-402](FEAT-402-admin-authoring.md).

## Why it helps

- **Nothing changes by accident.** AAC users can be ingenious at reorganising
  their setup, and instructors can be left unable to get the old one back. A
  student view, locked, keeps the instructor's careful setup intact.
- **Independence at the student's pace.** Pages and permissions can be opened
  up one at a time as a student progresses, from a single page to the whole
  app.
- **Focus.** An instructor can narrow a student's view to exactly what they're
  working on, for example only Sentences.
- **One account, many students.** Each student gets their own language, voice
  and look on the same account.

## Audio

In a student's view, everything speaks in the **student's** language and voice,
not the instructor's. See [FEAT-305](FEAT-305-languages-and-voices.md).

## Edge cases

- **Hidden pages by address.** In a student's view, going to a hidden page's
  address redirects to the first allowed page: Home, Search, Categories, Lists,
  then Settings.
- **Editing in a student's view** is off by default, and needs **Allow
  Editing**. Even then, the plan's limits still apply. See
  [FEAT-108](FEAT-108-pricing-and-tiers.md).
- **Collaborators** (invited carers) use the account's student profiles in the
  same way, but can't change the plan or send invites. See
  [FEAT-106](FEAT-106-settings.md).
- **Two windows.** An instructor can have their own view in one window and a
  student's view in another on the same computer, for example to check a setup.

## Where it lives

- Which view is showing, and the student's settings in use:
  `app/contexts/ProfileContext.tsx`
- The view switcher and lock: `app/components/app/shared/ui/BreadcrumbViewModeDropdown.tsx`
  and `convex/studentViewLock.ts`
- Keeping students on allowed pages: `app/components/app/shared/sections/StudentViewRouteGuard.tsx`
- The "student is using their profile" note:
  `app/components/app/shared/sections/InstructorPresenceWatcher.tsx`

## Links

- **Applies to:** every page
- **Related:** [FEAT-106 Settings](FEAT-106-settings.md) (where each student's
  view is shaped) · [FEAT-206 App shell](FEAT-206-app-shell.md) (the view
  switcher) · [FEAT-303 Modelling mode](FEAT-303-modelling-mode.md) ·
  [FEAT-401 Admin dashboard](FEAT-401-admin-dashboard.md)
