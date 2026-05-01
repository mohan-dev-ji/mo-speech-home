# Mo Speech Home — Build Plan

## Context for the Agent

This document is the starting point for building Mo Speech Home in full build mode. Read this first, then read the documents it references before writing any code.

Mo Speech Home is a fresh build — not an extension of the MVP. A template has been created from the MVP codebase with Stripe, R2, and Convex already wired up with placeholder env vars. Use this template. Do not start from scratch.

The MVP was a single-screen symbol search tool. Mo Speech Home is a full AAC platform. The routing, layout, component architecture, and context system must be designed from scratch. The Stripe integration, R2 setup, service worker, admin dashboard, and Convex schema foundation carry over directly.

Everything in this app is JSON-driven. Student profiles, categories, symbols, lists, sentences, first-thens, themes, resource packs — all Convex documents. The app shell is a renderer. Keep this mental model throughout the build.

**The single most important architectural rule: never hard-code `"eng"` anywhere. Every query, every component, every audio path accepts a language parameter.**

---

## Before Writing Any Code

Read these documents in order:

1. `00-overview.md` — product vision, account model, navigation, two-product strategy
2. `12-convex-schema.md` — full schema across all three Convex projects
3. `01-navigation-and-permissions.md` — state flags, permission system, one-app approach
4. `02-categories.md` — categories as the root container, four modes
5. `04-modelling-mode.md` — real-time overlay system, Convex session architecture
6. `13-next16-setup.md` — Next.js 16 breaking changes, proxy.ts, next-intl v4 setup

The remaining docs (`03` through `17`) are reference material — read them when working on the relevant feature.

---

## Phase 0 — Project Scaffold

**Goal:** Working Next.js 16 app with all infrastructure connected, correct architecture in place before any feature is built.

### 0.1 Clone and configure the template

- Clone the MVP template into the new Mo Speech Home repo
- Run the Next.js 16 codemod: `npx @next/codemod@canary upgrade latest`
- Rename `middleware.ts` → `proxy.ts`, rename exported function to `proxy`
- Verify Node.js version is 20.9+
- Update `package.json` lint script from `next lint` to `eslint .`
- Install next-intl v4: `pnpm add next-intl@latest`
- Set up `messages/en.json` and `messages/hi.json` with stub keys
- Add `NextIntlClientProvider` to root layout
- Chain Clerk + next-intl in `proxy.ts`
- Verify app starts and Clerk auth works

**Reference:** `13-next16-setup.md`

### 0.2 Set up three Convex projects

- `convex-home` — main app backend (extend from MVP template)
- `convex-identity` — new project, shared student identity layer
- `convex-school` — stub only, not built yet

Connect `convex-home` to the app. Leave `convex-identity` connected but empty for now.

### 0.3 Define the full Convex schema in convex-home

Create all tables before building any UI. Schema first — always.

```
symbols          (extend existing — add words.hin, audio.hin)
users            (extend existing — add referredBy field)
accountMembers   (new)
studentProfiles  (new — includes all stateFlags)
profileCategories (new)
profileSymbols   (new — the most important table)
profileLists     (new)
profileSentences (new)
profileFirstThens (new)
modellingSession (new)
resourcePacks    (new — admin managed)
themes           (new — admin managed)
affiliates       (new)
commissionEvents (new)
```

Add all indexes. Seed the symbols table with core 500 priority symbols for development.

**Reference:** `12-convex-schema.md`

### 0.4 Define convex-identity schema

```
studentIdentity  (new)
profileVisibility (new)
shareRequest     (new)
```

**Reference:** `07-home-school-connection.md`, `12-convex-schema.md`

### 0.5 Scaffold the app shell

Build the four-nav shell with empty screens before any content:

```
/app/[locale]/
  layout.tsx              ← NextIntlClientProvider, fonts, ThemeContext, ProfileContext,
                            ModellingSessionContext — all context providers here
  home/page.tsx           ← empty
  search/page.tsx         ← empty
  categories/page.tsx     ← empty
  settings/page.tsx       ← empty
```

The `[locale]` segment is the next-intl locale prefix (`/en/`, `/hi/`). All protected routes live beneath it.

### 0.6 Set up context providers

All context providers wrap the app from day one. Do not add them later.

```typescript
// Four contexts — all present, mostly empty at this stage
ThemeContext           // active theme tokens applied to CSS custom properties
ProfileContext         // active studentProfile, categories, state flags, language
ModellingSessionContext // active modellingSession — normally null
ResourceLibraryContext // featured/seasonal packs metadata — lightweight
```

**Critical:** `ModellingSessionContext` must wrap the entire app from day one even though modelling mode is built much later. The `ModellingOverlayWrapper` component wraps every highlightable element — it needs the context to exist.

### 0.7 Set up font loading

```typescript
// Load per locale — not all at once
import { Noto_Sans } from 'next/font/google'
import { Noto_Sans_Devanagari } from 'next/font/google'
```

Apply the correct font based on active locale.

### 0.8 Set up the theme system

- Create the `themes` Convex table
- Seed 6 starter flat themes (Classic Blue, Soft Green, Warm Coral, Deep Purple, Sunny Yellow, Cool Grey)
- Apply active theme tokens to CSS custom properties on the root element
- Verify `ThemeContext` switches themes correctly
- All Tailwind colour values reference CSS custom properties — no hard-coded colours anywhere

**Reference:** `15-themes.md`

### 0.9 Set up shared component directory

Per ADR-006, in-app shared components live under `app/components/app/shared/{sections|ui|modals}/`. The top-level `app/components/shared/` is reserved for genuinely cross-domain UI (currently only the future Resource Library viewer).

```
app/components/app/shared/
  ui/
    SymbolCard.tsx
    CategoryBoardGrid.tsx
    Header.tsx                   ← talker display
    TalkerBar.tsx
    NavTabButton.tsx
    ModellingOverlayWrapper.tsx  ← wraps every highlightable element; reads ModellingSessionContext
  sections/
    Sidebar.tsx
    TopBar.tsx
    PersistentTalker.tsx
    AppProviders.tsx
  modals/
    PlayModal.tsx
    symbol-editor/
      SymbolEditorModal.tsx
```

**The rule:** `ui/` components accept props and callbacks only — no dependency on app-specific contexts. `sections/` components are the integration point that consumes contexts and composes `ui/` + `modals/`.

Add `componentKey` props to every shared component that modelling mode needs to highlight. These must exist from day one:
- `categories-nav-button`
- `category-tile-{categoryId}`
- `symbol-{symbolId}`

**Reference:** `04-modelling-mode.md`, `17-admin-library.md`

---

## Phase 1 — Authentication and Account Model

**Goal:** Instructor can sign up, create a student profile, invite a family member.

### 1.1 Carry over from MVP

- Stripe subscription flow (monthly, yearly, portal, webhooks)
- Admin dashboard (user management, custom access)
- Clerk auth middleware

Extend Stripe plan field: `"pro_monthly" | "pro_yearly" | "max_monthly" | "max_yearly"`

**Post-auth routing:** After sign-in or sign-up, Clerk redirects to `/start`. The `/start` page is a language chooser — user picks English or Hindi and is routed to `/{locale}/home`. The choice is stored in `localStorage`. On subsequent visits, `/start` auto-redirects to the saved locale without showing the picker again.

**No `/dashboard` route.** The old template's `(dashboard)` route group has been removed. Account and plan management live at `/{locale}/settings` and `/{locale}/settings/account` within the app. Stripe checkout success/cancel redirects to `/en/settings?success=true`.

### 1.2 Student profile creation

- After sign up, prompt instructor to create a student profile
- Store `studentProfile` in Convex with default state flags
- Set default language to `"eng"`
- Set default theme to Classic Blue
- Simultaneously create `studentIdentity` in `convex-identity` and generate invite code

### 1.3 Account members (Max tier)

- Invite flow: email → pending `accountMember` record → Clerk sign up → active
- All collaborators load the same `childProfile` on sign in
- Gate behind Max tier check

### 1.4 useSubscription hook

```typescript
// Returns based on plan field on users table
{
  tier: "free" | "pro" | "max"
  hasCategories: boolean
  hasModelling: boolean
  hasFamilyMembers: boolean
  hasPremiumThemes: boolean
}
```

Use this hook throughout — never check the plan string directly in components.

**Reference:** `08-family-members.md`, `14-pricing-tiers.md`

---

## Phase 2 — Search

**Goal:** Working symbol search — the free tier anchor and the MVP feature carried forward.

### 2.1 Symbol search

- Carry over the existing Convex search query from the MVP
- Make it language-aware: `searchSymbols(query, language)`
- Results display using `CategoryBoardGrid` and `SymbolCard` shared components

### 2.2 Talker header on search

- `CategoryHeader` component in `mode="talker"` — no banner toggle on search
- `talker_visible` state flag controls visibility
- `TalkerBar` component for the sequence
- `PlayModal` triggered by play button

### 2.3 Core vocabulary dropdown

- Dropdown panel from the talker header
- Three tabs: Core Words / Numbers / Letters
- Symbol cards sourced from `symbols` table filtered by `priority` field (1–500)
- Follows current talker state (talker = add to bar, banner = play audio)
- Controlled by `core_dropdown_visible` state flag

### 2.4 Audio

- Individual symbol audio: existing R2 pre-generated files via existing proxy route
- Service worker caching carries over from MVP

**Reference:** `03-talker-and-play-modal.md`

---

## Phase 3 — Categories and Multiple Profiles

**Goal:** Instructor can create and edit categories. Student can navigate them. Multiple profiles per account are supported.

### 3.0 Multiple profiles

- Add `activeProfileId?: Id<"studentProfiles">` to the `users` Convex table
- Remove the one-profile-per-account guard in `createStudentProfile`
- Update `getMyStudentProfile` to accept an optional `profileId`; fall back to `users.activeProfileId`, then to first profile found
- Add `setActiveProfile(profileId)` mutation that patches `users.activeProfileId`
- ProfileContext: expose `setActiveProfile`; profile switcher in settings UI
- New profile creation flow: modal offers "Duplicate [existing profile]" or "Start from defaults"
  - Duplicate: copies all `profileCategories` + `profileSymbols` with new `profileId`
  - Default: runs `loadStarterTemplate` from the admin resource pack

### 3.1 Default categories on profile creation

- When `studentProfile` is created, run `loadStarterTemplate` mutation
- Seeds `profileCategories` and `profileSymbols` from the starter profile template in `resourcePacks`
- Student has a working AAC setup immediately

### 3.2 Category list screen

- Grid of `profileCategory` cards
- Each card shows name, icon, colour
- Ordered by `profileCategory.order`
- Instructor sees edit controls; student does not (read from `ProfileContext` state flags)

### 3.3 Category detail — four modes

- `ModeSwitcher` tabs: Board / Lists / First Thens / Sentences
- Default mode: Board
- `CategoryHeader` in `mode="talker"` or `mode="banner"` depending on state flag
- `talker_banner_toggle` state flag controls whether student can switch

### 3.4 Board mode

- `CategoryBoardGrid` of `profileSymbol` cards
- Tap symbol → add to talker bar (talker state) or play audio (banner state)
- `audio_autoplay` state flag controls auto-play
- Wrap every symbol card in `ModellingOverlayWrapper` with `componentKey="symbol-{symbolId}"`

### 3.5 Lists, Sentences, First Thens modes

- `ListEditor` / `SentenceEditor` / `FirstThenEditor` shared components
- Play button triggers `PlayModal`
- Sentence natural voice audio: check R2 cache first, generate via Google Chirp 3 HD on cache miss

**Reference:** `02-categories.md`, `03-talker-and-play-modal.md`, `10-audio-architecture.md`

---

## Phase 4 — Symbol Editor

**Goal:** Instructor can create fully customised symbols.

### 4.1 Symbol editor modal

Four image source tabs:

- **SymbolStix** — reuse existing search; sets `imageSource.type = "symbolstix"`
- **Google Images** — Google Custom Search API → download server-side → upload to R2 as `.webp` under `profiles/{profileId}/symbols/`
- **AI Generation** — Google Imagen API server-side → upload to R2; store `aiPrompt` for regeneration
- **Device Upload** — file picker → compress to `.webp` client-side → upload to R2

Audio section: Default / Choose Word / Generate (Chirp 3 HD) / Record (MediaRecorder → R2)

Display section: colour pickers, text size, border, toggles (show label, show image), card shape

Live preview updates as properties change using `SymbolCard` shared component.

### 4.2 Save flow

Nothing writes to Convex until "Save to [Category]" is tapped:
1. Resolve any pending uploads (image, audio) to R2
2. Create or update `profileSymbol` record in Convex
3. Return `profileSymbolId` to calling context

### 4.3 Audio resolution

```
1. profileSymbol.audio.type = "recorded"  → user recording
2. profileSymbol.audio.type = "tts"       → Chirp 3 HD generated
3. profileSymbol.audio.type = "r2"        → alternative R2 word
4. symbols.audio[language].default        → SymbolStix pre-generated (fallback)
```

**Reference:** `05-symbol-editor.md`, `10-audio-architecture.md`

---

## Phase 5 — Modelling Mode

**Goal:** Instructor can push a real-time guided walkthrough to student's device.

All places a symbol can be modelled from (categories list, category detail page) are now built. Modelling is tightly scoped — only available in category-page edit mode — but ships a major marketing differentiator. It also forces the dual-profile testing rig into a solid state, which Resource Library benefits from.

### 5.0 Dual-profile foundation

Two browser windows on the same login must independently render instructor and student experiences.

- `setViewMode` already exists in `ProfileContext.tsx` but has no UI caller — surface a small instructor-only toggle (settings page or topbar badge)
- When `viewMode === 'student-view'`, all edit affordances must be suppressed regardless of role
- Sweep `stateFlags.*` reads across the app — verify `talker_visible`, `talker_banner_toggle`, `audio_autoplay`, `modelling_push` actually gate UI live
- Test rig: open two windows on the same login → window A in instructor mode, window B in student-view → confirm Convex subscription propagates settings live

### 5.0a Component-key gap fix (pre-flight)

Audit confirmed three known gaps that block highlighting:

- `app/components/app/categories/ui/CategoryTile.tsx` — wrap with `ModellingOverlayWrapper componentKey={"category-tile-" + category._id}`
- `app/components/app/shared/sections/Sidebar.tsx` — wrap categories nav item with `componentKey="categories-nav-button"`
- `app/components/app/shared/ui/ModellingOverlayWrapper.tsx` — convention comment drift; doc says `category-tile-{categoryId}`, code comment says `category-{categoryId}`. Fix the comment.

### 5.1 Convex session infrastructure

- `modellingSession` table already in schema
- `createModellingSession` mutation — pre-computes steps from symbol's category location; cancels any existing active session for the profile first
- `advanceStep` mutation — student taps; increments `currentStep`
- `cancelModellingSession` mutation
- `getActiveModellingSession(profileId)` query — student subscribes
- `getModellingSessionById(sessionId)` query — instructor mirror view subscribes

### 5.2 ModellingSessionContext

- Already wrapping the app (set up in Phase 0)
- Now wire in the Convex subscription
- Expose `activeSession`, `currentStep`, `isHighlighted(componentKey)`, `advanceStep()`

### 5.3 ModellingOverlayWrapper

- Already wrapping highlightable components (set up in Phase 0)
- Now wire in the actual overlay behaviour:
  - Inactive: black div at `opacity-80`, `pointer-events-none`
  - Active target: black div at `opacity-0`, glow ring applied
- Set `data-component-key={componentKey}` on outer div so `ModellingAnnotation` can locate targets

### 5.4 ModellingAnnotation

- Arrow + symbol image + label
- Positioned via single `getBoundingClientRect()` call per step change
- Left/right based on target centre vs 50% viewport width
- Vertical centre aligned with target
- Respects `reduce_motion` state flag and OS `prefers-reduced-motion`

### 5.5 Instructor trigger UI

- Modelling trigger from Category Board edit mode (instructor only)
- Gated by `viewMode === 'instructor'` AND `useSubscription().hasModelling` AND `stateFlags.modelling_push`
- Symbol picker → confirm modal → session created

### 5.6 Mirror view and success animation

- Instructor screen subscribes to `getModellingSessionById`
- Shows student's current step in real time
- Success animation on `status = "completed"`; both devices return to previous screen

**Reference:** `04-modelling-mode.md`, ADR-006

---

## Phase 6 — Resource Library

**Goal:** Admin can publish packs; users can load them from a real home dashboard and a public library surface.

### 6.1 Authoring (in main app, admin-only)

Admins author resource pack content directly in the main Mo Speech app, using their own student profile as the working surface. When a Clerk user has `publicMetadata.role === "admin"`, the app exposes additional affordances:

- "Save category to library" — in category edit-mode toolbar
- "Save list to library" — in list editor
- "Save sentence to library" — in sentence editor
- "Save first-then to library" — in first-then editor

Tapping any of these snapshots the current item and creates or updates a `resourcePack` document. Reuses every existing UI component — no duplicate authoring surface inside the admin dashboard.

### 6.2 Admin CMS (thin)

The admin dashboard gets a Library section that handles only metadata and lifecycle:

- Pack listing (filter by season, status, featured)
- Set `publishedAt` / unpublish (null = draft)
- Set `expiresAt` (e.g. Halloween pack expires 1 November)
- Toggle `featured` for home dashboard promotion
- Set `season` and `tags`
- Reorder packs within season groupings
- Delete packs

No content authoring lives here. No code deploy required to publish, update, or expire a pack.

### 6.3 Public browse surface

Two browse surfaces, both built with the design system:

- **Marketing-site library** — public, unauthenticated, SEO-indexed. Lives on the marketing site (e.g. `/library` or `/resources`). Shows pack covers, seasonal context, preview content. No load action — call-to-action is "Sign up to load this pack". Sales asset and discovery surface.
- **Authed app library** — at `/[locale]/library`. Same browse experience plus the "Load into profile" action.

Marketing-side uses ISR / static generation; authed side uses live Convex queries.

### 6.4 Home dashboard build

The home page is currently a stub. Phase 6 ships a real one:

- `ResourceLibraryContext` fetches featured/seasonal pack metadata on app load
- Home screen renders promotional cards for featured and current seasonal packs
- Quick links to key features (categories, search, settings)
- Full pack content only fetches when user taps to preview or load

### 6.5 Load pack flow

`loadResourcePack(profileId, packId)` mutation:
1. Creates `profileCategory` from pack category
2. Creates `profileSymbol` records (with any starter display overrides)
3. Creates `profileList`, `profileSentence`, `profileFirstThen` records
4. Sets `librarySourceId` on all created records
5. Content is now fully in user's profile — library not touched again

`loadStarterTemplate` (called on profile creation, currently stubbed by `seedDefaultProfile`) wires through the same path against the canonical starter pack.

### 6.6 Reload defaults

`reloadFromLibrary(profileCategoryId)` mutation:
- Checks `librarySourceId`
- Confirmation modal with destructive warning
- Deletes all `profileSymbol` records and associated R2 assets
- Recreates from library source

**Reference:** `06-resource-library.md`

---

## Phase 7 — Themes

**Goal:** Student profiles have selectable colour themes.

- `themes` table already seeded with 6 starter themes (Phase 0)
- Theme picker in Settings → Appearance
- `setTheme(themeId)` updates `studentProfile.themeId` in Convex
- `ThemeContext` applies tokens to CSS custom properties
- `reduce_motion` state flag disables animations; respects OS `prefers-reduced-motion`
- Gate premium themes behind Max tier

**Reference:** `15-themes.md`

---

## Phase 8 — Home/School Connection

**Goal:** Student identity is portable between Mo Speech Home and Mo Speech School.

### 8.1 convex-identity infrastructure

- `createStudentIdentity` mutation — called on student profile creation
- Generates invite code, links to `homeProfileId`
- `switchContext` mutation — updates `activeContext`
- `getActiveContext` query — student's device subscribes

### 8.2 Cross-project HTTP action

**Prototype this early.** Build a simple read-only HTTP endpoint in `convex-home` that returns a student's profile summary given a `homeProfileId` and a shared secret. Call it from a test context. Verify it works in production before building the full sharing inbox around it.

### 8.3 Sharing inbox

- `shareRequest` table in `convex-identity`
- Badge on inbox nav item driven by pending request count
- Staging area: preview → accept (copy into profile) or decline
- Accepted items are fully independent from the source

**Reference:** `07-home-school-connection.md`, ADR-007

---

## Phase 9 — Affiliates

**Goal:** Admin can grant affiliate status; Stripe Connect handles automatic payouts.

- `affiliates` and `commissionEvents` tables already in schema
- Admin User Settings page: affiliate section with four states (none / form / invited / active)
- Stripe Connect Express account creation via API
- `account_link` generation and invite email
- `account.updated` webhook handler → set status to `"active"`
- Referral code cookie on signup
- `commissionEvent` creation on `checkout.session.completed` and `invoice.payment_succeeded`
- Automatic Stripe transfer to affiliate's connected account

**Reference:** `16-affiliates.md`

---

## Phase 10 — Admin Library

**Goal:** Admin can create and publish resource packs, themes, core vocabulary, and starter templates.

**This is the last phase. Build the main app first.**

By the time this phase starts, all shared components exist in the codebase. The admin library is mostly composition — assembling existing components into a CMS interface. The coding agent can scaffold this from `17-admin-library.md` with minimal design input.

**Reference:** `17-admin-library.md`

---

## Language — Running Thread Throughout

Language is not a single phase. It runs through every phase.

- **Phase 0** — schema has `words.hin` and `audio.hin` from day one; no component hard-codes `"eng"`
- **Phase 2** — search is language-aware from day one
- **Phase 3** — categories render labels in active language
- **Phase 4** — symbol editor has label fields for both languages
- **Phase 5** — resource packs have bilingual names and descriptions
- **Whenever** — run Hindi TTS generation script for 58k symbols; run Google Cloud Translation API for bulk label translation; manually review core 500 Hindi labels with a native speaker

**Reference:** `11-language-and-i18n.md`

---

## Hindi Launch Checklist

Before launching with Hindi support:

- [ ] All 58k symbol audio files generated in Hindi via Google TTS (`hi-IN`)
- [ ] All 58k symbol labels translated via Google Cloud Translation API
- [ ] Core 500 Hindi labels reviewed by a native Hindi speaker
- [ ] Noto Sans Devanagari font loading verified across devices
- [ ] All UI message keys present in `messages/hi.json`
- [ ] Symbol cards tested with Devanagari labels — no overflow
- [ ] Theme colour palettes tested with Devanagari text weight
- [ ] Sentences tested with Google Chirp 3 HD `hi-IN` voice

---

## Key Technical Decisions — Do Not Deviate

These were made deliberately after significant discussion. Do not change them without understanding why.

**Never hard-code `"eng"`** — every query, component, and audio path accepts a language parameter

**`profileSymbols` always reference via `profileSymbolId`** — never raw `symbolId` in lists and sentences; this ensures overrides apply consistently everywhere and custom symbols work identically to SymbolStix symbols

**Per-component black overlay divs for modelling mode** — not opacity on the component itself; avoids colour bleed and opacity inheritance issues on colourful symbol grids

**`CategoryHeader` with a `mode` prop** — one component for talker, banner, and admin metadata; do not build three separate components

**Shared components have no app-specific context dependencies** — they accept props only; contexts wrap them at the page level

**Two-level edit pattern for categories** — Level 1 is in-page edit mode: toggling it switches view components to their editable variants (drag/delete/reorder) without leaving the page. Level 2 is `SymbolEditorModal`: the single shared modal for all symbol creative editing (image, label, audio, display), called from any Level 1 edit surface. Never build symbol creative editing inside a page.

**`ModellingSessionContext` wraps the entire app from day one** — even though modelling mode is built in Phase 6; the `ModellingOverlayWrapper` on every highlightable element needs the context to exist from the start

**`librarySourceId` is a loose reference only** — never used for rendering; only for the reload defaults flow; no enforced foreign key

**Two-tier audio is deliberate** — mechanical Google Standard TTS for individual symbols; natural Google Chirp 3 HD for sentences; this is a product decision, not a cost compromise

**Cross-project Convex calls via HTTP actions** — not direct client queries to another project; prototype the `convex-home` ↔ `convex-identity` HTTP action early before building sharing inbox around it

**Resource Library uses hybrid authoring** — admins author content in the main app via admin-only "Save to library" buttons (full component reuse); a thin admin CMS handles only publish/unpublish, season, featured, and ordering. Do not duplicate authoring UI inside the admin dashboard.

**Library has two surfaces** — public marketing-site browse page (SEO, unauthenticated) and authed `/[locale]/library` (load into profile). Both use the same design system.

---

## Environment Variables Required

From MVP template (already configured):
```
NEXT_PUBLIC_CONVEX_URL
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRO_MONTHLY_PRICE_ID       ← new
STRIPE_PRO_YEARLY_PRICE_ID        ← new
STRIPE_MAX_MONTHLY_PRICE_ID       ← new
STRIPE_MAX_YEARLY_PRICE_ID        ← new
CLOUDFLARE_R2_BUCKET
CLOUDFLARE_R2_ACCESS_KEY
CLOUDFLARE_R2_SECRET_KEY
CLOUDFLARE_R2_ENDPOINT
```

New for this build:
```
NEXT_PUBLIC_CONVEX_IDENTITY_URL   ← convex-identity project
GOOGLE_CLOUD_API_KEY              ← TTS, Translation, Imagen, Custom Search
GOOGLE_CUSTOM_SEARCH_ENGINE_ID    ← for Google Images tab in symbol editor
STRIPE_CONNECT_CLIENT_ID          ← for affiliate Stripe Connect
CONVEX_IDENTITY_SHARED_SECRET     ← for cross-project HTTP actions
ADMIN_CLERK_IDS                   ← comma-separated admin user IDs
```

---

## A Final Note

Mo Speech Home is not just an AAC tool. It is potentially the first AAC platform built with Hindi as a first-class language from day one. No existing platform has done this for South Asian communities. The architecture has been designed carefully to support this — language-aware queries, Noto Sans Devanagari, bilingual Convex fields throughout.

Build it right. The families who will use it deserve a product that was designed for them, not translated as an afterthought.

Good luck. 🙏
