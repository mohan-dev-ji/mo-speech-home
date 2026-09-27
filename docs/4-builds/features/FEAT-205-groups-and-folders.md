# FEAT-205 · Groups & folders

**Layer 2 · Component** · [Back to the index](README.md)

- Lists and sentences are kept in **groups**: coloured folders on a grid
- **Drafts** holds anything not yet filed
- A group's colour runs through its page and everything in it
- Create, rename, recolour, give a cover picture, reorder and delete groups
  in edit mode
- Move a list or sentence to another group at any time
- Every "create" and "save" asks which group to use
- A library module arrives as its own group
- Works the same way on Lists and Sentences

---

## What it does

Lists and sentences build up quickly: morning routines, school routines, things
to say at the shop, things to say at dinner. Groups keep them in order. A group
is a folder with a name, a colour and a cover picture, shown as a tile on the
page's opening grid.

Groups belong to **Lists** and **Sentences**, and work identically in both.
Categories don't use groups. Each category is already its own tile on the
categories grid. See [FEAT-103](FEAT-103-categories.md).

### The groups grid

**Lists** and **Sentences** each open on a grid of their groups: for example
"Life skills" and "Going places", or "Talking about food" and "At the shop".
Tap a group to open it and see its lists or sentences.

The group's **colour** tints its page (the banner and every list or sentence
card inside), so it's always clear which group you're in.

### Drafts

**Drafts** is where anything goes that hasn't been filed into a group yet. It
shows as its own tile on the grid, but only once it has something in it. Drafts
isn't a real group: it can't be renamed, recoloured or deleted. It's the "sort
it out later" pile.

### Choosing a group

Anywhere a list or sentence is made, a group picker asks where it goes:

- **an existing group**,
- **a new group**, named on the spot, or
- **Drafts**.

That covers **Create list** and **Create sentence** on their own pages and on
Home, and **Save** in the talker. The talker picks a sensible choice first: the
sentence group with the same name as the category you're in. See
[FEAT-101](FEAT-101-home.md) and [FEAT-201](FEAT-201-talker.md).

### Edit mode

**Edit** on the groups grid:

- **Create group:** give it a name.
- **Rename** a group in its dashed title box.
- **Pick a colour** from the swatch.
- **Change the cover picture** by tapping it, which opens the symbol editor
  for pictures only. See [FEAT-203](FEAT-203-symbol-editor.md).
- **Drag** groups to reorder them.
- **Delete** a group.

Inside a group, in edit mode, each list or sentence has **Move to group**,
which moves it to another group or back to Drafts.

### Languages

A group name you wrote shows a **"Made in"** badge on a board in another
language, with a one-tap translate and a way to undo it. Group names are never
translated automatically. Groups installed from the library already have their
names in every supported language. See [FEAT-305](FEAT-305-languages-and-voices.md).

### Library modules

A list or sentence module added from the resource library arrives as **its own
group**, ready to open. From then on it's like any other group. See
[FEAT-107](FEAT-107-resource-library.md).

## Why it helps

- **Instructors** can organise by routine, place or topic, and find things
  quickly as the collection grows.
- **Students** see a small number of big, coloured tiles instead of one long
  list, and the colour tells them where they are.
- **Nothing gets lost.** Anything not yet filed sits in Drafts, never nowhere.
- **One way of working.** Lists and sentences are organised identically, so
  learning one teaches the other.

## Audio

Groups don't speak. The lists and sentences inside them do. See
[FEAT-104](FEAT-104-lists.md) and [FEAT-105](FEAT-105-sentences.md).

## Edge cases

- **Free accounts.** Opening groups and using what's inside works. **Edit**
  and creating open the "Pro feature" upgrade prompt. See
  [FEAT-108](FEAT-108-pricing-and-tiers.md).
- **Deleting a group deletes what's in it.** The warning says how many lists or
  sentences go with it. Any pictures they used stay in My Images.
- **Deleting a library group** also loses any changes made to it. It can be
  added again from the Resource Library, as originally published.
- **A new group that fails to save** stops the list or sentence being created
  too, so nothing is ever filed into a group that doesn't exist.
- **An empty group** says "This group is empty." With no groups at all, the
  page invites you to create one.

## Where it lives

- The groups grid for Lists and Sentences: `app/components/app/shared/sections/GroupsView.tsx`
- The group tile (also used for category tiles):
  `app/components/app/shared/ui/GroupTile.tsx`
- The group picker used by create and save: `app/components/app/shared/ui/GroupPicker.tsx`

## Links

- **Up from:** [FEAT-104 Lists](FEAT-104-lists.md) · [FEAT-105 Sentences](FEAT-105-sentences.md)
- **Related:** [FEAT-101 Home](FEAT-101-home.md) · [FEAT-201 The talker](FEAT-201-talker.md)
  · [FEAT-107 Resource library](FEAT-107-resource-library.md) ·
  [FEAT-203 Symbol editor](FEAT-203-symbol-editor.md) ·
  [FEAT-302 Edit mode](FEAT-302-edit-mode.md)
