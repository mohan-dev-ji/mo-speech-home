# Mo Speech Home — Full Build Overview

**Purpose of this document**: Give an agent enough context to assess whether the existing MVP codebase should be extended or whether a fresh build is the right call for the full product.

---

## What the MVP Is

The current codebase is a **symbol search and playback tool**. A single-mode web app where a user searches the 58,000-symbol SymbolStix library by voice or text, builds a sequence of symbols in a top bar, and plays them back fullscreen with audio. There is one user type, one screen, and no concept of categories, lists, children, or instructors.

**MVP tech stack:**
- Next.js 14 / React 18 / Tailwind CSS
- Convex (database + real-time subscriptions)
- Clerk (auth)
- Cloudflare R2 (symbol images + audio files)
- Vercel (hosting)

**What the MVP does well:**
- Clean Next.js App Router structure
- Convex schema already has `symbols` and `users` tables; recent symbols stored as an array field within `users` (not a separate table), capped at 100 items
- Stripe subscription flow fully implemented (trial, monthly, yearly, portal, webhooks)
- Admin dashboard built (user management, custom access grants)
- Service worker audio caching implemented
- Clerk auth middleware working across protected routes

**MVP technical debt worth noting:**
- No TypeScript (JSX throughout, Convex has generated types)
- R2 asset delivery proxied through Next.js API routes — every image and audio file streams through a serverless function instead of being served direct from R2 via pre-signed URLs; adds latency and Vercel function invocations per asset
- No automated tests
- All symbols loaded client-side at once (no pagination)
- No error boundaries
- Image optimisation disabled
- Single-mode, single-screen — no concept of permissions, categories, or multi-section navigation

---

## Two Products, One Codebase Foundation

The full build is not one product — it is two distinct products with a shared technical foundation.

### Mo Speech Home
**The first product to build.** Parent and child at home. One-to-one. The child is a named profile under the parent's account — they do not have their own Clerk login. The parent (and any invited collaborators such as a second parent or grandparent) act as instructors. Used for both guided modelling sessions and daily communication.

### Mo Speech School
**The second product — built after Home is proven.** Teacher and class. One-to-many. Students join via an invite link. The teacher owns the categories and content, shared across the whole class. Modelling can push to one student or broadcast to all simultaneously. Different pricing model (per-teacher subscription with unlimited students).

**Why build Home first:**
- Simpler account model (one-to-one vs one-to-many)
- Closer to the founder's lived experience and existing user base
- Modelling mode is equally compelling — arguably more so — in the home context
- School product can be cloned and refactored from Home once the core AAC experience is proven
- The schema, component architecture, and modelling system all carry over; only the account model and class management layer changes

---

## Mo Speech Home — Account Model

One subscription. One child profile. Multiple adult collaborators.

```
account (subscription holder — primary parent)
  └── childProfile (the child's AAC profile)
  └── accountMembers (invited collaborators: second parent, grandparent, sibling)
```

- The **account owner** creates the child's profile and holds the Stripe subscription
- Additional adults are invited by email and get their own Clerk login
- All collaborators share the same child profile, the same categories, and the same state settings
- Any collaborator can run modelling mode — mum at home, dad at the weekend, grandparent on Sunday
- The child does **not** have their own Clerk account — they are a profile, not a user
- `childProfile` holds all state flags — there is no separate `studentStates` relationship table in Home

**Mo Speech School schema divergence (for reference):**
School inverts this entirely. A `teacher` account owns `studentProfiles` (many). Students join via a `classMembers` join table. Categories are owned by the teacher and shared to the class. The schema is genuinely different and should be built as a separate refactor of Home, not bolted onto it.

---

## One App, Permission-Layered

Within Mo Speech Home there are no separate routing trees for parent and child. It is one app where the parent (instructor) sees additional UI — edit controls, create functions, and settings. The child sees a permission-filtered version of the same app based on state flags set by the parent.

---

## Navigation — Four Items

```
Home  |  Search  |  Categories  |  Settings
```

### Home
Quick-access dashboard. Shows recent categories, symbol history, and create shortcuts (new list, new sentence, new symbol, etc.). Parent sees all create functions; child visibility is permission-controlled.

### Search
The full MVP search engine carried forward. Voice + text search across the 58,000-symbol SymbolStix library.

- This is the **free tier anchor** — search remains available on the free plan
- The talker header component is always present but can be hidden
- The talker on search is **talker-only** — no banner state toggle
- Tapping a search result opens the **Create Symbol modal** (parent only) to customise and save to a category
- Children tap a result to play/preview only

### Categories
Central symbol navigation. All symbols organised by classic AAC categories (Things, Places, People, Feelings, Actions, etc.).

**Symbol source:** Mix of default SymbolStix symbols (pre-organised by library categories) plus any custom symbols the parent has added.

Each category has four modes, switchable via tabs:

| Mode | Description | Talker header? |
|---|---|---|
| **Board** | Symbol grid — primary AAC interaction surface | ✅ Yes — talker or banner |
| **Lists** | Pre-compiled lists for this category | ❌ No |
| **First Thens** | First/then visual schedules | ❌ No |
| **Sentences** | Pre-built sentences for this category | ❌ No |

### Settings
Parent-facing configuration. Child permission management (state flag controls), language selection, voice settings, subscription management.

---

## The Talker Header Component

Shared component used on Search and Category/Board. Behaviour differs by context:

| Context | Hideable | Banner toggle |
|---|---|---|
| Search page | Yes | No — talker only |
| Category / Board mode | Yes | Yes — talker ↔ banner |

**Talker state:** Tap a symbol → adds to bar for sentence building. Play button → Play Modal.
**Banner state:** Tap a symbol → plays audio and enlarges. No sentence building.

---

## Play Modal

Triggered from the talker play button or from a Board in banner state. One enlarged symbol at a time with audio. Full sequence as thumbnails below for visual context. Shared across all surfaces.

---

## State System

Parent controls boolean flags per child profile stored in Convex. Changes propagate instantly via subscriptions.

**Key state flags:**
- `home_visible` — whether child sees the home dashboard
- `search_visible` — whether search is accessible
- `categories_visible` — whether categories is accessible
- `settings_visible` — whether child can access settings
- `talker_visible` — whether talker header shows (search + board)
- `talker_banner_toggle` — whether child can switch talker ↔ banner in board mode
- `play_modal_visible` — whether play button is available
- `voice_input_enabled` — whether microphone is active
- `audio_autoplay` — whether audio fires on symbol tap
- `modelling_push` — whether parent can push modelling sessions

---

## Modelling Mode

Real-time, synchronised, interactive guided walkthrough across two devices. Full technical specification to be documented in a dedicated modelling ADR for the new build.

**Summary:**
1. Parent selects a symbol, confirms, triggers session
2. Convex creates a `modellingSession` with pre-computed navigation steps
3. Child's app receives session instantly via Convex subscription
4. Child's screen enters guided walkthrough — per-component black overlay divs cover everything except the active target, which glows
5. `ModellingAnnotation` (arrow + symbol + label) appears left or right of the target based on screen position
6. Child taps highlighted component → `currentStep` advances → both screens update simultaneously
7. Parent mirrors child's progress in real time
8. Success animation fires; both devices return to where they were

**Key technical decisions:**
- Dimming via per-component black overlay divs — not opacity on the component (avoids colour bleed and opacity inheritance)
- Inactive components get `pointer-events-none` to prevent tap-through
- Annotation: single `getBoundingClientRect()` per step change; left/right based on target centre vs 50% viewport width

---

## Audio Architecture — Two-Tier System

Mo Speech uses two distinct voice types serving different purposes. This is a deliberate product decision, not a cost compromise.

### Tier 1 — Individual Symbols (Mechanical, Pre-generated)
- **Voice:** Google Standard TTS (the same API used in the MVP)
- **Method:** Pre-generated once, stored in R2, served forever
- **Why mechanical:** Deliberate. Clear, unambiguous pronunciation aids processing for users who struggle with communication. Consistency matters more than naturalness for single words.
- **Cost:** Effectively zero — generated once, stored in R2
- **Languages:** Must be re-run per language (same script, different language code, different R2 folder)

### Tier 2 — Sentences, Lists, First Thens (Natural, On-demand)
- **Voice:** Google Cloud Chirp 3 HD (primary recommendation) or ElevenLabs
- **Method:** On-demand API call on first use → audio cached in R2 → all subsequent plays hit R2 directly
- **Why natural:** Sentences and lists are conversational. A child hearing "Time to brush your teeth" or "I want to go to the park" should hear something warm and human, not robotic
- **Cache key structure:** `sentences/{language}/{hash-of-text}.mp3` — generate once, reuse indefinitely
- **Cost model:** Pay only for generation of new content. An instructor creates a sentence once; R2 serves it forever after

### Why Google Chirp 3 HD over ElevenLabs (for now)
- Already in the Google Cloud ecosystem — same credentials, same billing, no new vendor
- Pay-per-character with no subscription lock-in — better for early stage
- Quality has genuinely closed the gap with ElevenLabs
- Swapping providers later is an environment variable change — the architecture is identical

### Voice Cloning — Future Premium Feature

Both ElevenLabs and Mistral's new Voxtral TTS (released March 2026, open-weight) support voice cloning from 2–3 seconds of audio. Two compelling future premium features:

**Parent voice:** The child hears sentences spoken in their parent's voice. Emotionally significant for non-verbal children — familiar, warm, and personal.

**Child's own voice:** The most profound version. Capture whatever vocalisations the child makes — or record them reading words — and synthesise all sentences in *their own voice*. This is a feature that dedicated AAC devices charge thousands of pounds for. At Mo Speech's price point with modern TTS, it becomes accessible. Positioned as a premium tier feature for Mo Speech Home.

### Voxtral TTS (Watch This Space)
Mistral released Voxtral TTS on 26 March 2026 — five days ago at time of writing. Open-weight, 4B parameters, runs on consumer hardware, achieved a 68.4% win rate over ElevenLabs Flash v2.5 in human evaluations. Commercial API pricing not yet fully established. The architecture above works with any provider — Voxtral is worth evaluating seriously once it stabilises.

---

## Language Support

### Architecture approach
Language is a **data problem, not a UI problem.** The app UI does not change language — only symbol labels and audio change. No i18n framework required.

The Convex `symbols` table schema extends per language. Note: the MVP originally used a nested `words.eng` structure but has since migrated to a flat `word` field. The new build schema should be designed clean — a suggested structure:

```
labels: { eng: string, hin: string, pan: string }
audio: { eng: { default: string }, hin: { default: string }, pan: { default: string } }
```

The exact field naming is a schema design decision for the new build, not a carry-over from the MVP.

The `childProfile` stores `language: "eng" | "hin" | "pan"`. Every symbol query reads `words[language]` and `audio[language]`. The talker, play modal, and search all use the profile language automatically. No conditional rendering required in components.

### Launch languages
- **English** — primary, fully implemented in MVP
- **Hindi or Punjabi** — second language at launch

**Why Hindi/Punjabi over Spanish:**
- Community familiarity — founder has personal and cultural connection
- Local relevance — large South Asian population in the founder's area and son's school
- Better feedback loop — testing with known community members produces more authentic results
- Spanish remains a strong future language but benefits from having a native Spanish-speaking collaborator involved in QA

### Audio generation per language
Tier 1 (symbol audio): Re-run the existing generation script with the target language code. Same R2 structure, different folder: `audio/hin/default/` or `audio/pan/default/`.

Tier 2 (natural voice): Google Chirp 3 HD and Voxtral both support Hindi natively. Punjabi support varies by provider — verify before committing. Cache key includes language: `sentences/hin/{hash}.mp3`.

### Bilingual households
One language per child profile at launch. The architecture supports adding a language toggle later — it is just a profile field change. Not exposing the toggle in V1 keeps the settings UI simple.

---

## New Convex Tables Required (beyond MVP)

The MVP already has `symbols` and `users`. Mo Speech Home adds:

- `childProfile` — child's AAC profile (name, age, language, state flags), owned by account
- `accountMembers` — relationship table linking collaborators to an account (email, role: owner/collaborator, invite status)
- `modellingSession` — active and completed modelling sessions
- `categories` — category definitions (name, default or custom, ordering)
- `categorySymbols` — symbols assigned to categories with ordering and custom overrides
- `lists` — list definitions (name, category, symbols, type: list / sentence / firstThen)

**Schema extension to `symbols` table:**
- Add `words.hin`, `words.pan` fields
- Add `audio.hin.default`, `audio.pan.default` fields

---

## What Carries Over From the MVP

| Area | Carries Over? | Notes |
|---|---|---|
| Tech stack | ✅ Yes | Same Next.js, Convex, Clerk, R2, Vercel, Stripe |
| Convex `symbols` table | ✅ Extend | Add language fields for Hindi/Punjabi |
| Convex `users` table | ✅ Extend | Becomes the account owner record |
| Stripe subscription flow | ✅ Yes | Fully built, no changes needed |
| Admin dashboard | ✅ Yes | Fully built, no changes needed |
| Service worker audio caching | ✅ Yes | Carries over directly |
| R2 asset delivery | ✅ Extend | Delivery pattern changing: proxy → pre-signed URLs (Phase 0 refactor). Add language-scoped paths for new audio |
| Convex data access | ✅ Extend | Access pattern changing: API-route-proxied → direct from client via Clerk JWT (Phase 0 refactor) |
| Clerk auth middleware | ✅ Yes | Extend for permission-based visibility |
| Landing page | ✅ Yes | Needs copy updates only |
| Search feature | ✅ Yes | Becomes the Search nav item directly |
| Fullscreen play modal | ✅ Extend | Becomes the shared Play Modal |
| TopLine / talker bar | ✅ Extend | Becomes the shared talker header component |
| Google TTS pipeline | ✅ Extend | Re-run for Hindi/Punjabi; add Chirp 3 HD for sentences |
| TypeScript | ⬆️ Upgrade | MVP is JSX throughout — new build is TypeScript throughout; Convex generated types used end to end |
| App layout / routing | ❌ Rebuild | Single-screen layout cannot support four-nav, multi-mode structure |
| Component structure | ⚠️ Partial | Some leaf components reusable; overall tree needs redesign |

---

## Rebuild vs Extend Assessment

### Arguments for extending the MVP
- Tech stack identical — no migration risk
- Convex schema, Stripe, admin, service worker all working and tedious to recreate
- Symbol library (58k symbols, audio, R2) fully integrated

### Arguments for a fresh build
- Current layout built for single-screen — retrofitting four-nav, category modes, and permission layer is harder than starting clean
- No TypeScript — a fresh build is the natural moment to add it properly
- `ModellingOverlayWrapper` needs to wrap the entire app from day one
- `childProfile` and `accountMembers` are genuinely new data structures, not extensions of the existing `users` table pattern
- State flag system influences rendering at every level of the tree — cleaner to design a fresh context architecture around it

### Recommendation for the agent

**Start fresh, carry over selectively.** Copy the tech stack, Convex schema foundation, Stripe integration, admin dashboard, service worker, and R2 setup directly into the new project. Design the routing structure, layout, component tree, account model, and context architecture from scratch.

The MVP is not broken — it is scoped for a product that no longer reflects the full vision. Extending it risks building on a structural foundation that resists the changes at every step.

---

## Key Architectural Patterns to Design In From Day One

- **Four-item nav shell** — Home, Search, Categories, Settings; all content routes beneath these
- **Permission context** — single context holding the child profile's state flags; read throughout the tree
- **Shared talker header component** — one component; search = talker only; board = talker or banner
- **Category mode tabs** — Board, Lists, First Thens, Sentences as modes within one Category Detail screen
- **Language-aware symbol queries** — all symbol queries accept a `language` param; components never hard-code `eng`
- **Two-tier audio** — Tier 1 (symbols) from R2 pre-generated; Tier 2 (sentences/lists) from natural TTS API → cached to R2
- **ModellingSessionContext** — wraps entire app, always present, activates overlay when session is pushed
- **ModellingOverlayWrapper** — wraps every highlightable component; black overlay div + pointer-events, never touches children
- **Stable componentKeys** — every tappable element modelling highlights has a stable data-driven key from day one
- **TypeScript throughout** — Convex generates types; use them end to end

---

## Development Infrastructure Plan

### Phase 0 — Clean Architecture Refactor (current, branch: `refactor/clean-architecture`)

Before building Mo Speech Home, the MVP codebase is being refactored to establish the correct patterns that the new build will use. The current MVP has an extra API layer sitting between the client and all data/assets — every image, audio file, and database query passes through a Next.js serverless function. For an AAC app where speed is the core product value, this is a meaningful latency problem.

**Changes on this branch:**
- R2 asset delivery: API routes now return a **pre-signed URL**; the browser fetches direct from R2. Removes byte-proxying and Vercel function invocations per asset
- Convex data: Symbol and user queries now run **directly from the client** using Clerk JWT. Removes `api/symbols/*` and `api/user/*` proxy routes
- Kept as API routes (must remain server-side): Stripe webhooks, Deepgram token generation, contact email

Once these patterns are proven against the real infrastructure (real Convex, real R2, real Clerk), they become the reference for the new build.

---

### Phase 1 — Extract `convex-clerk-stripe` Skill

After the refactor branch is working, extract the corrected integration patterns into a reusable Claude Code skill at `~/.claude/skills/convex-clerk-stripe/`.

The skill will document:
- Convex direct from client with Clerk JWT setup
- Pre-signed R2 URL generation pattern
- Stripe webhook handler structure with signature verification
- User sync mutation on first app load
- Subscription access control logic (trial / free / active / custom access)

This skill becomes the canonical reference for every future project on this stack — eliminating the need to rediscover the correct patterns each time.

---

### Phase 2 — `mo-starter` Template Repo

After Mo Speech Home is built and running in production, extract the auth/Stripe/Convex wiring into a clean GitHub template repo.

**Contents:**
- Next.js 15 + TypeScript throughout
- Convex with `users` table and user sync mutation
- Clerk middleware with protected and public route groups; role in `publicMetadata`
- Stripe: checkout session, webhook handler, customer portal
- `.env.example` with all required keys documented
- No project-specific schema, business logic, or components

**Versioning:** Tag by dependency versions (`v1.0 — nextjs15, convex1.x, clerk5`) so future projects know whether the template is current before using it.

Building the template from a proven production project (not speculatively) ensures the patterns are real, not theoretical.

---

### Phase 3 — Mo Speech Home Full Build

Fresh repository. Tech stack, Convex schema foundation, Stripe integration, admin dashboard, service worker, and R2 setup copied from MVP. Routing, layout, component tree, account model, and context architecture designed from scratch per the patterns documented above.
