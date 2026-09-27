# User stories · Layer 3: modes & looks

Ways the whole app changes. See [`01-users.md`](01-users.md) for the users.

---

## FEAT-301 · Instructor & student views · [spec](../4-builds/features/FEAT-301-instructor-and-student-views.md)

- As an **instructor**, I want my child to see only what I've chosen, so that
  they can't accidentally change or break their setup.
- As an **instructor**, I want to lock my child's view, so that the setup I built
  stays intact however clever they are at getting round things.
- As an **instructor**, I want to open things up gradually, so that my child
  gains independence as they progress.

**Acceptance**

- A student view shows only the allowed pages and controls, in the student's
  language, voice and look.
- Typing a hidden page's address redirects to an allowed page.
- A locked student view can't be left from the student's device.
- **Before launch (MOS-82):** the lock survives refreshes, new tabs, browser
  restarts, typed addresses and sign-out. A locked device always reopens in the
  same student's view. How it's unlocked (a PIN or a Settings switch) is to be
  decided.

## FEAT-302 · Edit mode · [spec](../4-builds/features/FEAT-302-edit-mode.md)

- As an **instructor**, I want changing things to be a deliberate mode, so that
  nothing moves by accident.
- As an **instructor**, I want the same editing tools everywhere, so that I
  learn them once.

**Acceptance**

- Every editable surface has Edit / Exit Edit. The button is orange while
  editing.
- Out of edit mode, nothing can be moved, renamed or deleted.
- Drag, ✕, tap to edit, and Create / Add behave the same on every surface.
- Deleting always warns, saying what will be lost.

## FEAT-303 · Modelling mode · [spec](../4-builds/features/FEAT-303-modelling-mode.md)

- As an **instructor or SLT**, I want to show a child where a word lives, step by
  step, so that they learn the route to it.
- As an **instructor**, I want to guide from my own device, so that I can help
  without taking the tablet.

**Acceptance**

- Choosing a symbol starts a session on every device on that student's
  profile.
- Each step dims the page, lights the target, and points to it. The student
  taps to move on, and the page never scrolls for them.
- The instructor's screen follows the student live. Anyone can exit.
- **Before launch (MOS-83):** step 2 (the category tile) works, and the picker
  only offers symbols that can be modelled.

## FEAT-304 · Themes · [spec](../4-builds/features/FEAT-304-themes.md)

- As a **student**, I want my own look, so that the app feels like mine.
- As an **instructor**, I want a calm theme for a child who needs it, so that the
  screen suits them.
- *(M4.)* As a **student**, I want a background about the thing I love (space,
  water), so that I look forward to using it.

**Acceptance**

- A theme is chosen per profile, and switches with the view.
- A theme never changes category colours.
- Premium themes are Max.
- *(M4.)* Animated themes stop moving when **Reduce motion** is on, in the
  profile or on the device.

## FEAT-305 · Languages & voices · [spec](../4-builds/features/FEAT-305-languages-and-voices.md)

- As a **family**, I want the whole app in our language, so that my child
  communicates the way we speak.
- As a **bilingual family**, I want some words always in one language, so that
  the board fits how we really talk.
- As an **instructor**, I want to choose a male or female voice, so that it
  suits my child.

**Acceptance**

- The app's words, symbols, labels, audio and search all follow the board's
  language.
- Each student can have their own language and voice (Pro).
- Untranslated text is spoken by its own language's voice, never in the wrong
  accent.
- Names and labels translate in one tap and can be undone. Sentences and
  phrases get a version per language.
- A symbol can be pinned to one language.
