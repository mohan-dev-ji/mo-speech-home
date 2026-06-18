# In-App Home Page — Implementation Plan

## Context
The in-app Home (`/[locale]/(app)/home`) is currently a Phase-5 placeholder
(`HomeContent.tsx` renders "Home — Phase 5"). We're replacing it with the final
Figma design: a **links-and-library landing page**. Three zones:

1. **Library packs** — heading + copy + "Add more packs" button beside a horizontal
   row of loadable Pack-cards (Load / Already-Loaded), reusing the existing
   `resourcePacks` Convex layer.
2. **Nav cards** — 4 icon cards linking to Categories / Lists / Sentences / Search.
3. **Create cards** — 4 "+" cards opening the existing create modals.

Design source (FINAL — the `docs/3-design/screens` PNGs are deprecated):
Figma file `3DAZYuK3A1TrkeZnyGwE1o` ("Mo Speech — Finals"), Home frame `1391:20546`.
- Library-packs block `1403:22954`; Pack-card (home) `1432:20808`; Home-card `1431:21111`.

### Decisions (confirmed with user)
- **Pack-card**: build a **fresh app-side** component matching Figma, calling the
  `resourcePacks` Convex functions directly. Do **not** reuse the marketing
  `LibraryPackCard`/`LoadPackButton` (auth-coupled to Clerk sign-up/upgrade routes +
  localStorage resume + marketing styling that fights the design). Reuse only the
  Convex query/mutation layer.
- **Create a Symbol**: open the existing `SymbolEditorModal` in `categoryBoard` mode
  with an added **category-picker**, and only allow Save once a category is chosen.
  The modal *already* gates save on category (`if (!draft.profileCategoryId)` →
  `errorNoCategory`, line 620) and already queries `getProfileCategories` internally —
  it just renders no picker UI today. So this is a small additive change.

### Hard rules (CLAUDE.md)
- Theme tokens only — no hard-coded colours/spacing/radii/font-sizes in AAC UI.
- New copy → `messages/en.json` ONLY (never hand-add to other locales).
- Components under `app/components/app/home/{sections|ui}/`; `page.tsx` stays thin.

---

## Token map (Figma var → app utility/class, verified in `app/globals.css`)
| Figma | App |
|---|---|
| `--card` (rgba .08 translucent) | `bg-theme-card` |
| `--pack-bg` (rgba .25) | `bg-theme-pack-bg` |
| `--symbol-bg` (#FAFAFA white thumb) | `bg-theme-symbol-bg` |
| `--theme-pill-bg` | `bg-theme-pill-bg` |
| `--theme-card-roundness` 16px | `rounded-theme-card` |
| `--theme-pack-card-roundness` 20px | `rounded-theme-pack` (pack-card) |
| `--theme-chip-roundness` 999px | `rounded-theme-chip` (tier pill) |
| `--roundness` 8px (thumb) | `rounded-theme-sm` |
| h4 24px SemiBold `--alt-text` | `text-theme-h4` + `text-theme-alt-text` |
| `--button-primary` / `--button-secondary` | `bg-theme-button-primary` / `text-theme-button-secondary` |
| `--enter-mode` #FF6900 (Max tier pill text) | `text-theme-enter-mode` |
| Elevation/Subtle drop-shadow | `elevation-subtle` |
| `--general-padding` 16 / `--general-space-between` 16 | `p-theme-general` / `gap-theme-gap` |
Icons via **lucide-react** (already used across app): `Tag`, `ListChecks`,
`AlignJustify`, `Search`, `Plus`.

---

## Stage 1 — HomeContent scaffold + three-zone layout
**File:** `app/components/app/home/sections/HomeContent.tsx` (rewrite the placeholder)
- Client component. Hooks: `useTranslations('home')`, `useProfile()`
  (`accountId`, `language`, `voiceId`, `viewMode`), `useParams()` → `locale`,
  `useRouter()`.
- Container mirrors existing pages (see `CategoriesContent.tsx`):
  `flex flex-col px-theme-mobile-general py-theme-mobile-general md:px-theme-general
  md:py-theme-general gap-theme-mobile-gap md:gap-theme-gap`, scroll body in
  `flex-1 overflow-auto`.
- **No PageBanner** — the Figma Home has no in-content banner zone (global Topbar/Navbar
  are app-shell, already present). Drop the `talkerMode === 'banner'` banner block.
- Composes three sections in order: `<LibraryPacksSection/>`, `<HomeNavCards/>`,
  `<HomeCreateCards/>`. Owns modal state for the create cards (lifted here) and renders
  the four create modals at the bottom.
- `page.tsx` (`app/[locale]/(app)/home/page.tsx`) stays as-is (thin, already correct).

## Stage 2 — Card components (`app/components/app/home/ui/`)
**`HomeCard.tsx`** (Figma `1431:21111`) — shared by nav + create rows.
- Props: `{ title: string; icon: React.ReactNode; onActivate: () => void; }`
  (parent decides nav-via-router vs open-modal; card itself is a `<button>`).
- Layout: `bg-theme-card rounded-theme-card` column, centered, internal 32px gap
  (use `gap-8` ≈ Figma `--card-padding` 32px), title `text-theme-h4
  text-theme-alt-text`, icon block (24px glyph). Full card clickable, hover/focus state.

**`PackCard.tsx`** (Figma `1432:20808`) — fresh, theme-tokenised.
- Props: `{ pack, locale, isLoaded, isLoading, onLoad }` where `pack` is one
  catalogue entry from `getPublicLibraryCatalogueV2` (`slug`, `name`, `coverImagePath`,
  `tier`, `isStarter`, `counts`, …).
- Layout (top→bottom): **TierPill** (`bg-theme-pill-bg rounded-theme-chip`, per-tier
  text colour — Max→`text-theme-enter-mode` orange, confirm pro/free colours from
  Figma during build) → **pack name** `text-theme-h4` → **white thumbnail**
  `bg-theme-symbol-bg rounded-theme-sm p-theme-general`, image
  `/api/assets?key=${encodeURIComponent(pack.coverImagePath)}` `object-contain`
  (matches marketing `LibraryPackCard` image pattern) → **Load button** full-width 44px
  `rounded-theme-button elevation-subtle`.
- Button states: **Already Loaded** (disabled, `opacity-50`, per Figma) when
  `isLoaded`; **Loading…** while the mutation runs; otherwise **Load** (active,
  primary/pink per design). Container `bg-theme-pack-bg rounded-theme-pack p-theme-general`.

## Stage 3 — Nav cards + Create cards (`app/components/app/home/sections/`)
**`HomeNavCards.tsx`** — row of 4 `HomeCard`s. `onActivate` →
`router.push(\`/${locale}/{categories|lists|sentences|search}\`)`. Icons: Categories→`Tag`,
Lists→`ListChecks`, Sentences→`AlignJustify`, Search→`Search`. Responsive grid
`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-theme-gap`.

**`HomeCreateCards.tsx`** — row of 4 `HomeCard`s (icon `Plus`). Each `onActivate` opens
a modal whose open-state lives in `HomeContent`. Wire to the existing modals (reused
as-is, all standalone-friendly):
- **Create a Category** → `app/components/app/categories/modals/CreateCategoryModal.tsx`
  — `onCreate(name, symbolLabels)` calls `api.profileCategories.createProfileCategory`
  (mirror `CategoriesContent` handler), then optionally route to the new category.
- **Create a List** → `app/components/app/lists/modals/CreateListModal.tsx`
  — `onCreate(name, steps)` → list create mutation (mirror `ListsModeContent`).
- **Create a Sentence** → `app/components/app/sentences/modals/CreateSentenceModal.tsx`
  — `onCreate(name)` → sentence create mutation (mirror `SentencesModeContent`).
- **Create a Symbol** → `SymbolEditorModal` (Stage 5) with `accountId`/`language`/
  `voiceId` from `useProfile()`, `editorMode='categoryBoard'`, **no** `profileCategoryId`,
  new `allowCategoryPick` flag on.

## Stage 4 — Library-packs section
**File:** `app/components/app/home/sections/LibraryPacksSection.tsx`
- Left copy block: heading + body + "Add more packs" `Button` (shared atom) →
  `Link href={\`/${locale}/library\`}` (the public library index,
  `app/[locale]/(public)/library/page.tsx`; works while signed in).
- Convex (client `useQuery`/`useMutation`, no marketing preload):
  - `useQuery(api.resourcePacks.getPublicLibraryCatalogueV2, {})` → pack list.
  - `useQuery(api.resourcePacks.getMyLoadedPackSlugs, {})` → `string[]`.
  - `useMutation(api.resourcePacks.loadResourcePackV2)` → `{ packSlug }`.
- `isLoaded = pack.isStarter || loadedSlugs.includes(pack.slug)` (matches marketing logic).
- On Load: call mutation, show loading state on that card; on success toast/refresh
  (queries are reactive so the card flips to Already-Loaded automatically). On error,
  handle `TIER_REQUIRED` via the existing upgrade-nudge/toast pattern used in
  `CategoriesContent` (keep Figma's Load/Already-Loaded button states; don't invent an
  Upgrade state in the card itself).
- Horizontal row of `<PackCard/>` (Figma uses 6–7 cards; render all catalogue entries,
  horizontally scrollable on narrow widths).

## Stage 5 — SymbolEditorModal: additive category-picker
**File:** `app/components/app/shared/modals/symbol-editor/SymbolEditorModal.tsx`
- Add optional prop `allowCategoryPick?: boolean` (default false → existing call sites
  unaffected).
- When `allowCategoryPick && editorMode === 'categoryBoard'`, render a category
  **`Dropdown`** (shared atom `app/components/app/shared/ui/Dropdown.tsx`) at the top of
  the editor, options from the already-fetched `categories` query (line ~238), value
  bound to `draft.profileCategoryId`, `onChange` → `setDraft({ profileCategoryId })`.
- **No new save logic** — the existing guard `if (!draft.profileCategoryId) →
  errorNoCategory` (line 620) already enforces "save only when a category is chosen."
  `errorNoCategory` key already exists in `en.json`.

## i18n — `messages/en.json` `home` namespace (en-only, rule #1)
Add keys (camelCase), e.g.:
- `libraryPacksHeading` = "Library packs"
- `libraryPacksBody1` = "You can load pre-made categories, lists and sentences from the Resource Library."
- `libraryPacksBody2` = "Each account comes with the starter pack which has 16 categories, 12 lists and 12 sentences that you can use to get started."
- `addMorePacks` = "Add more packs"
- `packLoad` = "Load", `packLoaded` = "Already Loaded", `packLoading` = "Loading…"
- `navCategories`/`navLists`/`navSentences`/`navSearch` = "Categories"/"Lists"/"Sentences"/"Search Symbols"
- `createSymbol`/`createCategory`/`createList`/`createSentence` =
  "Create a Symbol"/"Create a Category"/"Create a List"/"Create a Sentence"
- `chooseCategory` = "Choose a category" (picker label)
(Reuse existing nav/category/list/sentence keys where already present; only add the missing ones.)

---

## Files summary
**New:** `home/ui/HomeCard.tsx`, `home/ui/PackCard.tsx`,
`home/sections/LibraryPacksSection.tsx`, `home/sections/HomeNavCards.tsx`,
`home/sections/HomeCreateCards.tsx`.
**Rewrite:** `home/sections/HomeContent.tsx`.
**Extend (additive):** `shared/modals/symbol-editor/SymbolEditorModal.tsx`.
**Edit:** `messages/en.json` (home namespace).
**Reused as-is:** the 3 create modals; `resourcePacks` Convex functions; shared atoms
`Button`/`IconButton`/`Dropdown`; `useProfile`.

---

## Verification
1. `npx tsc --noEmit` — clean (Node 20+ if Convex types regenerate).
2. Drive the signed-in app at **localhost:3000** via the **Claude-in-Chrome MCP**
   (dev server is already running — do NOT start a second):
   - Home renders all three zones matching Figma `1391:20546`.
   - **Nav cards** route to `/categories`, `/lists`, `/sentences`, `/search`.
   - **Create cards** open the correct modals; creating a Category/List/Sentence
     persists and appears on its page.
   - **Create a Symbol**: modal opens with a category Dropdown; Save is blocked until a
     category is selected (shows `errorNoCategory`), then saves into the chosen category.
   - **Library packs**: catalogue renders; already-loaded packs (incl. starter) show
     "Already Loaded" (disabled); an unloaded pack shows "Load", loads on click and
     flips to "Already Loaded" reactively; "Add more packs" navigates to `/library`.
   - Theme switch (per profile) restyles all cards (confirms no hard-coded values).