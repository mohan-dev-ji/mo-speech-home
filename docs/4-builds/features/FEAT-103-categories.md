# FEAT-103 · Categories

**Layer 1 · Page** · [Back to the index](README.md)

- A grid of coloured tiles, each a category of related symbols
- Open a category to see its board of symbols
- Tap a symbol to hear it. With the talker on, it joins the sentence too
- Tiles and symbols stay where they're put, so students build motor memory
- In edit mode: reorder, rename, recolour, change the cover picture, add and
  delete
- Create a category from a typed or pasted list of words, with Auto-match
- Three grid sizes, set per student
- Symbols can be pinned to a language, for bilingual boards
- Start modelling from any board

---

## What it does

Categories group symbols into things that belong together: Food, Animals,
Feelings, Outside. It's the student's main board, and the page most students
spend their time on.

### The categories grid

Categories opens on a grid of tiles. Each tile has its colour, a cover picture
and a name. Tap a tile to open that category.

Once an instructor has arranged the tiles, they stay put. Nothing reshuffles by
itself, because an AAC user learns where things are by position as much as by
picture. A student who knows Food is "top left" can reach it without reading.

### A category board

Inside a category is its board: the symbols, each in a tile coloured to match
the category. Tapping a symbol depends on the talker switch in the top bar:

- **Talker off:** the symbol says its word. The banner at the top shows the
  category's name and picture, with **Edit** and **Modelling** buttons.
- **Talker on:** the symbol says its word **and** joins the sentence in the
  talker, which replaces the banner. A student can build a sentence by moving
  between categories. See [FEAT-201](FEAT-201-talker.md).

### Grid size

Each student can have a **large**, **medium** or **small** grid, set in their
profile. Large gives few, big tiles that are easy to hit. Small fits many more
on screen for a student with precise pointing. Both the categories grid and
each board follow the setting.

### Edit mode

Everything about arranging categories happens in edit mode, switched on with
**Edit** in the banner. See [FEAT-302](FEAT-302-edit-mode.md).

On the **categories grid**, in edit mode:

- **Drag** tiles to reorder them.
- **Rename** a category in its dashed title box.
- **Pick a colour** from the swatch. The colour runs through the tile, the
  board's banner and every symbol tile inside.
- **Change the cover picture** by tapping it. This opens the symbol editor to
  choose just a picture.
- **Delete** a category with its ✕.
- **Create category** opens the create window (below).

On a **category board**, in edit mode:

- **Drag** symbols to reorder them.
- **Tap a symbol** to open it in the symbol editor and change its picture,
  label, colours or audio. See [FEAT-203](FEAT-203-symbol-editor.md).
- **Add Symbol** opens the editor to make a new symbol here.
- **Delete** a symbol with its ✕.

**Exit Edit** returns the board to tap-and-play.

### Creating a category

**Create category** asks for a name and the words that belong in it. Type them
one per row, or paste a whole list separated by commas or on new lines. Tick
**Auto-match** (or **Auto-match all**) and Mo Speech finds a symbol for each
word. You land inside the new category, already in edit mode, so any word that
didn't find a picture can be tapped and filled in straight away.

### Languages on a board

Categories follow the board's language: names, labels and audio all switch
when the language does. Two extras help bilingual families:

- **Pinned symbols.** A symbol can be pinned to one language. It always shows
  and speaks that language, whatever the board is set to. That's useful for a
  word the family always says in, say, Punjabi, even on an English board.
- **Translate a name.** In edit mode, a category name you wrote yourself has a
  one-tap translate into the board's language, and a way to undo it.
  Categories installed from the library already come in every supported
  language, so they don't show this.

See [FEAT-305](FEAT-305-languages-and-voices.md).

### Modelling

A board's banner has a **Modelling** button. It starts a session where the
instructor shows the student which symbols to tap, step by step. It works on Pro
and Max. On Free the button is shown but switched off, with a note saying why.
In a student's view it's also switched off, unless the instructor has allowed
that student to start modelling themselves. See
[FEAT-303](FEAT-303-modelling-mode.md).

## Why it helps

- **Students** get a stable, colour-coded board they can learn by position, and
  every tap either speaks or builds a sentence.
- **Instructors** can build a new category in seconds from a pasted list, then
  tidy it on the board they just made.
- **Consistent colour** tells the student which category they're in at a
  glance, even deep inside a board.
- **Grid size per student** lets one account serve a student who needs big
  targets and another who wants everything on one screen.

## Audio

Every symbol speaks when tapped, in this order of preference:

1. A recording made or chosen for that symbol.
2. The library's recording of the word, in the board's voice.
3. For a symbol with its own picture (an upload, image search or AI picture)
   and no recording yet: the label is read aloud by the board's voice, so it's
   never silent.

A pinned symbol speaks in its pinned language's voice. Audio is set per symbol
in the symbol editor. See [FEAT-203](FEAT-203-symbol-editor.md).

## Edge cases

- **Free accounts.** Browsing, tapping and building sentences all work.
  **Edit** and **Create** open the "Pro feature" upgrade prompt instead, so
  nothing on the page can be changed. See
  [FEAT-108](FEAT-108-pricing-and-tiers.md).
- **Students and editing.** In a student's view, Edit and Create only appear if
  the instructor has allowed that student to edit. See
  [FEAT-301](FEAT-301-instructor-and-student-views.md).
- **Deleting a category you made.** It and all its symbols go, and this can't
  be undone. Every picture stays in My Images, so it can be used again.
- **Deleting a category from the library.** The warning says so: any changes
  you made to it are lost. It can be installed again from the Resource Library,
  but it comes back as it was originally published. See
  [FEAT-107](FEAT-107-resource-library.md).
- **Deleting a symbol.** Its picture stays in My Images, but any recording on it
  is deleted for good. If the same picture is used elsewhere, the warning says
  how many other items use it, and they're left alone.
- **A symbol with no picture yet.** It speaks its word when tapped, but isn't
  added to the talker until it has a picture. This is deliberate: every block
  in the talker needs a picture.
- **An empty category.** The board says "No symbols in this category yet."

## Where it lives

- The pages: `app/[locale]/(app)/categories/` (the grid, and each board)
- Page sections, the create window and the edit banner:
  `app/components/app/categories/`
- The shared tile used for category, list and sentence folders:
  `app/components/app/shared/ui/GroupTile.tsx`

## Links

- **Down to:** [FEAT-201 The talker](FEAT-201-talker.md) ·
  [FEAT-202 Talker dropdown](FEAT-202-talker-dropdown.md) ·
  [FEAT-203 Symbol editor](FEAT-203-symbol-editor.md) ·
  [FEAT-302 Edit mode](FEAT-302-edit-mode.md)
- **Up from:** [FEAT-101 Home](FEAT-101-home.md) ·
  [FEAT-102 Search](FEAT-102-search.md) (saving a search result into a
  category)
- **Related:** [FEAT-107 Resource library](FEAT-107-resource-library.md) ·
  [FEAT-303 Modelling mode](FEAT-303-modelling-mode.md) ·
  [FEAT-305 Languages & voices](FEAT-305-languages-and-voices.md) ·
  [FEAT-402 Admin authoring](FEAT-402-admin-authoring.md) (publishing a
  category as a module)
