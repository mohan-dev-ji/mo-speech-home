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

The Categories nav item shows a grid of all the child's categories. Each category has a name, icon, and background colour. Tapping a category opens the Category Detail screen.

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

The parent sets the default state via permissions. If `talker_banner_toggle` is ON, the child can switch between the two states themselves using a toggle button in the header.

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

## Creating and Editing Categories

Parents can:
- Create a new category from scratch
- Load a category from the resource library (as a starting point)
- Rename, recolour, and change the icon of any category
- Add, remove, and reorder symbols within a category
- Delete a category (with confirmation — deletes all associated content and R2 assets)

The "Reload Defaults" option resets a library-sourced category back to its original state. This destroys all customisations and is shown with a destructive warning.

Full detail on symbol editing: `05-symbol-editor.md`
Full detail on the resource library: `06-resource-library.md`
