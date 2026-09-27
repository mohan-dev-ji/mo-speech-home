# FEAT-302 · Edit mode

**Layer 3 · Modes & looks** · [Back to the index](README.md)

- One idea, everywhere: tap **Edit** to change a surface, and **Exit Edit** to
  go back to tap-and-play
- Found at the top of every editable surface: categories, boards, lists,
  sentences, groups, core words and phrases
- The button turns orange while editing, so it's always obvious
- The same tools every time: drag to reorder, ✕ to delete, tap to edit,
  **Create** / **Add** for new things
- Pictures, words and audio are changed through the symbol editor and the
  audio window
- Out of edit mode, nothing can be moved or changed by accident

---

## What it does

Mo Speech has two states for everything a student uses: **tap and play**,
where taps speak, and **edit**, where the same things can be rearranged and
changed. Keeping them separate means a student's taps never move a symbol by
accident, and an instructor always knows when they're changing something.

### Turning it on and off

Every editable surface has an **Edit** button at the top: in the page's banner,
or at the top of the talker dropdown. Tapping it turns the surface into an
editing surface, and the button changes to an orange **Exit Edit**. Tapping it
again returns everything to tap-and-play.

Edit mode belongs to the page you're on. Moving to another page leaves it.

### What changes in edit mode

The same tools appear everywhere, so learning them once is enough:

| Tool | What it does |
|---|---|
| **Drag** | Reorder tiles, symbols, steps, sentences, blocks and groups. On a touchscreen: press, hold, then move |
| **✕** | Delete, always with a warning that says what will be lost |
| **Tap** | Open a symbol or picture in the symbol editor ([FEAT-203](FEAT-203-symbol-editor.md)) |
| **🔊 / audio** | Open the audio window, for list steps, fluent sentences and phrases |
| **Dashed title** | Rename in place |
| **Colour swatch** | Change a category's or group's colour |
| **Create / Add** | Make something new here: a category, a symbol, a list step, a group, a word or a phrase |
| **Translate / undo** | For your own content on a board in another language ([FEAT-305](FEAT-305-languages-and-voices.md)) |

### What it does

| Surface | In edit mode you can… |
|---|---|
| **Categories grid** ([FEAT-103](FEAT-103-categories.md)) | Reorder, rename, recolour, change cover pictures, delete, **Create category** |
| **A category board** ([FEAT-103](FEAT-103-categories.md)) | Reorder symbols, edit them, delete them, **Add Symbol** |
| **Groups** ([FEAT-205](FEAT-205-groups-and-folders.md)) | Create, rename, recolour, change cover pictures, reorder and delete groups |
| **A list** ([FEAT-104](FEAT-104-lists.md)) | Rename, add, reorder and remove steps, and set each step's picture and audio |
| **Sentences** ([FEAT-105](FEAT-105-sentences.md)) | Edit symbols, blocks and phrases, set audio, reorder, move to a group, delete |
| **Talker dropdown** ([FEAT-202](FEAT-202-talker-dropdown.md)) | Create, arrange and delete core words, and build and edit phrases |

On Search and Categories, the **Edit** button lives in the page banner, so it
shows when the talker is switched **off** (banner mode). See
[FEAT-201](FEAT-201-talker.md).

### New things land ready to edit

Creating a category or a list from its own page drops you inside it **already in
edit mode**, so any word Auto-match couldn't find a picture for can be filled in
straight away. (Creating from Home lands you on the new item without edit mode,
so you see it in place first. See [FEAT-101](FEAT-101-home.md).)

## Why it helps

- **Safety.** Tap-and-play can't move or change anything, so a student using
  the board can't disturb it, and neither can an instructor who only meant to
  tap.
- **Motor memory is protected.** Symbols only move when someone deliberately
  moves them in edit mode.
- **Learn it once.** The same button, the same colour and the same tools on
  every surface.
- **Clear state.** The orange Exit Edit makes it impossible to forget that
  you're editing.

## Audio

In edit mode, tapping a symbol opens it for editing instead of speaking it.
Audio itself is set in the symbol editor, or in the audio window for list
steps, fluent sentences and phrases. See [FEAT-203](FEAT-203-symbol-editor.md).

## Edge cases

- **Free accounts.** **Edit** opens the "Pro feature" upgrade prompt instead,
  so everything stays tap-and-play. See [FEAT-108](FEAT-108-pricing-and-tiers.md).
- **Students.** **Edit** only appears in a student's view if the instructor has
  switched on **Allow Editing** for them. See [FEAT-106](FEAT-106-settings.md).
- **No header.** If the header is switched off for a student, there's no
  banner, so there's no Edit button on Search or Categories. See
  [FEAT-206](FEAT-206-app-shell.md).
- **Modelling.** While a modelling session is running, the board stays in
  tap-and-play. See [FEAT-303](FEAT-303-modelling-mode.md).
- **Admin.** In the admin view, edit mode also shows publishing buttons
  (**Publish as module**, **Update module**) and a reminder when the content
  is already published. See [FEAT-402](FEAT-402-admin-authoring.md).

## Where it lives

- The Edit / Exit Edit button: `app/components/app/shared/ui/EditButton.tsx`
- The cluster of edit icons on tiles and symbols:
  `app/components/app/shared/ui/EditPanel.tsx` and `IconButton.tsx`
- The Create button: `app/components/app/shared/ui/CreateButton.tsx`
- Each surface's editing: its own page folder (see the links above)

## Links

- **Applies to:** [FEAT-103 Categories](FEAT-103-categories.md) ·
  [FEAT-104 Lists](FEAT-104-lists.md) · [FEAT-105 Sentences](FEAT-105-sentences.md)
  · [FEAT-202 Talker dropdown](FEAT-202-talker-dropdown.md) ·
  [FEAT-205 Groups & folders](FEAT-205-groups-and-folders.md)
- **Related:** [FEAT-203 Symbol editor](FEAT-203-symbol-editor.md) ·
  [FEAT-301 Instructor & student views](FEAT-301-instructor-and-student-views.md)
  · [FEAT-402 Admin authoring](FEAT-402-admin-authoring.md)
