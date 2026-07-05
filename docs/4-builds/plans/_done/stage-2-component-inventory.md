# Stage 2 — Component Inventory & Figma↔Code Map

> **Self-contained.** The shared map between the Figma "Mo Speech — Finals" **Components page**
> (`fileKey 3DAZYuK3A1TrkeZnyGwE1o`, page `3004:2218`) and the app's React components.
> Sequel to `code-design-system-migration.md` (Stage 0/1 done — tokens shipped + surface/card remap
> + refresh-flash fixes). This is the recon that drives Stage 2 (component binding).

## The sync model (how the two stay aligned)
- **Figma owns the component library** — visual design, variants, token bindings.
- **Code owns the application** — composition, real copy, data, behaviour, layout.
- **Contract = 1:1 component↔component**, made literal by (a) **shared tokens** (done, Stage 1) and
  (b) **Code Connect** (`.figma.tsx` mapping files — set up per component once names are aligned).
- Sync is **per-component, not per-screen** → not building every screen in Figma is correct.
  The only risk is *component drift*; the inventory + Code Connect make it visible.

## Status legend
- 🆕 **new** — build in code · 🔁 **rebind** — exists, retoken to Figma spec ·
  🔀 **consolidate** — merge several code components into one variant-driven component ·
  🎨 **asset** — not a code component.

## Tokens referenced by these components (all exist after Stage 1)
`Button-roundness`→`rounded-theme-button` · `Card-roundness`→`rounded-theme-card` ·
`Chip-roundness`→`rounded-theme-chip` · `Small-Roundness`→`rounded-theme-sm` ·
`Pill-bg`→`bg-theme-pill-bg` · `Pack-bg`→`bg-theme-pack-bg` · `Surface`→`bg-theme-surface` ·
`Card`(translucent)→`bg-theme-card` · `Primary-50/-25`→`bg-theme-primary-50/-25` ·
`Button-primary/-secondary`→`--theme-button-primary/-secondary` · `Elevation/Subtle`→`.elevation-subtle`.
Non-theme: `Transparencies/black-20`→`rgba(0,0,0,.2)`; **Category-folder colours are per-category
dynamic** (folder = category colour @ 20%, thumb = category colour @ 100%) — not theme tokens.

---

## Inventory

### Atoms
| Figma component | Variants | Code target | Status | Key spec |
|---|---|---|---|---|
| **Icon-button** `3080:251` | Primary / Neutral / Ghost | `shared/ui/IconButton.tsx` | 🆕 | 48², `rounded-theme-button`, pad 12, `elevation-subtle`. Primary=`button-secondary` fill, Neutral=`button-primary` fill, Ghost=transparent. Icon-only |
| **Button** `1446:22551` | Primary / Secondary / Disabled / Toggle-on / Edit-mode | `shared/ui/Button.tsx` (+ retire `EditButton`, `CreateButton`, `ToggleButton`) | 🔀 | h44, `rounded-theme-button`, pad 8/16, gap 8, `elevation-subtle`. Primary=`button-primary` bg+`button-secondary` text; Secondary=inverse; Toggle-on=`button-highlight`; Edit-mode=`enter-mode` |
| **Tier-pill** `3109:291` | Free / Pro / Max | `shared/ui/PlanTierPicker.tsx` (+ reconcile `SubscriptionBadge.tsx`) | 🔁 | `bg-theme-pill-bg`, `rounded-theme-chip`, pad 4/12. Text: Free=`success`, Pro=`primary`, Max=`enter-mode` |
| **tag** `1439:23546` | — | `categories/ui/LibrarySourceBadge.tsx` | 🔁 | pill r99, `bg-theme-banner`, pad 8/16, text=`alt-text`. ("From Starter Pack") |
| **Logo** `3029:4219` | Default / no-text | `shared/ui/LogoSvg.tsx` | 🔁 | add **no-text** variant (glyph only, 17×22); both `fill=primary` |
| **Navbar-button** `1433:21520` | Default / on | `shared/ui/NavTabButton.tsx` | 🔁 | inactive=**no fill**+`secondary-alt-text`; active=`bg-theme-surface`+`rounded-theme-button`+`alt-text`+`elevation-subtle`. **Visual change**: inactive goes filled→text-only |

### Inputs & controls
> **Surface = the cohesion token.** `bg-theme-surface` is the shared background that visually ties the
> **Dropdown** (topbar mode-view), the **active Navbar-button**, and the **search bar** together. Keep
> these three on `surface` so the chrome reads as one system.

| Figma component | Variants | Code target | Status | Key spec |
|---|---|---|---|---|
| **Dropdown** `3153:681` | — | `shared/ui/Dropdown.tsx` (unify `BreadcrumbViewModeDropdown` + `PackFilterDropdown` triggers) | 🆕 | `bg-theme-surface` + `border-theme-line` + r4 (raw — consider tokenising), pad 4, gap 8, label=`alt-text`, chevron. **Shares `surface` with active Navbar-button + search bar** |
| **search** `3017:2212` | — | `shared/ui/SearchBar.tsx` (extract from `search/sections/SearchContent.tsx`) | 🆕 | pill r99, `bg-theme-surface`, pad 12/16, text=`alt-text`, mic chip=`pill-bg`. Uses surface/line/alt-text |
| **voice** `1454:25145` | Enabled / Disabled | `settings/ui/VoiceCard.tsx` (inline today in profile modal) | 🆕 | `rounded-theme-sm`. Enabled=`button-highlight` bg; Disabled=`button-primary` bg. Preview chip flips token |
| **Theme-picker-module** `3027:4093` | — | `settings/ui/ThemeSwatch.tsx` (inline today) | 🆕 | `bg-theme-background`, `rounded-theme-sm`, pad 8/16, dot=`primary`, text=`alt-text` |
| **Tab** `3028:4334` | on / off | `shared/ui/Tab.tsx` | 🆕 (Stage 2.5) | text-only; on=`alt-text`+Primary underline; off=`secondary-alt-text` |
| **Tab-bar** `3028:4366` | — | `shared/ui/TabBar.tsx` | 🆕 (Stage 2.5) | row of Tab, gap 32 |

### Symbol & content cards
| Figma component | Variants | Code target | Status | Key spec |
|---|---|---|---|---|
| **grid-symbol** `1435:22432` | Symbol / Symbol-search / Symbol-edit | `shared/ui/SymbolCard.tsx` (+ `categories/ui/SymbolCardEditable.tsx` for edit) | 🔁 | base Symbol=no card bg, `Frame64=symbol-bg`, label+icon=`text`(dark, stays legible). **Symbol-edit ✅ DONE**: `SymbolCardEditable` rebound — `bg-theme-card` + stroke-2 dashed `border-theme-enter-mode` + `EditPanel` (Delete/Edit/Move `sm` IconButtons, flex-wrap). **Symbol-search** still TODO = `bg-theme-card` + single pencil Icon-button |
| **Category-folder** `3017:2352` | Default / Edit-mode | `categories/ui/CategoryTile.tsx` | 🔁 (major) | **Simplified**: no folder shape. fill=**category colour @20%**, `rounded-theme-card`, pad 20, thumb=category colour @100%, `tag`=banner, title=`alt-text`, source=`secondary-alt-text`. **Edit-mode** pops to a card with `Icon-button`s + dashed line; **width unchanged** (honours grid) |
| **List-item** `3025:2524` | Default / List-item-edit | `lists/sections/ListDetailEdit.tsx` (Row/Column/Grid) | 🔁 ✅ **edit rows done** — bespoke delete/move → `EditPanel` (`sm` IconButtons, flex-wrap). |
| **List-item-EDIT** `3025:2324` | List-strip / List-strip-edit | `lists/sections/ListsModeContent.tsx` (overview) + `sentences/.../SentencesModeContent.tsx` | 🔁 ✅ **DONE** — `bg-theme-card`+`rounded-theme-card`+stroke-2 dashed; bespoke edit buttons → `EditPanel`; **overflow fixed**: `flex-wrap` so the right cluster (badge+edit-panel) drops below (grows Y), never widens past the content area. Verified overflowX=0 at 380–640px. |
| **Pack-card** `1432:20808` | — | `app/.../PackCard.tsx` | 🆕 | home pack card (distinct from marketing `LibraryPackCard`). `bg-theme-pack-bg`, `rounded-theme-card`, pad 16, embeds `Tier-pill` + `Button`, symbol=`symbol-bg` |
| **Home-card** `1431:21111` | — | `home/ui/HomeCard.tsx` | 🆕 | `bg-theme-card`, `rounded-theme-card`, title=`alt-text`. For the (unbuilt) home page |

### Chrome & shell
| Figma component | Variants | Code target | Status | Key spec |
|---|---|---|---|---|
| **Navbar** `1431:20866` | Full / Minimal | `shared/sections/Sidebar.tsx` | 🔁 | **no bg colour — edge line** instead (new layout). Logo=`primary`, items=`secondary-alt-text`. Add **Minimal** (84w icon-only) variant |
| **Topbar** `3025:2796` | — | `shared/sections/TopBar.tsx` | 🔁 | **transparent**, pad x16. Mode-view dropdown now `bg-theme-surface`; text=`alt-text` |
| **Talker** `3017:2185` | — | `shared/ui/TalkerBar.tsx` · `Header.tsx` · `TalkerDropdown.tsx` | 🔁 | `rounded-theme-card`. Topline=`primary-50`, stage=`background`, chips on `card`. **Full-width dropdown** = full rectangle + roundness |
| **Banner** `3025:2585` | — | `shared/ui/Banner.tsx` (+ `PageBanner`, `categories/ui/BannerEdit`, `AdminPackEditingBanner`) | 🔀 | **one banner for all** across the app. `bg-theme-card`, `rounded-theme-card`, pad 32. Title=`alt-text`, buttons=`Button` |
| **Edit-panel** `3017:2263` | vertical / Horizontal | `shared/ui/EditPanel.tsx` | 🆕 | cluster of `Icon-button`s (4), vertical or horizontal. Used by symbol/category edit affordances |

### Assets
| Figma component | Code target | Status |
|---|---|---|
| **Pack-images** `1432:20787` (13 pack thumbnails) | R2 pack assets / library pack images | 🎨 not a code component |

---

## Naming policy
**Same *words*, platform-native *casing*.** Code Connect maps explicitly (the `.figma.tsx` file points
a Figma node at a code component) so names never need to be byte-identical — and can't be, since JS
identifiers forbid hyphens. So Figma keeps its kebab convention (`Category-tile`) and code keeps Pascal
(`CategoryTile`); that deterministic pairing is correct, not a quirk. Only the **words** must match
(that's why `folder`→`tile`). The canonical pairing for each component is the "code target" column above
and is encoded in the `.figma.tsx` mapping.

## Figma renames (✅ applied this pass)
- `Category-folder` → **`Category-tile`** (set `3017:2352`) — word now matches code `CategoryTile`.
- Edit-panel variant typo + casing: `vetical`/`Horizontal` → **`vertical`/`horizontal`**.
- Variant **property** names `Property 1` → meaningful: `variant` (Button, grid-symbol, List-item-EDIT,
  Logo, Navbar), `state` (Navbar-button, voice, Category-tile, List-item, Tab), `orientation` (Edit-panel),
  `pack` (Pack-images). Kept `Style` (Icon-button), `Tier` (Tier-pill). (Renaming doesn't break instances.)
- Useful for Code Connect: **Button** also exposes component properties `Text` + `icon-left`.

**Still-mismatched words (need code renames too — deferred, separate pass):**
`Navbar-button`↔`NavTabButton`, `grid-symbol`↔`SymbolCard`, `Tier-pill`↔`PlanTierPicker`.

## Consolidation proposals (fewer code components, mirroring Figma)
1. **Button family** → one `Button` with `variant`: `primary | secondary | disabled | toggle | edit-mode | create`. Retire `EditButton`, `CreateButton`, `ToggleButton` (they are ~90% styling + a baked icon + `onClick`). `create` keeps the green `--theme-create`; `edit-mode` the orange `--theme-enter-mode`. Figma `Button` also exposes `Text` + `icon-left` props. **NOT part of this**: `Navbar-button`/`NavTabButton` is a separate component (nav on/off state) — its `Toggle-on` look is unrelated to Button's `toggle` variant.
2. **Banner family** → one `Banner` with `variant`/slots, absorbing `PageBanner`, `BannerEdit`, `AdminPackEditingBanner` (Figma already unified these).
3. **Tier UI** → reconcile `PlanTierPicker` + `SubscriptionBadge` against the single `Tier-pill`.
4. **IconButton** becomes the shared atom for all icon-only affordances (Edit-panel, symbol/category edit, talker controls, topbar).

## Suggested Code Connect order (after semantic alignment)
Prove the round-trip on **Button** first (highest reuse, clean variants), then Icon-button, NavTabButton,
Tier-pill — then the rest. Each: align name/variants → build/rebind code → add `.figma.tsx` mapping → tick here.

## Built in code (✅ Stage 2 progress)
- **Button** `1446:22551` → `shared/ui/Button.tsx` — consolidated variant button; wrappers retired to thin delegates. ✅
- **Dropdown** `3153:681` → `shared/ui/Dropdown.tsx` — surface+line atom; `PackFilterDropdown` wraps it. ✅
- **Banner (slice)** → `PageBanner` + category-detail header/edit rebound. ✅
- **Navbar-button** `1433:21520` → `shared/ui/NavTabButton.tsx` — ✅ **done + validated live**. Inactive = transparent + `secondary-alt-text` + normal weight; active = `bg-theme-surface` pill + `border-theme-line` (1px, transparent when idle → no width shift) + `rounded-theme-button` + `alt-text` + semibold + `elevation-subtle`. **Companion change:** `Sidebar.tsx` dropped `glass-surface` → transparent + `border-r border-theme-line` (the Navbar "no bg — edge line" direction) so the surface pill reads against the page `background`; `TalkerDropdown` tab strip got `bg-theme-background` (the Talker "stage") so its pills read inside the surface popover. (Full Navbar/Talker rebinds still deferred.)
- **Icon-button** `3080:251` → `shared/ui/IconButton.tsx` — ✅ **built + first consumer live**. 24² glyph, `rounded-theme-button`, `elevation-subtle`. `primary`=`button-secondary` fill + `button-primary` glyph; `neutral`=`button-primary` fill + `button-secondary` glyph + line; `ghost`=transparent + line + `alt-text` glyph. Required `label`→`aria-label`. **Added `size`**: `md`=48² (default), `sm`=32² (`size-8`, the Edit-panel cluster) — glyph stays 24².
- **Edit-panel** `3017:2263` → `shared/ui/EditPanel.tsx` — ✅ **new atom built + 2 consumers live**. Composition-only flex cluster of IconButtons; `orientation` horizontal / vertical (`flex-col`), `gap-theme-elements`, **NO x/y padding** (owner removed it in Figma so it slots into any host without inflating padding — the host owns surrounding spacing). Consumer passes the subset it needs. Pass `className="flex-wrap"` to keep host width fixed + grow height.
- **Category-tile** `3017:2352` → `categories/ui/CategoryTile.tsx` — ✅ **rebound + validated live**. Folder shape + `LibrarySourceBadge` tag REMOVED. Default = soft card, bg **c500 @ 30%** (matches the detail banner, owner steer over Figma's 20% sample), `rounded-theme-card`, `p-theme-folder`, centred title on top (`text-theme-alt-text`, `font-normal`, responsive `cqi` clamp), c100 thumb box (`rounded-theme-sm`, `aspect-square`). Edit mode = **stroke-2 dashed CSS border** on the tile (`border-2 border-dashed border-theme-enter-mode`; `border-transparent` idle → no shift) + injected `<EditPanel className="flex-wrap">` with **Delete** (`text-theme-warning` glyph) + **Move** (dnd handle) `sm` IconButtons. **`flex-wrap` keeps tile WIDTH fixed and grows HEIGHT** (buttons stack vertically in dense `small` grid) — grid settings always honoured. Admin `PackStatusLabel` kept below thumb. i18n keys `categories.deleteCategory/moveCategory` (en-only).

## Decisions (✅ approved by owner)
- **NavTabButton** visual change confirmed — inactive nav goes filled → text-only; active = surface pill.
- **Button consolidation** confirmed — one variant `Button`; retire `EditButton`/`CreateButton`/`ToggleButton`.
- **Banner consolidation** confirmed — one `Banner`; absorb `PageBanner`/`BannerEdit`/`AdminPackEditingBanner`.
- Figma renames confirmed + applied (see above).
