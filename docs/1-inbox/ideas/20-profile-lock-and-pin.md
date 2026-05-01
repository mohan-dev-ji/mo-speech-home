# Profile Lock and PIN

## Overview

The instructor can lock a student profile so the student cannot navigate away from their own profile or change settings. This doc captures an edge case discovered during testing and the proposed long-term direction: a single PIN-based confirmation gate that doubles as the unlock mechanism and as a "sudo" prompt for any destructive or parental action.

---

## The edge case

**Scenario**

- Two windows open: instructor on the left, student on the right.
- Instructor locks the student profile (works as intended — the student can no longer change their own profile).
- Instructor wants to flip the left window to the student profile for a quick sanity check (verify settings, look at theme, confirm a board change), then flip back.
- The left window also gets locked. Now neither window can return to the instructor profile.

**Why this matters**

A common real-world flow: the student is not directly under the instructor's gaze, and the instructor wants to glance at the student profile to confirm that settings or symbols have been correctly applied. Today this is a dead end once a lock is active.

**Workaround discovered during testing**

Closing the window and reopening `localhost` returns the instructor profile. This implies the lock is currently held in `sessionStorage` or in-memory React state — it does not survive a fresh window. Useful as an escape hatch, but it tells us two things:

1. The lock is "polite" rather than "secure" — a determined student could do the same.
2. We will need a more durable storage layer once the lock has any real responsibility.

---

## Proposed direction

Two complementary primitives. Build them when the testing pain is real, not before.

### 1. "View as student" preview from inside the instructor profile

A read-only render of the student's home / board with their theme applied, surfaced from within the instructor profile. The instructor never has to switch session to perform a sanity check.

- Solves the most common case: "is the setup correct?"
- No lock state is touched, so there is nothing to escape from.
- Tradeoff: maintain a read-only render path for the student view.

### 2. PIN-to-exit on the lock

When a profile is locked, a hidden gesture (long-press logo, four-corner tap, etc.) prompts for the instructor's PIN to switch back. Standard pattern — iOS Guided Access, Screen Time, kiosk apps.

Needed for the case where the instructor *did* hand the device over and now wants it back.

### Recommendation

Build #1 first — it covers the sanity-check use case cleanly without introducing a security primitive. Add #2 once the device is actually being handed over and the lock needs to resist a determined student.

---

## PIN as a universal confirmation gate

The PIN should not be limited to "exit lock". Treat it as the instructor's `sudo` — one mental model, reused everywhere a parental or destructive action needs confirmation.

Candidate gates:

- Exit profile lock
- Delete account
- Delete student profile
- Reset symbols / categories
- Change billing or pricing tier
- Disable safety toggles
- Add or remove family members

One PIN, set once per instructor account, used for all of these. Avoids inventing a separate confirmation flow per destructive action.

---

## Storage of lock state

Current state: `sessionStorage` or React memory — wiped on window close.

Step up: `localStorage` — survives reloads and tab closes. **Cleared by** the user clearing "cookies and site data" in the browser (just clearing cache alone usually does not touch it in Chrome, Safari, or Firefox).

Robust: source of truth in Convex (e.g. a `lockedAt` field on the device session or student profile), with `localStorage` as a fast-path UI hint. Clearing browser data cannot unlock the profile.

Recommendation: when the PIN gate goes in, move the lock state to Convex at the same time.

---

## Schema sketch (deferred)

Not a commitment — just a placeholder for when this gets built.

```
instructors
  pinHash: string        // bcrypt or scrypt; never store plaintext
  pinSetAt: number

studentProfiles
  lockedAt: number | null
  lockedBy: Id<"instructors"> | null
```

---

## Status

- [ ] Edge case observed during testing — 2026-05-01
- [ ] Workaround documented (close window, reopen localhost)
- [ ] No build action yet — keep collecting edge cases during testing
- [ ] Revisit when a second related edge case appears, or when delete-account / delete-profile flows need a confirmation gate
