# Mo Speech Home — Overview

## What It Is

Mo Speech Home is a full AAC (Augmentative and Alternative Communication) platform for families. A parent creates a child profile, builds a personalised symbol library organised into categories, and uses the app to communicate with and teach their non-verbal child. Every piece of content in the app — symbols, lists, sentences, first-thens — belongs to a category. The category is the universal parent container.

The app is one codebase, permission-layered. The parent sees edit controls, create functions, and settings. The child sees a filtered version of the same app controlled by state flags the parent sets.

---

## Tech Stack

- **Frontend**: Next.js 16 / React 19 / TypeScript / Tailwind CSS
- **Database + real-time**: Convex (`convex-home`)
- **Auth**: Clerk
- **Storage**: Cloudflare R2
- **Hosting**: Vercel
- **i18n**: next-intl v4
- **Payments**: Stripe (trial, monthly, yearly, portal, webhooks)

---

## Four Navigation Items

```
Home  |  Search  |  Categories  |  Settings
```

- **Home** — dashboard with recent categories, symbol history, create shortcuts, and resource library promotions
- **Search** — full SymbolStix voice + text search; the free tier anchor; talker header always present (talker-only, no banner toggle here)
- **Categories** — the primary AAC navigation; all categories with four modes each (Board, Lists, First Thens, Sentences)
- **Settings** — child permission management, language, voice, subscription

---

## Account Model

One subscription. One child profile. Multiple adult collaborators.

```
account (primary parent — Clerk + Stripe)
  ├── childProfile (the child — a profile, not a Clerk user)
  └── accountMembers (invited adults — each with their own Clerk login)
```

Any collaborator can use modelling mode. All collaborators share the same child profile and state settings.

---

## Key Architectural Decisions

- **Category as root** — everything hangs off `profileCategories`; no content exists outside a category
- **One app, permission-layered** — no separate child/parent routing trees; state flags control visibility
- **Fresh build, selective carry-over** — routing, layout, and context architecture rebuilt from scratch; Stripe, R2, service worker, and Convex schema foundation carried over from MVP
- **TypeScript throughout** — Convex generates types; use them end to end
- **Language-aware from day one** — no component ever hard-codes `"eng"`; all queries accept a `language` param
- **Two-tier audio** — mechanical Google Standard TTS for individual symbols (pre-generated, R2); natural Google Chirp 3 HD for sentences/lists (on-demand, cached to R2)
- **Three Convex projects** — `convex-home`, `convex-school`, `convex-identity`; cross-project calls via HTTP actions

---

## Connection to Mo Speech School

Mo Speech School is the second product — built after Home is proven. It serves teachers and classrooms rather than families. The two products are independent purchases but share a child identity layer (`convex-identity`) that allows:

- A child's profile to be linked across Home and School via an invite code
- The child to switch context between their home and school AAC setup
- Parents and teachers to view each other's profiles (read-only, on request)
- Categories, lists, sentences, and first-thens to be shared between Home and School via an inbox and staging area — human-approved, never automatic

School diverges from Home in account model (one teacher → many students), content ownership (teacher owns categories shared to class), and modelling (broadcast to multiple devices). It is best built as a refactor of Home, not from scratch.

Full detail: `07-home-school-connection.md`

---

## Document Index

```
00-overview.md                        ← this file
01-navigation-and-permissions.md      ← four nav items, state flags, permission system
02-categories.md                      ← categories as the root container, four modes
03-talker-and-play-modal.md           ← talker header component, play modal, banner state
04-modelling-mode.md                  ← real-time guided walkthrough, overlay system
05-symbol-editor.md                   ← create/edit symbol modal, four image tabs
06-resource-library.md                ← admin-curated packs, seasonal content, home dashboard
07-home-school-connection.md          ← shared child identity, context switching, sharing inbox
08-family-members.md                  ← inviting collaborators, account members model
09-child-profile.md                   ← child profile, state flags, language, home profile storage
10-audio-architecture.md              ← two-tier TTS, voice cloning, R2 structure
11-language-and-i18n.md               ← multi-language UI and symbols, next-intl, Hindi, fonts
12-convex-schema.md                   ← full schema across all three Convex projects
13-next16-setup.md              ← Next.js 16 specific setup, proxy.ts, next-intl v4
14-pricing-tiers.md             ← Free, Pro, Max tiers, Stripe setup, access control hook
15-themes.md                    ← Colour theme system, tiled and animated themes, token architecture
```
