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

## Refined Execution Order — Current Direction

This section supersedes the strict numerical phase order below for the post-launch roadmap. Phases 0–6 are shipped. Phase 7 (Admin Dashboard) is partially shipped — slice 1 (Library + Users + Overview + custom access + tags + expiry cron) is in production; slice 2 (Recent Symbols data layer) was aborted in favour of proper product analytics. The remaining work is sequenced around a unified plugin mentality (packs → languages → themes → future plugin types).

Execute in this order:

| # | Phase | Size | Notes |
|---|---|---|---|
| ✅ | Phases 0–6 | shipped | Main app, library authoring, free-tier gating, pricing, library detail page |
| ✅ | Phase 7 — Admin Dashboard (slice 1) | shipped | Library + Users + Overview + custom access (grant/revoke + audit history + expiry cron) + tag system on packLifecycle |
| ➡️ | **Phase 7.5 — Product Analytics (PostHog)** | 1–2 days | Funnel data, retention, feature usage, opt-out toggle, child-privacy hard rules. Unblocks evidence-based design for everything below. See `21-product-analytics-posthog.md`. |
| ➡️ | **ADR-011 — Plugin architecture for content modules** | ~½ day, no code | Codify the "content-as-data, app-as-runtime" pattern (already true for packs via ADR-010). Applied to languages, themes, future plugin types (phonics, key-stage). |
| ➡️ | **Phase 8 — Languages (dedicated plugin refactor)** | 1–2 weeks | The strategic differentiator. Refactor languages as a plugin module: JSON bundle per locale + voice registration + default-symbol translations + locale routing entry. Hindi proves the architecture; Punjabi / Bengali / Spanish / Arabic follow same rails. Adds a "Languages" section to the admin dashboard. |
| ➡️ | **Phase 9 — Themes as pluggable packs** | 1–2 weeks | Same plugin pattern. JSON theme definitions + `themeLifecycle` overlay. User uploads as natural next step. Adds a "Themes" section to the admin dashboard. |
| ➡️ | **Phase 10 — UI design polish pass** | design-led | Figma + Claude Design exploration. Polish AFTER architecture is right and AFTER real content (Devanagari, themes, multi-language) is rendering. PostHog data informs which surfaces deserve most attention. |
| ➡️ | **Phase 11 — Home/School connection review** | ?? — see hypothesis | The original Phase 9 (convex-identity + convex-school separation) may have been **accidentally solved** by the existing student-profile + accountMembers invite architecture. This phase becomes a review and rescoping rather than a build. See "Home/School Hypothesis" inside Phase 11 below. |
| ➡️ | **Phase 12 — Affiliates** | as spec'd | Last meaningful surface. Stripe Connect, commission events, admin affiliate management plugged into Phase 7's dashboard. |

Phases inside the admin dashboard (Phase 7) are revisited as needed when new plugin types ship: e.g., when Languages lands, return to the dashboard to add a Languages-management section using the same shape as Library; same for Themes. These returns are part of the plugin-phase work, not separate phases.

The "Language — Running Thread Throughout" section below remains valid as an **architectural discipline** (no component hard-codes `"eng"`, etc.). Phase 8 is the dedicated refactor that makes the running thread truly pluggable.

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

**Reference:** `04-modelling-mode.md`, `17-admin-dashboard.md`

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

### 5.3 Dimming layer — backdrop + wrapper

Architecture: viewport-level backdrop instead of per-component overlays. See **ADR-007**.

- **`ModellingBackdrop`** (new) — single fixed-position div mounted in `AppProviders`; fades to 80% black across the whole viewport when a session is active; z-index 80; captures pointer events to block taps on unwrapped UI
- **`ModellingOverlayWrapper`** — already wrapping highlightable components (set up in Phase 0); on highlight, bumps `z-index` to 90 (above the backdrop) and renders the glow ring
- `data-component-key={componentKey}` stays on the wrapper's outer div so `ModellingAnnotation` can locate targets

Z-index bands reserved for modelling: 80 (backdrop) – 95 (annotation). Modals and toasts at 100+ stay above the modelling layer.

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

### 6.1 Authoring (in main app, admin view-mode)

Admins author resource pack content directly in the main Mo Speech app, using their own account's content (categories, lists, sentences) as the working surface. Admin chrome is gated on `viewMode === 'admin'` (the new third entry in the breadcrumb dropdown, available only when Clerk role is admin — see ADR-008). When the admin selects this view mode, the app exposes additional affordances:

- "Save category to library" — in category edit-mode toolbar
- "Save list to library" — in list editor
- "Save sentence to library" — in sentence editor
- "Make Default" - Saves category, list or sentence to the default starter pack loaded on account creation

Switching back to `viewMode === 'instructor'` hides these buttons, so admins can preview their own content as a normal instructor would. Tapping any save action snapshots the current item and creates or updates a `resourcePack` document. Reuses every existing UI component — no duplicate authoring surface inside the admin dashboard.

### 6.2 Admin CMS (thin) — built in Phase 7

The metadata/lifecycle layer lives in the admin dashboard's Library section, built in **Phase 7 — Admin Dashboard**. Phase 6 ships in-app authoring + browse + load; Phase 7 ships the metadata controls (publishedAt, expiresAt, featured, season, tags, reorder, delete). The two phases together complete the resource library feature.

### 6.3 Public browse surface

Two browse surfaces, both built with the design system:

- **Marketing-site library** — public, unauthenticated, SEO-indexed. Lives on the marketing site (e.g. `/library` or `/resources`). Shows pack covers, seasonal context, preview content. No load action — call-to-action is "Sign up to load this pack". Sales asset and discovery surface.
- **Authed app library** — at `/[locale]/library`. Same browse experience plus the "Load into profile" action.

Marketing-side uses ISR / static generation; authed side uses live Convex queries.

### 6.4 Home dashboard build

The home page is currently a stub. Phase 6 ships a real one:

- `ResourceLibraryContext` fetches featured/seasonal pack metadata on app load
- Home screen renders promotional cards for featured and current seasonal packs in the Home banner
- Quick links to key features (categories, search, settings)
- Full pack content only fetches when user taps to preview or load

### 6.5 Load pack flow

`loadResourcePack(profileId, packId)` mutation:
1. Creates `profileCategory` from pack category
2. Creates `profileSymbol` records (with any starter display overrides)
3. Creates `profileList`, `profileSentence` records
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

## Phase 7 — Admin Dashboard

> **Status:** Slice 1 shipped (Library + Users + Overview + custom access + tag system). Slice 2 (Recent Symbols) aborted — superseded by Phase 7.5 (PostHog). Return here later to add Languages and Themes sections as those plugins ship.

**Goal:** Complete the existing `/admin` dashboard so admins can manage resource pack metadata, view user/usage data, and operate the platform without touching code.

The `/admin` route already exists as scaffolding (Overview stats, Users list, User detail). Phase 7 completes it as one coherent surface, immediately following Phase 6 because the resource library feature isn't usable without metadata controls (publish, schedule, feature, expire). See **ADR-008** for the admin role and view-mode model.

### 7.1 Library section (the original Phase 10 spec)

Pack management surface. No content authoring here — content is authored in-app via Phase 6's view-mode gated affordances. This section handles only metadata and lifecycle:

- Pack listing with filters (season, status, featured)
- Set `publishedAt` / unpublish (null = draft, not visible to users)
- Set `expiresAt` (e.g. Halloween pack expires 1 November)
- Toggle `featured` for home dashboard promotion
- Set `season` and `tags` for discoverability
- Reorder packs within season groupings
- Delete packs
- Translation status indicator per pack (English ✅ / Hindi ⏳)

No code deploy required to publish, update, or expire a pack.

### 7.2 Users section

Extend the existing users list with operational data mirrored from the MVP admin shape:

- Start date (account creation)
- Plan status (free / pro / max, monthly / yearly)
- Usage signals (last active, sessions, profile count)
- Drill-down to user detail with subscription history and grant-access controls (already partially scaffolded)

### 7.3 Overview section

Extend the existing 5 stat cards (total / free / pro / max counts) with day-to-day operational metrics. Specifics decided when building, based on what's actually needed.

### 7.4 Recent symbols — ABORTED, see Phase 7.5

This sub-phase was originally planned to track each user's last N symbols on `studentProfiles.recentSymbols`, surface a strip on the home page, and aggregate velocity in the admin dashboard. **It was aborted before any code shipped** in favour of proper product analytics via PostHog (see Phase 7.5 below).

Reasons for the abort:
- Per-profile arrays answer "what's recent for this one student" — useful for an SLP looking at a single child, but doesn't answer the harder questions (funnels, retention, bounce points, conversion paths, aggregate feature usage). Those are the questions that matter for growing the product post-launch.
- The MVP shipped a similar feature and it proved valuable only as proof-of-life ("are people tapping things?"). Once that's confirmed, the analytics question changes shape entirely.
- A third-party product analytics tool (PostHog) handles all of these properly with funnels, cohorts, paths, feature flags, and session replay — and does it across all users, not one student at a time.

The student-facing "Recent symbols" home strip (a UX feature, not an analytics feature) is not replaced by analytics. It's deferred indefinitely — revisit only if there's user signal that it would be valuable. The existing talker bar and category grid already provide quick access to symbols.

### 7.5 Product Analytics (PostHog) — NEW, current phase

> **Status:** Planned, doc written, ready to implement.

The post-MVP correction: wire proper product analytics before any of the bigger architectural projects. Tool chosen: **PostHog** (open source, EU residency available, free up to 1M events/month, ships feature flags + experimentation, generous privacy controls).

What this phase delivers:
- `PostHogProvider` at the app root, autocapture disabled, session replay disabled by default
- `lib/analytics.ts` — typed `track(event, properties)` helper with discriminated-union EventMap
- `lib/analytics-server.ts` — server-side capture for Clerk + Stripe webhook events
- Event catalogue: onboarding funnel, engagement, revenue & lifecycle (see `21-product-analytics-posthog.md` for full list)
- Identify on Clerk auth; person properties refresh on profile switch
- Opt-out toggle in Settings (`posthog.opt_out_capturing()`)
- Privacy policy update to disclose analytics

**Child-privacy hard rules** (non-negotiable):
- No auto-capture (manual events only)
- No session replay on student-view pages
- Identify by Clerk userId, never by student profile
- No symbol labels in event payloads — aggregate behaviour, never specific utterances
- No pack / list / sentence content in payloads
- IP anonymisation on; EU users routed to EU PostHog instance

**Event shape discipline** (locks in plugin compatibility): `language`, `theme_slug`, `pack_slug`, and future plugin dimensions use open `string` types — never literal unions. New languages and themes flow through analytics with zero code change.

**Reference:** `21-product-analytics-posthog.md`

### 7.6 ADR-011 — Plugin architecture for content modules — NEW

> **Status:** Planned, no code. Half-day write-up.

Codify the "content-as-data, app-as-runtime" pattern that already underpins resource packs (per ADR-010) so the same shape applies to languages, themes, and future plugin types without re-deriving it twice.

What the ADR captures:
- **Shape:** JSON files in `convex/data/<plugin_type>/` are the source of truth for content. A thin Convex overlay table (`<pluginType>Lifecycle`) holds runtime metadata — publish window, tier override, featured flag, season, notes.
- **Admin surface:** every plugin type gets a parallel admin section (matches Library), driven by `list<Type>ForAdmin` and `update<Type>Lifecycle` mutations. Same component shape; same lifecycle controls.
- **Visibility rule:** plugin is visible iff JSON file exists AND lifecycle row exists with `publishedAt <= now` and `expiresAt` open.
- **Authoring:** content lives in the repo. Lifecycle changes are deploy-free.
- **What this enables:** adding a new language is `messages/pa.json + voices/pa.json + register("pa")`. Adding a new theme is `themes/sunset.json + admin publishes lifecycle row`. No schema migration; no architectural change.

The ADR is the contract between Phase 8 (Languages) and Phase 9 (Themes). Both follow the same pattern; without it, they'd end up subtly different.

### 7.5 Future slots

Themes admin (after Phase 8) and Affiliates admin (after Phase 10) plug into this dashboard as additional sections, not separate routes.

**Reference:** `17-admin-dashboard.md`, `06-resource-library.md`, ADR-008

---

## Phase 8 — Languages (dedicated plugin refactor)

> **Status:** New dedicated phase. Replaces the "Languages as a running thread" approach for the specific work of making locales pluggable. The architectural discipline (no `"eng"` hard-coding etc.) remains a running thread — see the section below.

**Goal:** Make adding a new language a self-contained, pluggable operation — no schema changes, no architectural rework, no app-shell editing. Hindi proves the architecture; Punjabi, Bengali, Spanish, Arabic and others follow the same pattern.

This is the strategic differentiator. No serious AAC platform treats Hindi (or any South Asian language) as first-class. Building this properly opens markets nobody else can serve.

### 8.1 Language module shape (per ADR-011)

A language is a self-contained module made of:

- **UI bundle:** `messages/<locale>.json` — all `useTranslations` keys for the locale
- **Voice registration:** `convex/data/voices/<locale>.json` — list of voice IDs available for the locale (Google Cloud TTS voice names + display labels)
- **Default-symbol translations:** the symbols table's `words.<locale>` and `audio.<locale>` fields (already supported in schema; the addition is a bulk translation + TTS generation pass)
- **Locale registration:** one entry in a `locales.ts` registry — code, display name, RTL flag, font stack, default voice ID

Adding a new locale = add the JSON bundle + run the bulk symbol translation script + register. Zero schema changes; zero component changes (every component already uses `language` as an open string per ADR-009).

### 8.2 Hindi as the first non-English pass-through

Hindi is the proof-case for the architecture. Ship Hindi end-to-end as part of this phase — every step is the template for future languages:

- Generate 58k symbol audio files in Hindi via Google TTS (`hi-IN`)
- Translate 58k symbol labels via Google Cloud Translation API
- Manually review the core 500 Hindi labels with a native speaker
- Verify Noto Sans Devanagari loads correctly across devices
- All UI message keys present in `messages/hi.json`
- Symbol cards tested with Devanagari labels — no overflow
- Theme colour palettes tested with Devanagari text weight
- Sentences tested with Google Chirp 3 HD `hi-IN` voice

### 8.3 Admin dashboard — Languages section

Return to the admin dashboard (Phase 7) and add a Languages section using the same shape as Library:

- List all registered locales with status (published / scheduled / draft)
- Publish / schedule / unpublish a locale
- Set tier (most should be free; rare premium-only locales possible)
- Translation status indicator per locale (UI keys, symbol labels, voice availability) — distinct from per-pack translation status
- Display name override per locale

This is where PostHog data informs decisions: which locales actually get switched to? Which onboarding flows drop off in non-English locales?

### 8.4 Locale onboarding flow

Phase 0's `VoiceModal` chose voice at signup. With multi-locale, the onboarding flow becomes locale-first then voice-within-locale:

1. Choose UI language (drives `users.locale`)
2. Choose voice for the student profile (drives `studentProfiles.voiceId`)
3. Hindi-locale users see Hindi voices first; English-locale users see English first

A/B test this flow via PostHog feature flags if conversion data warrants.

### 8.5 Future locale rollout (template)

For each new locale after Hindi (Punjabi, Bengali, Spanish, Arabic, etc.):

1. Generate `messages/<locale>.json` (Google Translation API + native-speaker review of core copy)
2. Generate symbol audio + labels in the new locale (same scripts as Hindi)
3. Register the locale + its voices
4. Admin publishes the locale (dashboard click, no deploy)
5. Native-speaker QA + community feedback loop
6. PostHog tracks signup → completion funnel for the new locale

**Reference:** `11-language-and-i18n.md`, ADR-009, ADR-011 (planned)

---

## Phase 9 — Themes as pluggable packs

> **Status:** Reordered from original Phase 8. Same plugin pattern as Languages.

**Goal:** Student profiles have selectable colour themes, and any admin (and eventually any Max user) can introduce a new theme without code changes.

The existing `themes` table is seeded with 6 starter themes from Phase 0. This phase makes themes pluggable: JSON theme definitions in `convex/data/themes/*.json` + a `themeLifecycle` overlay table for runtime metadata. Matches ADR-011.

### 9.1 Built-in functionality (the original Phase 8 spec)

- Theme picker in Settings → Appearance
- `setTheme(themeId)` updates `studentProfile.themeId` in Convex
- `ThemeContext` applies tokens to CSS custom properties
- `reduce_motion` state flag disables animations; respects OS `prefers-reduced-motion`
- Gate premium themes behind Max tier
- Tile-based and animated themes per the existing `15-themes.md` spec

### 9.2 Theme module shape (per ADR-011)

A theme is a JSON file defining:

- Identity: `slug`, `name: { eng, hin? }`, `description: { eng, hin? }`
- Tokens: full theme token map (colours, gradients, typography, spacing, radii, animations)
- Assets: paths to R2-hosted tile images / animation sources
- Defaults: `type` (flat / tiled / animated), `tier` (free / premium), `coverImagePath`

`themeLifecycle` overlay table (parallel to `packLifecycle`): publish window, featured flag, tier override, season, notes. Admin dashboard gets a Themes section with the same shape as Library.

### 9.3 User-uploaded themes (the natural extension)

Once the JSON-driven pattern is in place, the upload flow is:

- Instructor in Settings → "Create theme" → token-by-token editor or palette uploader (a curated UI, not a free-for-all)
- Save creates a `themeLifecycle` row with `createdBy: instructorClerkId` + a custom slug
- Instructor can use the theme on their own profiles immediately (no admin approval needed for private use)
- Optional: instructor can submit the theme to the shared library (admin reviews, publishes if approved)
- Submitted themes appear in the library alongside packs, tier-gated per the lifecycle row

### 9.4 Admin dashboard — Themes section

Same shape as Library:

- List all themes (admin-created + user-submitted) with status filters
- Publish / schedule / unpublish
- Set tier
- Feature toggle
- Review user submissions

PostHog tracks which themes get loaded, which get changed away from, time-on-theme — feeds into commissioning priorities.

**Reference:** `15-themes.md`, ADR-011 (planned)

---

## Phase 10 — UI Design Polish Pass

> **Status:** New phase. Design-led. Slot after Themes so polish lands on a stable architecture and real multi-language / multi-theme content.

**Goal:** The final visual polish to make the product feel slick and considered, not assembled.

This is intentionally last among the architecture-affecting phases. Polishing before the architecture is right means re-polishing later. By Phase 10:

- Devanagari and Hindi voices render real content (not English placeholders)
- Multiple themes exercise the design system across colour ranges
- PostHog data reveals which surfaces matter most (where users spend time, where they bounce)
- The admin dashboard, library, talker, categories, lists, sentences, settings — all stable

### 10.1 Surface audit

Walk every page in every theme + every locale. Catalogue every visual inconsistency, every layout jank, every micro-interaction that feels off. Output: a Figma board with annotated screenshots.

### 10.2 Design exploration in Figma + Claude Design

Use Figma + Claude Design tooling to flesh out the best possible look. Focus areas (informed by PostHog data):

- Home dashboard (the daily-touch surface)
- Talker bar (the AAC-defining surface)
- Symbol cards (the most-rendered element)
- Onboarding (the first impression)
- Library / pack browsing (the discovery surface)
- Settings (the parent-touching surface)

### 10.3 Implementation pass

Translate Figma decisions into the existing token system. Most polish should be token tweaks, not structural rewrites — if a polish change requires structural work, that signals a deeper design problem worth pausing for.

### 10.4 Accessibility + density audit

Visual polish must not regress accessibility (contrast ratios, focus rings, hit targets) or readability (line lengths, font sizes, especially for Devanagari and other non-Latin scripts).

---

## Phase 11 — Home/School Connection Review

> **Status:** Review-and-rescope phase, not a build. The original separate-app architecture (convex-identity + convex-school + shared invite codes) may have been **accidentally solved** by the existing `accountMembers` invite system + per-profile `stateFlags`. See the hypothesis below.

### Home/School Hypothesis — Did We Already Solve This?

The original plan (see `07-home-school-connection.md`) envisaged two separate apps — Mo Speech Home and Mo Speech School — connected via a third Convex project (`convex-identity`) that holds shared student identity and brokers cross-app sharing.

Looking at what's already shipped in this build:

| Original plan need | What's already in the codebase |
|---|---|
| Teacher sees the student's profile | `accountMembers` invite flow (Phase 1 + `08-family-members.md`) — anyone with the email can be invited as a collaborator and gets full AAC access to the student profile |
| Per-context settings (home vs school) | Per-profile `stateFlags` on `studentProfiles` already differ profile-by-profile. A parent could create a "school" profile vs a "home" profile within the same account with different settings each. |
| Student switches between home/school setup | Active profile switching is already implemented (`setActiveProfile` mutation). |
| Cross-environment consistency | Multiple collaborators (parent + teacher) editing the same student profile see each other's changes live via Convex subscriptions. |
| Sharing a category from school to home | If teacher and parent are both collaborators on the same account, no "sharing" is needed — they both already see and edit the same content. |

The original plan was designed around the assumption that home and school would be **separate accounts** that needed to be **bridged**. The Phase 1 + Phase 3 architecture instead made them **the same account with multiple collaborators**, which is a strictly simpler and more consistent model.

What might still be needed (and what's worth confirming during this review):

1. **Teacher-as-collaborator with restricted role.** Right now `accountMembers.role` is `"owner" | "collaborator"` with the latter having full edit rights. Teachers might want a `"viewer"` or `"editor-with-restrictions"` role — e.g., can see and use the talker but can't change billing or invite others. Trivial schema extension.
2. **Multi-account teachers.** A teacher supports multiple students from multiple families. The current model would require the teacher to accept invites from each family separately — N invites for N students. That's actually fine UX-wise (each family explicitly chooses to invite the teacher), but worth confirming with real teachers.
3. **Classroom modelling.** Modelling mode is one-to-one in the current build. A teacher modelling to multiple students simultaneously (the original Mo Speech School premise) would need a new architecture — but this is an edge case worth deferring until there's a real teacher asking for it.
4. **Sharing between unconnected accounts.** Parent A's teacher wants to share a category with Parent B's teacher. This is the only scenario the original convex-identity model handles that the collaborator model doesn't. It's rare enough to defer until proven needed — a simple "export this category as JSON, import into another account" feature would cover most cases.

### What this phase actually delivers

- **Audit the hypothesis** above with real teacher conversations once the product is in their hands
- **If the hypothesis holds:** delete or shrink `convex-identity` scope, archive the cross-project HTTP-action work, mark Mo Speech School as not separately built
- **If the hypothesis partially holds:** ship the small additions identified above (e.g., a `"viewer"` role) as targeted additions rather than a separate-app architecture
- **If the hypothesis fails:** revisit the original `07-home-school-connection.md` plan with whatever was learned

The original Phase 9 content (cross-project HTTP actions, sharing inbox, shareRequest table) is preserved in `07-home-school-connection.md` as the fallback plan if this review concludes the separate-app architecture is genuinely needed. The Convex schema for `convex-identity` is already defined; nothing is lost by deferring the work.

**Reference:** `07-home-school-connection.md` (original plan, fallback only), `08-family-members.md` (the architecture that may have solved this)

---

## Phase 12 — Affiliates

**Goal:** Admin can grant affiliate status; Stripe Connect handles automatic payouts.

- `affiliates` and `commissionEvents` tables already in schema
- Admin User Settings page: affiliate section with four states (none / form / invited / active) — plugs into Phase 7's admin dashboard
- Stripe Connect Express account creation via API
- `account_link` generation and invite email
- `account.updated` webhook handler → set status to `"active"`
- Referral code cookie on signup
- `commissionEvent` creation on `checkout.session.completed` and `invoice.payment_succeeded`
- Automatic Stripe transfer to affiliate's connected account

**Reference:** `16-affiliates.md`

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
