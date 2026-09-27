# User stories · Layer 1: pages

What each page must do, and for whom. The behaviour in detail lives in the
linked spec. Acceptance criteria describe what a person sees and can do, not how
it's built.

**Users:** *instructor* (parent or carer) · *student* (AAC user) · *visitor*
(not signed in). See [`01-users.md`](01-users.md).

---

## FEAT-101 · Home · [spec](../4-builds/features/FEAT-101-home.md)

- As an **instructor**, I want one place to start from, so that I can get to my
  content or make something new without hunting.
- As an **instructor**, I want to create a category, list, sentence or symbol
  from Home, so that I don't have to find the right page first.
- As an **instructor**, I want Auto-match to find pictures for the words I
  type, so that a new board takes seconds, not an evening.

**Acceptance**

- Home shows the resource library, shortcuts to Categories, Lists, Sentences
  and Search, and four create cards.
- Creating something lands me where it was filed.
- Create a Symbol always opens the editor. I can pick a category, or make one
  there, before saving.
- On Free, every create card shows the upgrade prompt instead.
- If Home is hidden for a student, their view opens on the next page they're
  allowed.

## FEAT-102 · Search · [spec](../4-builds/features/FEAT-102-search.md)

- As a **student**, I want to find any symbol quickly, even one that isn't on
  my board, so that I can say what I need right now.
- As a **student**, I want to search by voice, so that I can find a word I
  can say but not spell.
- As an **instructor**, I want to save a search result into a category, so
  that a useful word stays on my child's board.
- As a **Hindi-speaking family**, I want to type Hindi in Latin letters, so
  that search works the way we type.

**Acceptance**

- Results appear as I type, in the board's language, including synonyms and
  transliterations. Exact words come first in English.
- Voice search works in every major browser, and says clearly why when it
  can't start.
- Tapping a result speaks it. With the talker on, it's also added to the
  sentence.
- **Personalise and save** opens the editor with the symbol loaded (Pro).
- A search with no results says so.

## FEAT-103 · Categories · [spec](../4-builds/features/FEAT-103-categories.md)

- As a **student**, I want my categories and symbols to stay where they are, so
  that I can find them by position.
- As a **student**, I want every symbol to speak when I tap it, so that I'm
  always heard.
- As an **instructor**, I want to build a category from a pasted list of words,
  so that I can make a new topic fast.
- As an **instructor**, I want each category to have its own colour, so that
  my child knows where they are at a glance.

**Acceptance**

- Tiles and symbols never move except in edit mode, by an adult.
- Every symbol speaks: its recording, the library's recording, or its label
  read aloud.
- A category's colour runs through its tile, board and symbols, whatever the
  theme.
- A new category opens in edit mode, ready to fill in missing pictures.
- Grid size (large, medium or small) is set per student.
- Deleting warns clearly, and pictures are kept in My Images.

## FEAT-104 · Lists · [spec](../4-builds/features/FEAT-104-lists.md)

- As an **instructor**, I want to break a routine into picture steps, so that
  my child can follow it independently.
- As an **instructor**, I want a First-Then board, so that I can use one of the
  most common supports without another tool.
- As a **student**, I want to see one step large and hear it, and tick it off,
  so that I know what to do and what I've done.

**Acceptance**

- A list shows as rows, columns or a grid, with Numbered, Checklist and First
  Then in any mix. The choice is saved with the list.
- Anyone viewing can change the layout, including a student.
- Tapping a step shows it full screen and speaks it.
- Each step's audio is its words read aloud, or a recording. Changing a step's
  picture never changes what it says.
- Ticks reset on a fresh visit.

## FEAT-105 · Sentences · [spec](../4-builds/features/FEAT-105-sentences.md)

- As a **student**, I want to say a whole sentence in one tap, so that I can
  keep up in conversation.
- As a **gestalt learner**, I want to hear a sentence in its parts **and** as a
  whole, so that I can learn how it's built.
- As a **student**, I want to say a sentence with feeling, so that people know
  how I feel, not just what I want.
- As a **bilingual family**, I want a sentence to have its own version in each
  language, so that the word order is right.

**Acceptance**

- Fluent sentences play as one clip. Block sentences play block by block, with
  each block lit as it speaks.
- A tone (angry, neutral or excited) plays the whole sentence fluently (Max).
- Sentences saved from the talker keep their phrases.
- Tapping "Made in" makes a version for the board's language, by translating
  or by hand.
- Sentences are organised into groups, with Drafts for unfiled ones.

## FEAT-106 · Settings · [spec](../4-builds/features/FEAT-106-settings.md)

- As an **instructor**, I want to give each child their own language, voice,
  look and permissions, so that one account suits every child.
- As an **instructor**, I want to open up pages and controls one at a time, so
  that my child's independence grows at their pace.
- As an **instructor**, I want to invite a partner, grandparent or carer, so
  that we work from the same boards (Max).
- As a **parent**, I want to see what's collected and switch it off, so that I
  can trust the app with my child.

**Acceptance**

- Each student has their own language, voice, theme, grid, labels, sidebar,
  header mode, and page and editing permissions.
- Settings is hidden from students unless allowed.
- Invites show whether they're waiting or accepted. Collaborators can't see
  billing or send invites.
- Image Search credits are listed, for images still in use.
- Account deletion asks for confirmation (type DELETE) and removes everything.

## FEAT-107 · Resource library · [spec](../4-builds/features/FEAT-107-resource-library.md)

- As an **instructor**, I want ready-made boards and routines, so that I don't
  start from nothing.
- As a **visitor**, I want to browse the library before signing up, so that I
  can see what I'd get.

**Acceptance**

- The library is public, with tabs for Categories, Lists and Sentences, and
  filters by plan.
- The button changes with who's looking: Sign up, Upgrade, Add to profile, or
  Already added.
- An added module arrives as a folder, is fully editable, and never changes
  when the library version is updated.
- Everything is available in every supported language.
- *(Planned, MOS-80.)* Signing up from a module adds it straight after
  sign-up.

## FEAT-108 · Pricing & tiers · [spec](../4-builds/features/FEAT-108-pricing-and-tiers.md)

- As a **family**, I want a free plan that's genuinely useful, so that my child
  can start today.
- As an **instructor**, I want to know exactly what each plan unlocks, so that I
  can choose.

**Acceptance**

- Free: SymbolStix symbols, search, tap and play, and building in the talker,
  but no saving, editing or modelling.
- Pro (£13.99): save, edit, create and model with SymbolStix.
- Max (£18.99): upload, Image Search, AI, My Images, tones, premium themes and
  invites.
- A locked action always shows an upgrade prompt, never a silent failure.
- Downgrading keeps content. A cancelled plan runs to the end of its period.

## FEAT-109 · Sign-up & onboarding · [spec](../4-builds/features/FEAT-109-sign-up-and-onboarding.md)

- As a **new family**, I want to sign up with just an email, so that there's no
  barrier.
- As a **new instructor**, I want the app ready to use as soon as I've named my
  child, so that we start communicating straight away.
- As an **invited carer**, I want to land on the family's boards, so that I
  don't set anything up.

**Acceptance**

- Sign-up needs no payment details, and starts on Free.
- The first-student window asks for name, language and an optional date of
  birth, and can't be skipped.
- The student's language becomes the account's language.
- The default boards arrive straight away, all SymbolStix, in that language.
- Invited people skip the welcome and join the inviting account.

## FEAT-110 · Public website · [spec](../4-builds/features/FEAT-110-public-website.md)

- As a **visitor**, I want to see the site in my language from the first
  screen, so that I feel it's for me.
- As a **visitor**, I want to understand what Mo Speech does and costs before
  signing up, so that I can decide.

**Acceptance**

- A first visit asks the language before anything else, and remembers it.
- The landing page, the pricing page and the library are public.
- *(M6.)* A features page tells the product story. Real copy replaces the
  placeholders.
- Signed-in visitors go to the app, or to Settings for billing.
