# Modelling Mode

## What It Is

Modelling mode is a real-time, synchronised, interactive guided walkthrough across two devices simultaneously. The instructor selects a symbol to model, and the student's device enters a step-by-step guided experience that teaches them how to navigate to that symbol within the app — not just what the symbol means, but where to find it.

This is the most technically complex feature in Mo Speech Home.

---

## Prerequisite: Dual-Profile Testing Setup

Modelling mode cannot be developed or tested without a working dual-profile rig. The same logged-in account must be able to run an instructor window and a student-view window simultaneously, with permission flags (`stateFlags.*`) and edit-mode visibility taking effect live. `setViewMode` exists in `ProfileContext.tsx` and must have a UI caller before any modelling work begins.

---

## The Flow

### Instructor side

1. Instructor enters modelling mode from any Category Board
2. Taps the symbol they want to model
3. Confirms in a modal — symbol is shown with its label
4. Convex creates a `modellingSession` document with a pre-computed steps array
5. Instructor screen enters mirror view — they see the student's progress in real time

### Student side

1. Student's app is subscribed to active `modellingSession` for their profile
2. Session arrives instantly via Convex — student's screen enters guided walkthrough
3. A viewport-level black backdrop fades in, covering the entire UI
4. The component the student needs to tap next pokes through the backdrop via z-index, with an animated glow ring
5. A `ModellingAnnotation` (arrow + symbol image + label) appears beside the target, pointing to it
6. Student taps the highlighted component → `currentStep` advances in Convex → both screens update
7. Steps continue until the student reaches the target symbol
8. Success animation fires on both screens
9. Both devices return to where they were

---

## Where Modelling is Available

Modelling mode is only available from a category page in instructor edit mode. It is not available from search, the home dashboard, or any other surface. The trigger is gated by three conditions, all required: `viewMode === 'instructor'` AND `useSubscription().hasModelling` AND `stateFlags.modelling_push`.

---

## Steps Structure

Steps are pre-computed when the session is created, derived from the symbol's category location:

```
steps: [
  { screen: "home",          highlight: "categories-nav-button" },
  { screen: "category-list", highlight: "category-tile-{categoryId}" },
  { screen: "board",         highlight: "symbol-{symbolId}" }
]
```

---

## Dimming System — Viewport Backdrop + Z-Index

See **ADR-007** for the full decision and reasoning.

A single fixed-position component, `ModellingBackdrop`, renders once near the root of the app. When a session is active, it fades to ~80% black opacity over the entire viewport (`position: fixed; inset: 0; z-index: 80`) and captures pointer events to block taps on all unwrapped UI.

Highlightable components are still wrapped in `ModellingOverlayWrapper`, but the wrapper no longer renders a per-component dim overlay — the backdrop replaces it. The wrapper's responsibilities are:

- Expose `data-component-key` on its outer div so `ModellingAnnotation` can locate the target via a single `document.querySelector` per step change
- Render a glow ring around the highlighted target (using theme tokens)
- Bump the wrapper's `z-index` to **90** when this `componentKey` is the active step's `highlight`, so the target pokes through the backdrop

### Z-index bands

```
   0–70     app UI (TopBar uses inline z-index 70)
   80       ModellingBackdrop
   90       highlighted target (ModellingOverlayWrapper)
   95       ModellingAnnotation (reserved; lands in slice 5.4)
  100+      emergency UI — toasts, onboarding gate, modals
```

Modals (Dialog, PlayModal, SymbolEditorModal, etc.) sit at z-index ≥100 by convention. They retain priority over modelling so an instructor or student can dismiss an unrelated modal without exiting the session.

The `ModellingOverlayWrapper` never touches its children. The backdrop is the single source of truth for dimming and pointer blocking; the wrapper only ever adds the glow ring and the z-index bump.

---

## ModellingAnnotation

A floating component rendered above everything (highest z-index). Appears beside the active target and points to it.

**Positioning logic:**
- On each step change, reads the target's position via a single `getBoundingClientRect()` call
- If target horizontal centre < 50% viewport width → annotation placed on the right
- If target horizontal centre ≥ 50% viewport width → annotation placed on the left
- Vertical centre of annotation aligns with vertical centre of target
- Arrow always points from the annotation toward the button

This is the only place in the modelling feature that touches the DOM for measurements — and only once per step change.

---

## Convex Architecture

**New table:** `modellingSession`

```typescript
modellingSession: {
  _id: Id<"modellingSessions">
  profileId: Id<"studentProfiles">
  initiatedBy: string              // clerkUserId of the instructor
  symbolId: Id<"symbols">
  symbolPreview: { word: string, imagePath: string }
  steps: Array<{ screen: string, highlight: string }>
  currentStep: number
  status: "active" | "completed" | "cancelled"
  createdAt: number
  completedAt?: number
}
```

**Queries:**
- `getActiveModellingSession(profileId)` — student's app subscribes to this
- `getModellingSessionById(sessionId)` — instructor's mirror view subscribes to this

**Mutations:**
- `createModellingSession(profileId, symbolId)` — instructor triggers; pre-computes steps
- `advanceStep(sessionId)` — student taps; increments currentStep
- `cancelModellingSession(sessionId)` — either party can exit early

---

## React Architecture

- **`ModellingSessionContext`** — wraps entire app; always present; normally invisible; activates the dimming layer when a session is pushed
- **`ModellingBackdrop`** — single viewport-level dim layer mounted in `AppProviders`; fades in/out with the session (see ADR-007)
- **`ModellingOverlayWrapper`** — wraps every highlightable component; on highlight, bumps z-index above the backdrop and renders the glow ring
- **`ModellingAnnotation`** — arrow + symbol image + label; positioned via `getBoundingClientRect()`

Every tappable element the walkthrough needs to highlight must have a stable `componentKey` from day one:
- `categories-nav-button`
- `category-tile-{categoryId}`
- `symbol-{symbolId}`

---

## Component Key Wiring Checklist

Every highlightable element must be wrapped in `ModellingOverlayWrapper` with a stable `componentKey`, set in Phase 0 and audited each phase:

- `categories-nav-button` — sidebar categories nav item (`app/components/app/shared/sections/Sidebar.tsx`)
- `category-tile-{categoryId}` — category list tile (`app/components/app/categories/ui/CategoryTile.tsx`)
- `symbol-{symbolId}` — symbol card (`app/components/app/shared/ui/SymbolCard.tsx`) ✓ already wired

The wrapper also exposes `data-component-key={componentKey}` on its outer div so `ModellingAnnotation` can locate the target via a single `document.querySelector` per step change.

---

## Constraints

- **Live only** — both instructor and student must be in the app simultaneously
- **One-to-one** — one instructor to one student per session
- **One active session per student** — cannot have two simultaneous sessions
- Session auto-cancels if student goes offline (timeout mutation)
