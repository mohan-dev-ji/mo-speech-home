# ADR-004 — Persistent Global Talker

**Date:** 2026-04-23
**Status:** Accepted

---

## Context

The talker (sentence builder bar) was implemented as local component state inside `CategoryDetailContent`. This caused two problems:

1. **The sentence buffer is lost on navigation.** A student taps three symbols, navigates back to the categories list to find another word, and the sentence is gone. This is fundamentally broken for AAC use — building a sentence routinely requires moving between screens.

2. **The talker does not exist on most pages.** The categories list page (`CategoriesContent`) renders a `PageBanner` instead of a talker. The search page gets a talker but it owns its own independent buffer. There is no continuity between pages.

The correct reference behaviour is a dedicated AAC device: the sentence builder bar is always visible at the top of the screen and its contents survive navigation completely.

---

## Decision

### 1 — Move the sentence buffer to a global TalkerContext

A new `TalkerContext` (or an extension of `ProfileContext`) holds `talkerSymbols: TalkerSymbolItem[]` and exposes `addToTalker`, `removeFromTalker`, `clearTalker`, and `setTalkerMode` actions. Any page that can add symbols writes to this shared buffer. Navigating between pages does not affect it.

### 2 — Move TalkerSection render to the app layout shell

The `TalkerSection` / `Header` component moves from individual page components into the app layout (the shell wrapping all app pages). It renders above the page content whenever `stateFlags.talker_visible` is true.

Pages stop owning the talker. A category detail page calls `addToTalker()` from context; the layout renders the result.

### 3 — Category-specific data flows through context, not props

The current `Header` props `categoryName`, `categoryImagePath`, `categoryColour`, and `onEditCategory` exist because the header was owned by the category detail page. In the layout, there is no category. These props are removed from the layout-level talker.

The category name/colour is handled by a thin `CategoryPageHeader` component that renders at the top of the category detail board — separate from the talker, not part of it. Banner mode (direct-play without sentence building) is controlled by the global `talkerMode` flag rather than a local prop.

### 4 — Toggle hierarchy

Two independent controls govern the talker:

| Toggle | Location | What it does |
|---|---|---|
| **Header on/off** | QuickSettings (existing `talker_visible` flag) | Master switch. Hides the entire talker bar across all pages. When OFF, no sentence bar is rendered anywhere. |
| **Talker / Banner mode** | QuickSettings (new, replaces the in-header pill) | Sub-mode for the visible header. `talker` = sentence builder; `banner` = direct-play (tapping a symbol plays its audio immediately, nothing is added to the sentence). Only active / enabled in Quick Settings when Header is ON. |

The in-header pill toggle (previously inside `Header.tsx`) is removed. Mode switching moves entirely to QuickSettings so the toggle hierarchy is explicit and centrally managed.

The `talker_banner_toggle` state flag continues to control whether the student can change the mode themselves. When OFF, only the instructor can change it via QuickSettings.

---

## Consequences

- `TalkerContext` is a new context provider added to the app layout tree, above all page components.
- `CategoryDetailContent` no longer owns `talkerSymbols`, `headerMode`, or their related handlers — these move to context.
- `CategoriesContent` no longer renders a `PageBanner` when the talker is visible — the layout-level talker handles the header area.
- `Header.tsx` loses `categoryName`, `categoryImagePath`, `categoryColour`, `onEditCategory`, `showToggle`, `mode`, and `onToggleMode` props. It becomes a pure talker display.
- A new `CategoryPageHeader` component handles the category name display on the detail page.
- `QuickSettings` gains a second toggle row for Talker/Banner mode, rendered only when `talker_visible` is true.
- The search page continues to show the talker (no change in behaviour — the talker was already visible there, it just now shares the same global buffer).
- `BannerEdit` (edit mode for category metadata) remains unchanged — it is triggered from the `CategoryPageHeader`, not from the talker.
