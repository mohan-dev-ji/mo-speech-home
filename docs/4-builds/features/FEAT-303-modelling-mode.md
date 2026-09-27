# FEAT-303 · Modelling mode

**Layer 3 · Modes & looks** · [Back to the index](README.md)

- The instructor picks a symbol, and the student is shown step by step how to
  reach it
- Starts from **Model** on any category board
- Every device on that student's profile follows the same session at once
- The page dims, the next thing to tap lights up, and a pointer shows where
  it is
- The student taps their way there: Home → Categories → the category → the
  symbol
- The instructor's screen follows along live
- A step counter and an exit button throughout
- Pro and Max. Students can start it themselves only if allowed

---

## What it does

**Modelling** is how AAC is taught: an adult shows where a word lives, and the
student learns the route to it. Mo Speech turns that into a guided walk-through
the student does themselves, on their own device, while the instructor watches.

### Starting a session

On a category board, with the talker off, the banner has a **Model** button.
It opens **"Choose a symbol to model"**, listing the symbols in that category.
Pick one and press **Start session**.

### What the student sees

Every device open on that student's profile, typically the student's own
tablet, goes to **Home** so everyone starts from the same place. Then, step by
step:

1. **The Categories button** in the sidebar lights up.
2. **The category's tile** lights up.
3. **The symbol** lights up.

At each step the rest of the page dims, the target glows, and a small pointer
card sits beside it. If the target is off screen, the pointer sits at the edge
of the board, pointing which way to scroll. The page **doesn't scroll for the
student**, because learning where the symbol lives is the point. A counter
shows **"Step 1 of 3"**. The student moves on by **tapping the lit-up target**,
exactly as they would when using the app for real.

On a phone, where the sidebar folds away, the menu opens by itself when the
step points into it.

### What the instructor sees

The instructor's window **follows the student** step by step, showing the same
target, so they can see progress in real time from across the room or from
another device. The same step counter shows on every device.

### Ending

The session ends when the student taps the symbol at the last step, or when
anyone taps the **exit** button. There's deliberately no celebration screen.
Reaching the word, and hearing it, is the reward.

## Why it helps

- **Teaching the route, not just the word.** Students learn where a symbol
  lives, building the motor memory that makes AAC fast.
- **Doing, not watching.** The student taps each step themselves, on their own
  device.
- **Remote support.** The instructor can guide from another device, which is
  useful when sitting beside the student isn't possible.
- **Calm and clear.** Dimming everything except the next target cuts out
  distraction.

## Audio

When the student taps the final symbol, it speaks as usual, in their language
and voice. The guided steps before it (the sidebar button and the category
tile) are silent, like any navigation.

## Edge cases

- **Plans.** Modelling is Pro and Max. On Free, **Model** is shown switched off
  with "Modelling is available on Pro and Max." See
  [FEAT-108](FEAT-108-pricing-and-tiers.md).
- **Students starting it themselves.** In a student's view, **Model** is
  switched off ("Switch to instructor view to use modelling") unless the
  instructor has turned on **Allow Modelling** for that student. See
  [FEAT-106](FEAT-106-settings.md).
- **One session at a time.** Starting a new session for a student cancels any
  session already running.
- **Editing pauses.** While a session runs, the board stays in tap-and-play,
  even if edit mode was on. See [FEAT-302](FEAT-302-edit-mode.md).
- **SymbolStix symbols only.** Only symbols from the SymbolStix library can be
  modelled today. See the note below.

> **Known issues, being fixed in [MOS-83](https://linear.app/mo-intelligence/issue/MOS-83)
> (High, M5):**
> - **Step 2 is broken.** The category tile never lights up (no glow, no
>   pointer), so a session can't reach the symbol. Its target tag was lost when
>   the old category tile was replaced by the shared group tile on 2026-07-06.
> - **The picker lists symbols that can't be modelled.** Only SymbolStix symbols
>   can be modelled, but uploaded, Image Search and AI pictures are offered too,
>   and choosing one fails with a message that sounds temporary. The picker will
>   show only symbols that can be modelled.

## Where it lives

- Starting a session (the Model button and symbol picker):
  `app/components/app/categories/`
- The session itself (steps, advancing, cancelling): `convex/modellingSessions.ts`
- The dimming, glow, pointer, step counter and exit button:
  `app/components/app/shared/ui/Modelling*.tsx`
- Keeping every device on the same step: `app/contexts/ModellingSessionContext.tsx`
  and `app/components/app/shared/sections/ModellingMirrorSync.tsx`

## Links

- **Starts from:** [FEAT-103 Categories](FEAT-103-categories.md)
- **Related:** [FEAT-106 Settings](FEAT-106-settings.md) (Allow Modelling) ·
  [FEAT-108 Pricing & tiers](FEAT-108-pricing-and-tiers.md) ·
  [FEAT-206 App shell](FEAT-206-app-shell.md) (the sidebar step) ·
  [FEAT-301 Instructor & student views](FEAT-301-instructor-and-student-views.md)
  · [FEAT-302 Edit mode](FEAT-302-edit-mode.md)
