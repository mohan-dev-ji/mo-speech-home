# FEAT-101 · Home

**Layer 1 · Page** · [Back to the index](README.md)

- The first screen after signing in
- A banner into the resource library
- Four shortcuts: Categories, Lists, Sentences and Search Symbols
- Four quick-create cards: a symbol, a category, a list or a sentence
- Auto-match fills in pictures for the words you type
- Every new item takes you straight to where it was filed
- Free accounts see an upgrade prompt instead of creating
- It can be hidden in a student's view

---

## What it does

Home is where Mo Speech opens. Anyone who signs in, and every new account after
sign-up, lands here. It's a calm starting point with three rows: one way into
ready-made content, four ways into your own content, and four ways to make
something new.

### The resource library banner

A wide banner across the top reads "Resource library: Browse and install
ready-made modules". It opens the library, where categories, lists, sentences
and phrases made by Mo Speech can be added to a student's board in one tap. For
now it's a single banner. It's planned to become a carousel of featured
modules.

### Shortcuts

Below the banner, four cards take you to the main pages: **Categories**,
**Lists**, **Sentences** and **Search Symbols**. They go to the same places as
the sidebar, but are larger and easier to hit, which suits a tablet held by a
busy parent.

### Quick-create cards

The bottom row has four "+" cards. Each opens the same create window the
matching page uses, so creating from Home works the same as creating anywhere
else.

- **Create a Category.** Give it a name, then type the words that belong in it,
  one per row. You can paste a whole list at once, separated by commas or on
  new lines. Tick **Auto-match** on a word, or use **Auto-match all**, and Mo
  Speech finds a symbol for each word. You then land on the new category.
- **Create a List.** Name the list and describe each step. Auto-match gives
  each step a picture, while the step keeps the words you typed. Choose where
  the list goes: an existing folder, a new folder, or **Drafts** to sort out
  later. You land in that folder.
- **Create a Sentence.** Type the sentence and choose its folder in the same
  way. With Auto-match on, each word gets its own symbol and the sentence is
  built for you. You land in the folder you chose.
- **Create a Symbol.** Opens the symbol editor to make one symbol. Before
  saving, pick the category it goes into, or make a new one on the spot with
  **+ New category**. You land in that category.

New items are always created in the board's current language, so a sentence
created while the board is in Hindi is a Hindi sentence.

## Why it helps

- **Instructors** get one place to start the day: jump into content that's
  already there, or make something new in a few taps without first working out
  which page it belongs on.
- **Auto-match** takes much of the work out of building a new board. Typing
  "dog, cat, horse" gives three symbols ready to use.
- **Landing where the item went**, rather than inside it, shows the new item in
  its place with its neighbours. Edit mode is one tap away if you want to
  change it.
- **Students** only see Home if the instructor allows it. When they do, they
  get the same create cards, so an instructor can hand over creating as a
  student grows.

## Audio

Home plays nothing itself. Symbols made here get their audio the usual way,
from the symbol library or the chosen voice (see
[FEAT-203](FEAT-203-symbol-editor.md)).

## Edge cases

- **Free accounts.** Creating is part of Pro and Max, so on a Free account each
  create card opens an upgrade prompt ("Pro feature", with "See plans" and
  "Maybe later") instead of a create window. The banner and shortcuts work for
  everyone. See [FEAT-108](FEAT-108-pricing-and-tiers.md).
- **No categories yet.** Create a Symbol still opens the editor. Save stays
  blocked ("Please select a category.") until a category is chosen, and
  **+ New category** makes the first one without leaving the editor.
- **A new folder that fails.** When a list or sentence goes into a new folder,
  the folder is made first. If that fails, nothing is created, so an item is
  never left without a home.
- **Home hidden for a student.** If an instructor turns Home off for a student,
  the student's view opens on the first page they are allowed to see instead:
  Search, Categories, Lists or Settings, in that order. See
  [FEAT-301](FEAT-301-instructor-and-student-views.md).
- **Auto-match finds nothing.** A word with no match becomes a blank tile
  showing just the word. Add a picture later in the symbol editor.

## Where it lives

- The page: `app/[locale]/(app)/home/`
- Its sections (banner, shortcuts, create cards): `app/components/app/home/`
- The create windows are reused from the Categories, Lists and Sentences pages.

## Links

- **Down to:** [FEAT-107 Resource library](FEAT-107-resource-library.md) ·
  [FEAT-203 Symbol editor](FEAT-203-symbol-editor.md) ·
  [FEAT-205 Groups & folders](FEAT-205-groups-and-folders.md) ·
  [FEAT-206 App shell](FEAT-206-app-shell.md)
- **Across to:** [FEAT-103 Categories](FEAT-103-categories.md) ·
  [FEAT-104 Lists](FEAT-104-lists.md) · [FEAT-105 Sentences](FEAT-105-sentences.md)
  · [FEAT-102 Search](FEAT-102-search.md)
- **Related:** [FEAT-108 Pricing & tiers](FEAT-108-pricing-and-tiers.md) ·
  [FEAT-301 Instructor & student views](FEAT-301-instructor-and-student-views.md)
