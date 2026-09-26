# Mo Speech features

What Mo Speech does today, one capability per spec, written for people rather
than for code review. Marketing, new developers and AI agents all start here.

## How the numbering works

The number tells you how deep you are. The first digit is the **layer**. The
higher the number, the further you are from the screen someone first opens and
the closer you are to the machinery underneath it.

| Layer | Numbers | What lives here |
|---|---|---|
| **1 · Pages** | FEAT-1NN | The places people go: every major touch point in the app |
| **2 · Components** | FEAT-2NN | The big building blocks those pages share |
| **3 · Modes & looks** | FEAT-3NN | Ways the whole app changes how it behaves or looks |
| **4 · Admin** | FEAT-4NN | Behind the scenes: running the product and its content |

Read the layers top down. A page spec tells you what someone sees and links
down to the components it uses. A component spec links back up to every page it
appears on. Each layer has room for 99 specs, so a new one takes the next free
number in its layer and nothing ever needs renumbering.

Filenames follow `FEAT-NNN-short-slug.md`.

## Index

### 1 · Pages: where people go

| # | Feature | In one line | Uses |
|---|---|---|---|
| [FEAT-101](FEAT-101-home.md) | Home | The starting screen: shortcuts into every part of the app, and quick ways to create | 107, 203, 205, 206 |
| [FEAT-102](FEAT-102-search.md) | Search | Find any symbol as you type or speak, then tap it to say it or save it into a category | 201, 203 |
| [FEAT-103](FEAT-103-categories.md) | Categories | A grid of coloured tiles grouping symbols, kept in place so students build motor memory | 201, 202, 203, 302 |
| [FEAT-104](FEAT-104-lists.md) | Lists | Ordered steps with audio for task analysis, shown as rows, columns or a grid, numbered, first-then or ticked | 203, 204, 205, 302 |
| [FEAT-105](FEAT-105-sentences.md) | Sentences | Whole sentences that play aloud: fluent sentences in one voice, or block sentences a phrase at a time | 201, 203, 204, 205, 302 |
| [FEAT-106](FEAT-106-settings.md) | Settings | Student profiles, the instructor's profile, inviting home and school, account and billing, image credits, and privacy and account deletion | 108, 301 |
| [FEAT-107](FEAT-107-resource-library.md) | Resource library | Ready-made categories, lists and sentences to add in one tap | 108, 402 |
| [FEAT-108](FEAT-108-pricing-and-tiers.md) | Pricing & tiers | Free, Pro and Max (a Starter tier is being decided in MOS-49): what each plan unlocks, how locked features show themselves, and how to upgrade | — |
| [FEAT-109](FEAT-109-sign-up-and-onboarding.md) | Sign-up & onboarding | From creating an account to a first student with a ready-made board | 106, 301 |
| [FEAT-110](FEAT-110-public-website.md) | Public website | What anyone can see without signing in: the landing page, pricing and the public library | 107, 108 |

### 2 · Components: the building blocks

| # | Feature | In one line | Used on |
|---|---|---|---|
| [FEAT-201](FEAT-201-talker.md) | The talker | The bar that turns taps into a sentence, block by block, then plays it or saves it | 102, 103, 105 |
| [FEAT-202](FEAT-202-talker-dropdown.md) | Talker dropdown: core words & phrases | Two tabs of ready words and phrases, always one tap away while building a sentence | 201 |
| [FEAT-203](FEAT-203-symbol-editor.md) | Symbol editor | Change any symbol's picture, label and audio. Pictures come from five tabs: SymbolStix, Upload, Image Search, AI Generate and My Images | 102, 103, 104, 105, 202 |
| [FEAT-204](FEAT-204-play-modal.md) | Play modal | Where sentences, lists and phrases play out loud, block by block, in a calm, excited or angry tone | 104, 105, 201, 202 |
| [FEAT-205](FEAT-205-groups-and-folders.md) | Groups & folders | Organising lists and sentences into folders, the same way on every page | 104, 105 |
| [FEAT-206](FEAT-206-app-shell.md) | App shell | The top bar and sidebar on every page: the view switcher, the talker toggle and quick settings | everything |

### 3 · Modes & looks: how the app changes

| # | Feature | In one line | Applies to |
|---|---|---|---|
| [FEAT-301](FEAT-301-instructor-and-student-views.md) | Instructor & student views | The instructor controls what each student's view can see and change, and can lock it with a PIN | everything |
| [FEAT-302](FEAT-302-edit-mode.md) | Edit mode | One switch above every editable surface for reordering, pictures and audio, then back to tap-and-play | 103, 104, 105, 202 |
| [FEAT-303](FEAT-303-modelling-mode.md) | Modelling mode | The instructor shows the student where to tap, step by step | 103, 201 |
| [FEAT-304](FEAT-304-themes.md) | Themes | Colours and backgrounds chosen per student profile | everything |
| [FEAT-305](FEAT-305-languages-and-voices.md) | Languages & voices | Switch the board language and voice. Symbols, labels and audio follow, and your own content can be translated | everything |

### 4 · Admin: behind the scenes

Not customer facing. Only accounts with the admin role see any of this.

| # | Feature | In one line | Feeds |
|---|---|---|---|
| [FEAT-401](FEAT-401-admin-dashboard.md) | Admin dashboard | The overview, and the admin view of the app | 402–408 |
| [FEAT-402](FEAT-402-admin-authoring.md) | Admin authoring | Build content in the app itself and publish it as a sign-up default or a library module for a tier | 107, 109 |
| [FEAT-403](FEAT-403-backup-and-restore.md) | Backup & restore | Published content is mirrored to files in git and can be restored from them | 402 |
| [FEAT-404](FEAT-404-translation-pipeline.md) | Translation pipeline | Machine translation of the app's words and the symbol library into each new language | 305, 406 |
| [FEAT-405](FEAT-405-users-admin.md) | Users admin | Look up any account, its plan and its access | 108 |
| [FEAT-406](FEAT-406-languages-admin.md) | Languages admin | Add a language and control when it goes live | 305 |
| [FEAT-407](FEAT-407-themes-admin.md) | Themes admin | Manage which themes exist and who can use them | 304 |
| [FEAT-408](FEAT-408-product-analytics.md) | Product analytics | What usage is measured, and why | — |

## Writing a spec

Each spec opens with a bullet list of what it covers, so it can be scanned in
seconds. Then it covers:

- **What it does**, told as the journey someone takes through it.
- **Why it helps**: the instructor, the student, or both.
- **Audio**: how audio behaves here. There is no separate audio spec, because
  audio works slightly differently in each place (a symbol, a list item, a
  phrase, the play modal's tones). Each spec describes its own.
- **Edge cases**: what happens at the boundaries.
- **Where the code lives**: a few paths, not a code review.
- **Links** up to the pages that use it and down to the components it's built
  from.

Sources, in order of trust: the app as it works today, the owner brief, then
the ADRs in [`../decisions/`](../decisions/). Never use `1-inbox/ideas/`: those
are the origin ideas and much of them has since changed.
