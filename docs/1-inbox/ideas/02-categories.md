# Categories

## The Category as Root Container

The category is the universal parent container in Mo Speech Home. Every piece of AAC content belongs to a category. Nothing exists outside one.

```
profileCategory
  ├── profileSymbols     (the board — symbol grid)
  ├── profileLists       (pre-compiled lists for this topic)
  ├── profileSentences   (pre-built sentences for this topic)
  └── profileFirstThens  (first/then schedules for this topic)
```

A "pack" in the resource library is simply a category with its accompanying lists, sentences, and first-thens bundled together. There is no other container type.

---

## Category List Screen

The Categories nav item shows a grid of all the student's categories. Each category has a name, icon, and background colour. Tapping a category opens the Category Detail screen.

Default categories are pre-loaded from the Mo Speech resource library when a new profile is created. These are fully editable from day one — they are copied into the user's profile, not linked to the library.

---

## Category Detail — Four Modes

Each category has four modes, switchable via tabs at the top of the screen:

| Mode | Description | Talker header? |
|---|---|---|
| **Board** | Symbol grid — the primary AAC interaction surface | ✅ Yes |
| **Lists** | Pre-compiled lists for this category | ❌ No |
| **First Thens** | First/then visual schedules | ❌ No |
| **Sentences** | Pre-built sentences for this category | ❌ No |

The default mode when opening a category is Board.

---

## Board Mode

The Board is a grid of symbols. Each symbol is a `profileSymbol` record — the SymbolStix image, a label, and optional display/audio overrides.

The talker header sits at the top of the board. It can be in one of two states:

- **Talker state** — tapping a symbol adds it to the talker bar for sentence building
- **Banner state** — tapping a symbol plays its audio and enlarges it; no sentence building

The instructor sets the default state via permissions. If `talker_banner_toggle` is ON, the student can switch between the two states themselves using a toggle button in the header.

---

## Lists Mode

Pre-compiled lists of symbols for this category. Each list is an ordered set of `profileSymbol` references. Tapping a symbol in a list plays its audio. The play button sends the whole list to the Play Modal.

---

## First Thens Mode

Visual schedules showing a "First [X] Then [Y]" structure. Each first-then references two `profileSymbol` records. Useful for transition management and routine communication.

---

## Sentences Mode

Pre-built sentences stored as ordered symbol sequences. Similar to lists but semantically complete phrases rather than collections. The natural voice audio (Google Chirp 3 HD) is generated on first play and cached to R2.

---

## Category Colour System

`profileCategories.colour` stores a **Tailwind base colour name** — e.g. `"rose"`, `"sky"`, `"orange"`. A single value drives three surfaces:

| Surface | Value used |
|---|---|
| Category tab (folder tile + breadcrumb badge) | `{colour}-500` |
| Symbol hover border — all symbols in the category | `{colour}-500` |
| Symbol card background — all symbols in the category | `{colour}-100` |

Individual `profileSymbol.display.bgColour` / `display.borderColour` overrides still take precedence — the category colour is the default, not a hard override.

A static constant `CATEGORY_COLOURS` in `app/lib/categoryColours.ts` maps each allowed name to its hex pair (c500 + c100). All colour application uses `style={{ backgroundColor: hex }}` via this map — no dynamic Tailwind class names.

**Allowed colour names:** rose, pink, orange, amber, yellow, lime, green, teal, sky, blue, indigo, violet, purple, fuchsia, red, slate.

**Migration note:** `defaultCategorySymbols.ts` currently stores hex values (e.g. `#F97316`). Replace with named keys (`"orange"`) when the colour picker is wired.

---

## Mode Switcher

The category detail page has four modes switched by a compact tab bar in the **TopBar**:

```
[ Board ]  [ Lists ]  [ First Thens ]  [ Sentences ]
```

Tab visibility is gated by state flags:

| Tab | State flag | Default |
|---|---|---|
| Board | always visible | — |
| Lists | `lists_visible` | true |
| First Thens | `first_thens_visible` | true |
| Sentences | `sentences_visible` | true |

The Header toggle in the TopBar is only visible when Board mode is active — all other modes have no header.

Mode state is local — resets to Board on navigation away and back.

---

## Banner Mode

The header in banner state shows:

```
┌─ Banner card ────────────────────────────────────────────────────┐
│  [Category image]  Category name                  [pill toggle]  │
│                    [Model] [Edit]                                 │
└──────────────────────────────────────────────────────────────────┘
```

### Category image

Stored as `imagePath: v.optional(v.string())` on `profileCategories` (R2 path). This image:

- Displays in the banner (left side, ~80px square)
- Appears as the folder card image on the categories list screen (replacing the placeholder icon)
- Is editable only in edit mode

**Schema addition required:** `imagePath: v.optional(v.string())` on `profileCategories`.

### Visibility rules

| Element | Non-edit banner | Edit mode |
|---|---|---|
| Category image | ✅ | ✅ (editable — dashed border) |
| Category name | ✅ | ✅ |
| Category colour (tab/badge) | ✅ | ✅ |
| Colour picker | ❌ | ✅ |
| Model button | ✅ (disabled Phase 6) | ✅ |
| Edit / Done button | ✅ | ✅ |

---

## Board Mode — Edit State

Tapping **Edit** in the banner sets `isEditing = true` (local state, no URL change).

### Banner in edit mode

- **Category image** — gains orange SVG dashed border + tap-to-change overlay; tapping opens image picker (Phase 4)
- **Colour picker** — appears in the banner; renders swatches from `CATEGORY_COLOURS`; selected colour patches `profileCategories.colour` immediately
- Edit button reads "Done" to exit

### Symbol grid in edit mode

Every `SymbolCard` switches to `SymbolCardEditable`:

- **Shrink** — inner content padded ~p-3, creating a visual gap from the cell edge
- **Orange SVG dashed border** — `stroke: var(--theme-enter-mode)`, `strokeDasharray: "12 6"` (same pattern as CategoryTile)
- **Bottom overlay strip** — three icons: Pencil (→ SymbolEditorModal, Phase 4), Trash (→ delete with confirm), Grip (→ drag reorder)
- **"+ Add Symbol" tile** at end of grid (Phase 4)

---

## Creating and Editing Categories

Instructors can:
- Create a new category from scratch
- Load a category from the resource library (as a starting point)
- Rename, recolour, and change the icon of any category
- Add, remove, and reorder symbols within a category
- Delete a category (with confirmation — deletes all associated content and R2 assets)

The "Reload Defaults" option resets a library-sourced category back to its original state. This destroys all customisations and is shown with a destructive warning.

Full detail on symbol editing: `05-symbol-editor.md`
Full detail on the resource library: `06-resource-library.md`
