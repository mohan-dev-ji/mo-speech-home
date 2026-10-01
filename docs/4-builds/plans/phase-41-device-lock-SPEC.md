# Phase 41 SPEC: Device lock with a PIN

**Status:** design agreed with the owner on 2026-10-01. Not built. This replaces the design in
[MOS-82](https://linear.app/mo-intelligence/issue/MOS-82) (M5 Hardening) and keeps its test list.
The implementation plan comes next (`phase-41-device-lock-plan.md`).

## The problem

Today's lock is saved on the **student profile**. That has three faults:

1. **It traps the instructor.** A locked profile is locked on every device, including the
   instructor's own laptop when they switch to that student to check a change. The only way out
   is another window that's still in instructor view.
2. **It isn't a real lock.** View mode lives in the browser tab. A new tab, a new window or a
   browser restart opens in instructor view, so a determined child gets out.
3. **Anyone in instructor view can unlock.** There's no secret.

Autistic AAC users are often very good at finding ways round restrictions. The lock has to
protect the instructor's setup: boards, settings and permissions.

## The idea

**Lock the device, not the profile.** An adult locks the child's tablet to student view. Their own
phone or laptop is unaffected. Getting out of a locked device needs a PIN.

## Decisions (owner, 2026-10-01)

| Question | Decision |
|---|---|
| What is locked? | The **device** (one browser on one tablet, phone or computer), not the student profile |
| Which profiles can a locked device use? | Chosen **when the device is locked**, per device. The current profile is ticked by default |
| What are extra profiles for? | Mostly the same child with different setups (home and school, or one per language). Siblings with their own devices, and siblings sharing a device, must work too |
| Whose PIN unlocks? | **Each adult has their own PIN.** Any family adult's PIN (the owner's or any carer's) unlocks any of the family's locked devices |
| Default PIN? | **None.** The adult chooses a PIN the first time they lock a device |
| How strong? | The lock is **remembered on the server** and checked every time the app opens. The adults' own devices are never locked unless they lock them |
| Forgot the PIN? | A **one-time code by email**, then choose a new PIN. It works for Google sign-ins, which have no password |
| Changing the PIN | Also from **Settings → Instructor Profile** on any unlocked device, with no email needed |

## What people see

### Locking a device

1. On the child's device, the adult opens the view switcher (top-left) and chooses
   **Lock this device**.
2. If they have no PIN yet, they choose a 4-digit PIN and enter it twice.
3. They tick which student profiles this device can use. The current profile is already ticked,
   and at least one must stay ticked.
4. The device goes into student view on the current profile, and stays there.

### A locked device

- The switcher lists **only the allowed profiles**, plus **Unlock**. With one allowed profile it
  shows that profile's name and Unlock.
- The child can move between the allowed profiles freely.
- **Not reachable:** instructor view, admin view, Settings, edit mode, the resource library's
  install buttons, and sign out. That's true whether they're reached through the interface or by
  typing an address such as `/settings` or `/admin`: those bounce back to the student's home.
- It stays locked after a refresh, a new tab or window, a browser restart, going offline and
  back, and signing back in after the session ends.

### Unlocking

- **Unlock** opens a PIN pad. Any family adult's PIN works.
- A correct PIN unlocks **only this device**, and returns it to instructor view. Other locked
  devices stay locked.
- After 5 wrong tries the pad makes the person wait. The wait grows with each further failure
  (30 seconds, then 1 minute, 5 minutes, 15 minutes). It never unlocks by itself.
- **Forgot PIN?** sends a one-time code to the email of the adult who is signed in on that
  device. Entering the code lets them choose a new PIN, which then unlocks the device.

### The adult's own devices

- Never locked unless the adult locks them. They switch between instructor view and any
  student's view exactly as today.
- **Settings → Instructor Profile** gains a **PIN** section: set a PIN, or change it. Changing it
  asks for the current PIN. If they've forgotten it, the same one-time email code applies.

### What goes away

- The padlock on each student row in the switcher, and the profile-wide lock behind it.
- The "another window is showing this student unlocked" warning. It existed to prompt the old
  lock.

## How it works

Two parts of the stack do different jobs.

**Convex (the database) stores and decides.**
- A new `lockedDevices` table: one row per locked device. It holds the family account, a device
  ID, the allowed profile IDs, who locked it and when, and the wrong-attempt count with the time
  the next attempt is allowed.
- Each adult's PIN is stored on their own `users` row as a **salted hash**, never the PIN.
  Nothing returns it to the browser.
- Locking, unlocking and PIN checks are mutations. The PIN is checked on the server against
  every active adult in the family (the owner and active carers). The wrong-attempt delay is
  enforced on the server, per device, so reloading the page doesn't reset it.
- A removed carer's PIN stops working at once, because only current members are checked.

**Next.js on Vercel enforces it on the way in.**
- The device ID is a long random value the app creates when a device is first locked. It's kept
  in the browser's storage and also in a cookie.
- On every load, the app asks Convex "is this device locked?" **before** drawing anything from
  instructor view. A locked device is put straight into student view on an allowed profile.
- The request layer (`proxy.ts`) reads the cookie and redirects a locked device away from
  Settings, Admin and other instructor-only addresses before they render.
- The client's student-view code reads the lock from Convex, not from the tab, so the lock is the
  single source of truth. The tab-only `mo-view-mode` value stays for unlocked devices.

**Why a child can't get round it**
- Refresh, new tab, restart: the device ID is still there, and the server says locked.
- Clearing the browser's data, a private window or a different browser: these lose the sign-in
  too. Signing back in needs the account's password or Google login.
- Typing addresses: redirected by the request layer and again by the page.
- Guessing the PIN: the growing server-side delay makes 10,000 combinations impractical.

**The one-time email code** uses Clerk's step-up verification, which the app already uses for
password changes. It offers an email code when the account has no password. The plan confirms the
exact call and that it works for Google sign-ins before anything is built on it.

## Edge cases

- **An allowed profile is deleted.** The device carries on with the remaining allowed profiles.
  If none are left it shows a plain "Ask an adult to unlock this device" screen with the PIN pad.
- **The adult who locked it is removed from the family.** The device stays locked. Any current
  adult's PIN unlocks it.
- **The family's plan lapses.** The lock still works. Locking and unlocking are never
  plan-gated.
- **One-tablet family.** They unlock with the PIN on that tablet. If they forget it, the email
  code works on the same tablet. If the adult's email is signed in on the child's tablet, the
  child could read the code. The Settings text advises against keeping adult email on the child's
  device.
- **An adult previews a student on their own device.** Nothing is locked. They switch back
  freely.
- **A locked device is offline.** It stays in student view with what it has loaded. It can't be
  unlocked until it's back online, because the PIN is checked on the server.
- **Existing data.** Any profile locked under the old design is unlocked by the migration, and
  the old field is removed. No device is left stuck.
- **Carers** can lock and unlock like the owner. They use their own PIN.

## Not in this version

- A list of locked devices in Settings with a remote **Unlock** button.
- A different allowed-profile list per time of day, or per app section.
- Biometric unlock.

## Testing: written down and repeated before launch

Each of these must end in **the same student view, still locked**, unless it's unlocked with a
PIN. It's MOS-82's list, adjusted for the device lock.

| # | Try this | Expected |
|---|---|---|
| 1 | Refresh the page | Locked student view |
| 2 | Close the tab, open the app again | Locked student view |
| 3 | Quit the browser completely, relaunch | Locked student view |
| 4 | Open a new tab or window to the app | Locked student view |
| 5 | Type `/settings`, `/en/settings`, `/admin`, `/en/library` | Sent back to the student's home |
| 6 | Browser back and forward buttons | Stays in the locked view |
| 7 | Session ends, sign back in | Locked student view |
| 8 | Clear site data, a private window, or another browser | Signed out. Sign-in needed |
| 9 | Wrong PIN 5+ times | Growing wait. Never unlocks |
| 10 | Reload during the wait | The wait continues |
| 11 | Switch between the allowed profiles | Works. Other profiles aren't listed |
| 12 | Keyboard shortcuts, long-press, text selection | No route out |
| 13 | Switch language or theme inside the locked view | Stays locked |
| 14 | Device offline, then back online | Stays locked |
| 15 | The owner's PIN on a device a carer locked, and the carer's on one the owner locked | Both unlock |
| 16 | A removed carer's PIN | Doesn't unlock |
| 17 | Correct PIN | This device returns to instructor view. Other locked devices stay locked. Locking again works |
| 18 | Forgot PIN on the locked device (a password account and a Google account) | The email code arrives, a new PIN is set, and the device unlocks |
| 19 | The adult's own unlocked device, while another device is locked | Instructor and student views switch freely |
| 20 | Delete an allowed profile from another device | The locked device carries on, or shows "Ask an adult" |

Test on an iPad in Safari (including added to Home Screen), an Android tablet in Chrome, desktop
Chrome and desktop Safari. Record the results with the work.

## What changes in the docs when it ships

- An ADR for the device lock (the next free number), because it changes where view state is decided.
- FEAT-301 (instructor and student views), FEAT-106 (Settings → Instructor Profile).
- `docs/1-inbox/ideas/20-profile-lock-and-pin.md`: status banner updated.
