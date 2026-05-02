# ADR-007 — Modelling-Mode Dimming via Viewport Backdrop + Z-Index

**Date:** 2026-05-02
**Status:** Accepted
**Supersedes:** "Dimming System — Per-Component Black Overlay Divs" section of `docs/1-inbox/ideas/04-modelling-mode.md` (original spec)

---

## Context

The original spec for modelling mode (`04-modelling-mode.md`) called for **per-component black overlay divs**: every "highlightable" component would be wrapped in `ModellingOverlayWrapper`, which would render an absolutely-positioned black div on top of the wrapped child. When a session is active and the wrapped component is *not* the target, the overlay raises to 80% opacity and blocks pointer events. The target keeps its overlay at 0% opacity and gets a glow ring.

The argument for this approach was avoiding "colour bleed" — the spec asserted that reducing opacity on the component itself causes unexpected visual mixing on colourful symbol grids.

Slice 5.0a (foundation) shipped this design. Three highlightable components were wrapped: the Categories sidebar item, category tiles, and symbol cards. When the visual layer was tested with a fake session (`window.__modelling.setFake(...)`), only the wrapped surfaces dimmed. **Everything else — TopBar, breadcrumb, the rest of the sidebar (Home, Search, Lists, Sentences, Settings), the page banner, the Mo Speech logo, the settings cog — stayed full-bright.** The result didn't match the Figma flow (frames 03–05 in `docs/3-design/screens/category - board - modelling mode/`), which clearly shows the entire viewport dimmed with only the target poking through.

Two paths were possible:

1. **Wrap every navigable surface in the app** (TopBar buttons, every Sidebar nav item, breadcrumb crumbs, profile dropdown, banner buttons, ...) so that all of them have a wrapper to dim. This preserves the spec's per-component approach but requires every future component to remember to add a wrapper, with a `componentKey` even for non-target elements that exist only to dim.
2. **Add a single viewport-level backdrop** that dims the whole screen, with the highlighted target's wrapper bumping z-index to escape above it.

Option 2 was chosen.

A note on the original "colour bleed" argument: it conflated two distinct techniques. CSS `opacity: 0.5` on a coloured component itself does cause alpha-blending issues on top of a coloured background. But a **separate black overlay layer** — whether per-component or viewport-wide — does not, because it composites on top as its own layer. The original concern doesn't apply to a backdrop.

---

## Decision

Modelling-mode dimming is provided by a single fixed-position component, **`ModellingBackdrop`**, mounted once near the root of the app inside `ModellingSessionProvider`.

- `position: fixed; inset: 0; background: black`
- Opacity transitions `0 → 0.8` when `isActive` flips to true (via `transition-opacity`, smooth fade)
- `pointer-events: auto` while active — the backdrop swallows clicks on all unwrapped UI
- `z-index: 80`

`ModellingOverlayWrapper` no longer renders a per-component dim overlay. Its only responsibilities are:

- Expose `data-component-key` on the outer div for `document.querySelector` lookups by `ModellingAnnotation`
- Render a glow ring (using `--theme-brand-primary` and `--theme-symbol-card-glow`) when this `componentKey` is the active step's `highlight`
- Bump the wrapper's `z-index` to **90** when highlighted, so the target pokes through the backdrop

### Z-index bands

```
   0–70     app UI (TopBar uses inline z-index 70)
   80       ModellingBackdrop
   90       highlighted target (ModellingOverlayWrapper)
   95       ModellingAnnotation (reserved; lands in slice 5.4)
  100+      emergency UI — toasts, onboarding gate, modals (always above modelling)
```

Modals (`Dialog`, `PlayModal`, `SymbolEditorModal`, etc.) already use z-indexes ≥100 by convention. They retain priority over modelling so an instructor or student can dismiss an unrelated modal without exiting the session.

### Ancestor stacking-context risk

For the target's `z-index: 90` to escape above the backdrop, no ancestor in its DOM path may create a stacking context that itself sits below the backdrop. The three currently-wrapped targets (sidebar Categories item, category tile, symbol card on board) all have ancestors in normal flow with no `z-index` or `transform` — verified empirically. New highlightable surfaces added in the future should be checked for this. If a stacking-context conflict arises, the fix is to render the highlighted child via a React portal to `document.body` instead of bumping `z-index` in place.

---

## Consequences

- **Simpler `ModellingOverlayWrapper`.** No per-component overlay layer, no `pointer-events` toggle on the wrapper, no transition logic. Just `data-component-key`, optional glow ring, optional `z-index` bump.
- **No need to wrap non-target UI.** TopBar, breadcrumb, sidebar nav items, page banners, etc. dim "for free" because the viewport backdrop covers them. New navigable components added during later slices don't require a `ModellingOverlayWrapper` unless they're a modelling target.
- **Z-index bands 80–95 are reserved for modelling.** Any future component using inline `z-index` between 80 and 95 must justify it or change. A short comment in `ModellingOverlayWrapper.tsx` documents the bands.
- **Modals stay reachable during a session.** Toasts, onboarding gate, and modals at z-index ≥100 sit above the modelling layer. The instructor or student can interact with them without ending the session — important for unexpected interruptions.
- **Ancestor stacking-context risk is real but bounded.** Verified for the three current target types. A portal escape hatch is the documented fallback if a future target's ancestors block z-index escape.
- **Original spec section is now wrong.** `docs/1-inbox/ideas/04-modelling-mode.md` previously described the per-component approach. Updated alongside this ADR.

---

## Out of scope

- The mechanics of `ModellingAnnotation` (z-index 95, single `getBoundingClientRect()` per step change) — covered in the existing spec, not modified by this decision.
- Animation timing and reduce-motion behaviour — out of scope; lands in slice 5.4 alongside the annotation.
- Cancellation UX (Close button visibility above the backdrop) — slice 5.5/5.6 will introduce a Close control with its own z-index in the modelling band.

---

## References

- `app/components/app/shared/ui/ModellingBackdrop.tsx`
- `app/components/app/shared/ui/ModellingOverlayWrapper.tsx`
- `app/contexts/ModellingSessionContext.tsx`
- `docs/1-inbox/ideas/04-modelling-mode.md` — spec (updated to match this ADR)
- `docs/3-design/screens/category - board - modelling mode/` — Figma frames showing full-viewport dimming
- Foundation slice PR: [Phase 5 modelling-mode foundation](https://github.com/mohan-dev-ji/mo-speech-home/pull/2)
