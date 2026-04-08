# Admin Library Page

## Build Priority — Read This First

**The admin library is not a day-one concern. Build the main app first.**

Designing the full admin library in Figma before the build starts is a significant time investment that risks being wasted — because building the main app will surface discoveries that change what the admin needs to be. The shared components that the library depends on will only be fully understood once they exist in the real codebase.

The founder is close to burnout from Figma. Special PTO has been allocated for the build and it should not be spent designing an admin section that:
- Won't be needed until the main app is working
- Will largely design itself once shared components exist
- Can be scaffolded by a coding agent from these specs when the time comes

**The plan:**
1. Start the build immediately using this document as context
2. Build shared components correctly from day one (see Shared Components section)
3. Admin library screens get designed and built alongside the build — not before it
4. Or the coding agent generates a functional admin UI from these specs when needed
5. The admin library is likely one of the last things built — and that is correct

Building the main app first is not a compromise. It is the right order. The admin library is a different skin on the same components. You cannot fully design the skin until the components exist.

---

## Overview

The admin library is the content management system for Mo Speech. Admins create, edit, preview, and publish everything users can load into their student's profile — resource packs, themes, standalone items, the core vocabulary set, and the default starter profile.

Structurally it is Mo Speech with a different header. The category grid, mode tabs, symbol cards, play modal, list editor, sentence editor, and first-then editor are all identical shared components. The only meaningful difference is the talker/banner header — in the admin it becomes a metadata input area instead of a sentence builder.

---

## Content Types Managed Here

| Type | What it is |
|---|---|
| **Resource Packs** | A category with accompanying lists, sentences, and first-thens |
| **Standalone Items** | Individual lists, sentences, or first-thens not part of a full pack |
| **Themes** | Flat, tiled, or animated visual palettes |
| **Core Vocabulary** | The symbols in the talker dropdown — global, affects all users |
| **Starter Profile Template** | The default categories loaded when a new student profile is created |

---

## Page Layout

Left sidebar selects the content type. Main area shows the list for the selected type.

```
┌─────────────────┬──────────────────────────────────────────────┐
│  LIBRARY        │  Resource Packs                       [+ New]│
│                 │────────────────────────────────────────────  │
│  Resource Packs │  🎃 Halloween Pack    Oct 1–Nov 1  🟢 Live   │
│  Themes         │  🌸 Spring Starter   Always        🟢 Live   │
│  Standalone     │  🚀 Space Explorer   Always        ⚪ Draft  │
│  Core Vocab     │  🎄 Christmas Pack   Dec 1–Jan 1   🔵 Sched  │
│  Starter Set    │                                              │
│                 │  Filter: [All ▼]  [Status ▼]  [Season ▼]   │
└─────────────────┴──────────────────────────────────────────────┘
```

Each list row shows: cover image, name, translation status, date range, status badge, and actions (Edit, Duplicate, Archive).

---

## Status Workflow

All content types follow the same lifecycle:

```
Draft → Scheduled → Live → Expired (auto) or Archived (manual)
```

Scheduled means a future `publishedAt` date — content goes live automatically. Critical for seasonal packs. The team prepares the Christmas pack in November, schedules it for 1 December, and nothing needs to happen on the day.

---

## Pack / Theme Editor — Full Page Layout

```
┌───────────────────────────┬────────────────────────┐
│  Edit Pack                │  Preview               │
│                           │                        │
│  Metadata fields          │  Language [English ▼]  │
│  (name, description,      │                        │
│   cover, season, dates)   │  [Real app components] │
│                           │  [Symbol grid]         │
│  ── Category ──           │  [Mode tabs]           │
│  [CategoryHeader          │  [Talker bar]          │
│   admin-metadata mode]    │  [Symbol cards]        │
│  [CategoryBoardGrid]      │                        │
│  [ModeSwitcher]           │  ← What admin sees     │
│                           │    is exactly what     │
│  ── Lists ──              │    the student sees    │
│  [ListEditor]             │                        │
│                           │                        │
│  ── Sentences ──          │                        │
│  [SentenceEditor]         │                        │
│                           │                        │
│  ── First Thens ──        │                        │
│  [FirstThenEditor]        │                        │
│                           │                        │
│  [Save Draft] [Publish]   │                        │
└───────────────────────────┴────────────────────────┘
```

The preview panel shows real shared components with the active theme applied. The preview language toggle (see Language section) lets admin switch between English and Hindi to quality-check content in both languages before publishing.

---

## Shared Components — The Full List

The admin library uses real app components throughout. This is only possible if components are built correctly from day one.

### Components shared between app and admin

```
/components/shared/
  SymbolCard.tsx              ← symbol image, label, display overrides
  CategoryBoardGrid.tsx       ← responsive symbol grid layout
  ModeSwitcher.tsx            ← Board / Lists / Sentences / First Thens tabs
  TalkerBar.tsx               ← sequence builder bar
  PlayModal.tsx               ← sequential symbol playback
  SymbolEditorModal.tsx       ← four-tab image picker, audio, display options
  ListEditor.tsx              ← ordered symbol sequence editor
  SentenceEditor.tsx          ← same as list with TTS audio generation
  FirstThenEditor.tsx         ← two-symbol picker
  CategoryHeader.tsx          ← see note below
```

### CategoryHeader.tsx — the key shared component

In the main app, this component is the talker/banner header. In the admin library editor, it is the pack metadata form. Same visual position in the layout, different content.

Build it with a `mode` prop from day one:

```typescript
<CategoryHeader mode="talker" />       // app — sentence builder
<CategoryHeader mode="banner" />       // app — simple header
<CategoryHeader mode="admin-metadata" /> // admin — name, icon, colour, description fields
```

One component, three modes. No duplication.

### The rule — shared components have no app-specific context dependencies

Shared components must accept props and callbacks only. They must have no dependency on:
- `PermissionContext`
- `ModellingSessionContext`
- `ProfileContext`
- Any other app-specific context

The app page wraps shared components in context. The admin page passes props directly. Both get the same component.

If shared components are built tangled into app-specific routes and contexts, importing them into admin becomes a significant refactor. Getting this right at scaffold time costs nothing and saves hours later. Tell the coding agent this explicitly when scaffolding.

### Components not imported into admin

- `ModellingOverlayWrapper` — no use case in admin
- Permission-gated wrappers — strip these; admin has its own access control

---

## Language in the Admin

There are three distinct language concerns. They are not the same thing.

### 1. Admin UI language — English only

The admin interface itself (menus, buttons, labels, field names) is English only. The admin team works in English. No need to translate the admin UI.

### 2. Content fields — both languages, side by side

Every content item has name and description fields in all supported languages. The edit form shows them together:

```
Name (English)  [Halloween Pack                    ]
Name (Hindi)    [हैलोवीन पैक                       ]
```

This is not a language switch — it is two text fields on the same form. Admin fills in both. If Hindi is left empty, the app falls back to English for users.

### 3. Preview panel language — switchable

The preview panel shows real app components, which render labels. A language toggle in the preview panel header lets admin switch the preview between English and Hindi:

```
Preview  [English ▼]
         [English  ]
         [हिंदी    ]
```

This is a quality-checking tool, not a translation tool. Admin switches to Hindi preview to verify:
- Symbol labels fit within card boundaries in Devanagari script
- The theme colour palette works with the visual weight of Devanagari text
- No Hindi labels are missing (showing fallback English is fine — seeing gaps is the point)

### Handling missing translations in the preview

When Hindi content is missing, the preview shows English as fallback with a small indicator badge on the affected card. Admin can see exactly which symbols and labels still need translation without the preview breaking entirely.

A translation status indicator on each library list row shows completion at a glance:

```
🎃 Halloween Pack    🇬🇧 ✅  🇮🇳 ⏳   Oct 1–Nov 1   🟢 Live
```

Tapping the ⏳ indicator jumps to the untranslated fields in the editor.

### Translation workflow for V1

Side-by-side fields with a preview language toggle and translation status indicators is the right infrastructure for V1. The actual translation workflow is a spreadsheet until volume demands something better. A future CSV export/import per language would help enormously — design this in when the admin library is being built, not before.

---

## Core Vocabulary Manager

Three tabs: Core Words / Numbers / Letters. Draggable symbol card list within each.

```
[Core Words]  [Numbers]  [Letters]

  ≡  [I]        symbol card    [remove]
  ≡  [want]     symbol card    [remove]
  ≡  [the]      symbol card    [remove]
  ...

  ⚠️ Changes to core vocabulary affect all users globally
  [Save Changes]
```

The warning is persistent — not just on save. This is the only admin screen editing shared global state rather than publishable content.

---

## Starter Profile Template Editor

Draggable list of default categories. Tapping a category expands the symbol grid editor.

```
  ≡  🟦 Things & Objects     42 symbols
  ≡  🟩 People               18 symbols
  ≡  🟨 Feelings             24 symbols
  ...

  ⚠️ Changes affect all new student profiles
  [Save Changes]  [Reset to Factory Default]
```

---

## Figma Design Approach

Given the build priority note at the top of this document, Figma design for the admin library should follow this approach:

**Design alongside the build, not before it.** As shared components are built in code, design the admin screens that use them. The components will reveal what the admin needs — trying to design the admin in isolation leads to screens that don't match the components they're supposed to use.

**Use the coding agent for initial scaffolding.** Once shared components exist, the agent can generate a functional admin library UI from these specs. This gives a working starting point that can be refined in Figma rather than designed from scratch.

**Prioritise the main app screens first.** The Figma screens that need to be designed and signed off before building are the main app screens — Home, Search, Categories, Boards, Modelling, Symbol Editor, Settings. The admin library screens can follow.

**Screens to eventually design (not now):**
- Library home with sidebar and list view
- Pack editor with live preview panel
- Theme editor with token inputs and live preview
- Core vocabulary manager (three tabs)
- Starter profile template editor
- Shared component states (Symbol Card, Play Modal, Talker Bar, Symbol Editor) — these are needed for the main app anyway
