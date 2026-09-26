# FEAT-104 · Lists

**Layer 1 · Page** · [Back to the index](README.md)

- Ordered steps, each with a picture, words and audio, for task analysis
- Organised into groups (folders), with Drafts for anything not yet filed
- Shown as rows, columns or a grid
- Switch on **Numbered**, **Checklist** or **First Then**, in any mix
- Tap a step to see it large and hear it read aloud
- Tick steps off as they're done
- Each step's audio can be read by the voice or recorded
- Create a list from typed steps, with Auto-match for the pictures
- Lists you write can be translated into the board's language

---

## What it does

A list breaks a task into steps: getting dressed, brushing teeth, going to the
shops. Each step has a picture, a short description and audio, so a student can
follow along one step at a time, as independently as they're able.

### Groups

Lists opens on its groups, the folders lists are kept in (for example "Life
skills" or "Going places"). Each group is a coloured tile, and the colour runs
through the group's page and its lists. **Drafts** holds lists that haven't been
filed yet. Open a group to see its lists, each shown with thumbnails of its
steps. Groups work the same way as sentence groups. See
[FEAT-205](FEAT-205-groups-and-folders.md).

### Viewing a list

Open a list to follow it. Two rows of controls sit above the steps.

**Layout:** **Rows**, **Columns** or **Grid**.

- Rows run top to bottom, one step per line, with room for longer
  descriptions.
- Columns sit side by side, left to right, like a visual schedule.
- Grid packs steps into tiles, for longer lists.

On a phone, lists always show as rows, because columns and grids don't fit a
narrow screen. The chosen layout comes back on a bigger screen.

**Styles**, which can be switched on in any combination:

- **Numbered** puts the step number on each step.
- **Checklist** adds a tick box to each step. A ticked step turns green.
- **First Then** labels the first step **First** and the rest **Then**. This is
  the classic "first work, then reward" support. A two-step list is a
  First-Then board.

The layout and styles are saved with the list, so it opens the same way next
time. They aren't behind edit mode: anyone viewing the list can change them,
including a student and a Free account. That's deliberate. A student can choose
how they like to see a list, and their choice sticks.

### Following a list

Tap a step and it fills the screen: a large picture, its words, its number or
First/Then label, and its tick box. The step's audio plays as it opens. Tap
outside to go back to the list. A student can go through a list step by step
like this, hearing each one, and tick each step off as it's done.

### Edit mode

**Edit** turns the list into an editable surface. See
[FEAT-302](FEAT-302-edit-mode.md).

- **Rename** the list in its title.
- **Add item** adds a step.
- **Type** each step's description.
- **Tap a step's picture** to open the symbol editor and choose a picture. Only
  the picture changes. The step keeps its words and audio. See
  [FEAT-203](FEAT-203-symbol-editor.md).
- **Audio** sets how the step sounds (below).
- **Drag** steps to reorder them, or **remove** one.

**Exit Edit** returns the list to follow-along mode.

On the groups page, edit mode also renames, recolours, reorders and deletes
groups, and moves a list into another group.

### Creating a list

**Create list** asks for a name, the steps (typed one per row) and which group
it goes in: an existing group, a new one, or Drafts. With Auto-match, each step
gets a picture found for its words, and the step keeps the words you typed.
You land inside the new list, in edit mode, so any step without a picture can be
filled in straight away.

### Languages

A list you wrote shows a "Made in" badge with its original language. On a board
in another language, it can be translated in one tap, either the whole list or
step by step, and each translation can be undone. Until it's translated, a step
shows and speaks in its original language, spoken by that language's voice.
Lists installed from the library come in every supported language already, so
they don't show the badge. See [FEAT-305](FEAT-305-languages-and-voices.md).

## Why it helps

- **Students** get visual, spoken support for everyday routines, and ticking
  steps off shows progress and builds independence.
- **First Then** gives one of the most-used supports in AAC and autism practice
  from any list, with no separate tool.
- **Instructors** can shape the same list for different students by switching
  its layout and styles, instead of rebuilding it.
- **Auto-match** turns a typed routine into a picture schedule in seconds.

## Audio

Each step's audio is its own. It's set from the **Audio** button in edit mode:

- **Read aloud** (the default): the step's description is spoken by the
  board's voice.
- **Recorded**: a human recording, such as the instructor's or a parent's own
  voice. It plays in place of the voice, whatever voice the board uses.

The picture never changes the audio. Choosing a new symbol for a step doesn't
change what it says. An untranslated step is spoken in its original language by
that language's voice, so English words on a Hindi board sound English, not
English read in a Hindi accent.

## Edge cases

- **Free accounts.** Viewing, playing and ticking lists all work. **Edit** and
  **Create** open the "Pro feature" upgrade prompt. See
  [FEAT-108](FEAT-108-pricing-and-tiers.md).
- **Students and editing.** In a student's view, editing only appears if the
  instructor allows that student to edit. See
  [FEAT-301](FEAT-301-instructor-and-student-views.md).
- **Ticks are for now.** Checklist ticks last while the list is open, and a
  fresh visit starts unticked, ready for the routine to be done again.
- **A step with no picture** shows a blank picture area, and still plays its
  audio.
- **Deleting a list** removes it for good, but any pictures it used stay in My
  Images. Deleting a group removes every list inside it, and the warning says
  how many.
- **Deleting a list from the library** loses any changes you made. It can be
  installed again from the Resource Library, as originally published. See
  [FEAT-107](FEAT-107-resource-library.md).
- **Lists hidden for a student.** The instructor can hide Lists from a
  student's view entirely.

## Where it lives

- The pages: `app/[locale]/(app)/lists/` (the groups, a group, and each list)
- Viewing, editing and the create window: `app/components/app/lists/`
- Groups are shared with Sentences: `app/components/app/shared/sections/GroupsView.tsx`

## Links

- **Down to:** [FEAT-203 Symbol editor](FEAT-203-symbol-editor.md) ·
  [FEAT-204 Play modal](FEAT-204-play-modal.md) ·
  [FEAT-205 Groups & folders](FEAT-205-groups-and-folders.md) ·
  [FEAT-302 Edit mode](FEAT-302-edit-mode.md)
- **Up from:** [FEAT-101 Home](FEAT-101-home.md) (Create a List)
- **Related:** [FEAT-105 Sentences](FEAT-105-sentences.md) (the same groups) ·
  [FEAT-107 Resource library](FEAT-107-resource-library.md) ·
  [FEAT-305 Languages & voices](FEAT-305-languages-and-voices.md) ·
  [FEAT-402 Admin authoring](FEAT-402-admin-authoring.md)
