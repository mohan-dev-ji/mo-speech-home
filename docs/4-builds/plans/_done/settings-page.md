# Settings Page — Tile-Grid+Modals → Tabbed Inline Page

## Context

The in-app Settings page currently renders a 2-column **tile grid** (`SettingsContent.tsx`) where each
tile opens a **modal** (`Dialog`) containing that section's controls. The final Figma design
("Mo Speech — Finals", file `3DAZYuK3A1TrkeZnyGwE1o`) replaces this with a **single tabbed page**: a
top Tab-bar, and under the active tab a vertically-scrolling stack of **inline section-card modules**
(no modals). All functionality is already wired to Clerk / Convex / Stripe — this is a
**restructure + restyle with zero functionality loss**, not a rewrite of the logic.

**Confirmed decisions (from the user):**
1. **Auto-save inline on all tabs** — every picker persists immediately via its existing mutation /
   context setter. Drop the `Confirm/Cancel` footer. Instructor UI-language change keeps its
   reload-on-click behaviour (still fires immediately, no confirm step).
2. **Port all 6 tabs now**, including the four with no Figma panel design (Account & Billing, Navbar,
   Invites, Data & Privacy) — styled with the same translucent **section-card + label** pattern as the
   two designed tabs.
3. **Extra Student-Profile controls** (name edit, page/editing permissions, talker/banner header mode,
   delete-profile) become **additional section-cards** below the designed five, in the Student Profiles
   tab.
4. **Delete the unused legacy modals** (`GridModal`, `SymbolsModal`, `ScaffoldModal`).

## Design recon (what the Figma actually specifies)

Two frames are fully designed; both share an identical module stack:

| Frame | Node | Tab active | Notes |
|---|---|---|---|
| Settings — Instructor profile | `1459:22670` | Instructor Profile | Languages → Voices → Theme → Grid → Symbols |
| Settings — Student profiles | `1459:22963` | Student Profiles | Same stack + **secondary student-selector Tab-bar** (`3028:4556`) + **Create-new-profile Button** (`1459:23370`) above the module stack |

Page chrome (both): `Navbar` (left, exists) · `Topbar` (`3027:4160`, breadcrumb + mode-view dropdown +
quick-settings icon, exists) · `Main` containing a **Tab-bar** then the active tab's module frame.

**Tab-bar** (`3028:4366`, Tab = `3028:4334`): full-width row, `gap-32`, bottom border `--theme-line`
3px; each Tab `flex-1`, centered, `p-12`. **Active** Tab: text `--theme-alt-text` SemiBold + 3px bottom
border `--theme-primary`. **Inactive**: text `--theme-secondary-alt-text` Regular, no underline. Six
labels: Instructor Profile · Student Profiles · Account & Billing · Navigational Side Bar · Invites ·
Data & Privacy.

**Section-card** (repeating wrapper, e.g. `1459:22715` "Languages"): translucent card
(`bg-theme-card`, `rounded-theme-card`), inner pad 32, a **Label** (h-ish text, `--theme-alt-text`) then
the picker row below it (gap 16). This is the one reusable shell every module sits in.

**Section pickers:**
- **Language-picker** (`1459:22718`): row of 3 full-width `Button`s (`flex-1`, gap 16); active = orange
  highlight. (= existing language buttons.)
- **Voice-picker** (`1459:22726`) → **VoiceCard** (`1454:25145`, name "voice"): card `rounded-theme-sm`,
  `p-16`, gap 8. Enabled/selected = `bg-theme-button-highlight` + light text; unselected =
  `bg-theme-button-primary` @ 50% opacity + `button-secondary` text. Contains gender title (SemiBold) +
  region subtitle (Regular) + a **Preview** chip (full-width, `volume-high` icon, flips fill by state).
- **Theme-picker** (`1459:22732`) → **Theme-picker-module** (`3027:4093` selected / `3027:4094`
  unselected): `bg-theme-background`, `rounded-theme-sm`, border = `--theme-primary` when selected; a
  Top row (color dot 16px + title SemiBold `alt-text`) + hairline divider + mode label ("Dark")
  Regular. 6 swatches per row, gap 16.
- **Grid-size-picker** (`1459:22785`): 3 cards Large/Medium/Small (`flex-1`), each a label + a visual
  squares-preview; active = orange. (Display-only preview; size has no effect on symbol count.)
- **Symbols** (`1459:22837`): a **Checkbox Group** ("Display text label", `1459:22840`) then a "Text
  size" label + **Text-size-picker** (`1459:22842`) = 3 cards Large/Medium/Small showing a scaled "Aa";
  active = orange. Text-size disabled/greyed when label off (existing behaviour).

New components flagged 🆕 in `docs/4-builds/stage-2-component-inventory.md`: Tab, Tab-bar, VoiceCard,
Theme-picker-module; **Tier-pill** (`3109:291`) maps to existing `shared/ui/PlanTierPicker.tsx` /
`SubscriptionBadge` (rebind) for the Account tab.

## Existing functionality to preserve (the contract)

Tab → current source → persistence (all already wired):

| Tab | Current modal | Mutations / context |
|---|---|---|
| Instructor Profile | `InstructorProfileModal` | `api.users.setMyLocale` · `setMyInstructorGridSize` · `setMyInstructorSymbolTextSize` · `setMyInstructorFlag` · `setMyVoiceDefault`; `useProfile().setInstructorTheme`; queries `api.languages.getVisibleLanguages`, `api.themes.getPublicThemeCatalogue` |
| Student Profiles | `ProfileModal` (+ `ProfileTabContent`) | `api.studentProfiles.updateStudentProfile` · `setStateFlag` · `setGridSize` · `setSymbolTextSize` · `createStudentProfile` · `deleteStudentProfile`; `useProfile().setActiveProfile/allProfiles/activeProfileId`; `useSubscription().canUseMultipleLanguages` |
| Account & Billing | `PlanModal` (+ `InstructorAccountSection`, `DeleteAccountDialog`) | Stripe endpoints `/api/stripe/{checkout,cancel,switch-plan,reactivate}`; Clerk `useUser`/`useReverification`; `/api/delete-account`; `useAppState().subscription` |
| Navigational Side Bar | `NavbarModal` | `useNavbarVariant()` → `minimal/setMinimal`, `side/setSide` |
| Invites | `InvitesModal` | `api.accountMembers.getMyAccountMembers` · `inviteCollaborator` · `removeMember`; `/api/invite`; Max-tier gated |
| Data & Privacy | `PrivacyModal` | `api.users.setAnalyticsOptOut`; `posthog.opt_in/out_capturing` |

**Scope rules:** instructor settings write `users` table; student settings write `studentProfiles`.
`useProfile()` setters (`setGridSize`, `setSymbolLabelVisible`, `setSymbolTextSize`) are already
`viewMode`-aware. **Collaborators** see only Instructor Profile · Navbar · Data & Privacy (current
`COLLABORATOR_SETTINGS_IDS`) — preserve by filtering the tab list. Deep-link `?modal=<id>` →
becomes `?tab=<id>` (keep the UpgradeNudge "See plans" entry working).

---

## Staged plan

### Stage 1 — Tab + TabBar atoms
New files in `app/components/app/settings/ui/`:
- **`Tab.tsx`** — props `{ label: string; active: boolean; onClick: () => void }`. `flex-1`,
  centered, `p-theme-…`, text `text-theme-alt-text` (active, SemiBold) / `text-theme-secondary-alt-text`
  (inactive); active adds `border-b-[3px] border-theme-primary`. Maps Figma `3028:4334`.
- **`TabBar.tsx`** — props `{ tabs: {id,label}[]; activeId; onSelect }`. Row, `gap-theme-…`, bottom
  border `border-theme-line`. Maps Figma `3028:4366`. Reused for BOTH the main 6-tab bar and the
  secondary student-selector bar (so it must accept an arbitrary tab list).
- *(Do NOT reuse `NavTabButton` — that's a pill-on-surface style; this design is an underline tab.)*

Verify: `npx tsc --noEmit`; render in isolation.

### Stage 2 — Settings page shell (tabbed)
Rewrite **`app/components/app/settings/sections/SettingsContent.tsx`** to:
- Hold `activeTab` state (default `"instructor"`), seeded from `?tab=` (migrate the existing
  `?modal=` deep-link `useEffect`; accept both for back-compat, strip after read).
- Build the visible tab list from `OWNER_SETTINGS_IDS` / `COLLABORATOR_SETTINGS_IDS` (unchanged ids:
  `instructor · profile · plan · navbar · invites · privacy`).
- Render `<TabBar>` then a switch of **tab-panel section components** (Stage 3/4). Remove the tile grid,
  the `Dialog`/`renderModal` machinery, and the `MODAL_SIZE` map.
- Keep the page heading/banner via the existing pattern; breadcrumb "Settings › `<tab>`" is rendered by
  the existing Topbar (`3027:4160`) — confirm it reads active tab, else pass the active label up.
- `app/[locale]/(app)/settings/page.tsx` stays thin (keeps `<BillingBanner/>` + `<SettingsContent/>`).

New shared shell atom **`app/components/app/settings/ui/SettingsSection.tsx`** — props
`{ title: string; children }`: the translucent section-card wrapper (`bg-theme-card rounded-theme-card
p-theme-…`) + Label. Every module in Stages 3–4 sits inside this. Maps the repeating Figma
"Languages/Voices/…" card frame.

### Stage 3 — Designed tabs: inline picker modules + port logic

New module atoms in `app/components/app/settings/ui/`:
- **`LanguagePicker.tsx`** — 3+ full-width `flex-1` buttons w/ beta "preview" pill. Maps `1459:22718`.
- **`VoiceCard.tsx`** — gender title + region + Preview chip; selected/preview state. Maps `1454:25145`.
  Extracts the inline voice UI from both modals; `onPreview` calls `/api/tts` (existing `previewVoice`).
- **`ThemeSwatch.tsx`** (Theme-picker-module) — color dot + title + mode + selected border + Lock when
  gated. Maps `3027:4093/4094`. Wraps existing `canAccessThemeTier` gating + `UpgradeNudge`.
- **`GridSizePicker.tsx`** — Large/Medium/Small cards with squares preview. Maps `1459:22785`.
- **`SymbolsControls.tsx`** — "Display text label" checkbox + Text-size-picker (Aa cards), text-size
  greyed when label off. Maps `1459:22837`. (Reuse for both tabs.)

New tab-panel section components in `app/components/app/settings/sections/`:
- **`InstructorProfilePanel.tsx`** — ports `InstructorProfileModal` body. **Auto-save**: replace the
  batched `handleConfirm` with per-control handlers calling the same mutations on change
  (`setMyInstructorGridSize`/`…SymbolTextSize`/`…Flag`/`setMyVoiceDefault`; theme already live via
  `setInstructorTheme`; `setMyLocale` + `NEXT_LOCALE` cookie + reload on language click). Drop
  `DialogHeader/Footer/Close`. Section order = Languages, Voices, Theme, Grid, Symbols, each in
  `<SettingsSection>`.
- **`StudentProfilesPanel.tsx`** — ports `ProfileModal`/`ProfileTabContent`. Top: secondary `<TabBar>`
  (one tab per `allProfiles`, drives `setActiveProfile`) + **Create new profile** `Button`
  (`createStudentProfile`). Then `<SettingsSection>`s: Languages, Voices, Theme, Grid, Symbols **plus**
  the extra controls as their own section-cards — **Name** (inline edit → `updateStudentProfile`),
  **Permissions** (page + editing toggles → `setStateFlag`), **Header Mode** (talker/banner +
  banner-mode perms → `setStateFlag`), **Delete Profile** (danger-zone section, only when
  `allProfiles.length > 1` → `deleteStudentProfile`). All already auto-save today.

These two tabs reuse the SAME module atoms (Stage 3) with instructor- vs student-scoped setters.

### Stage 4 — Remaining four tabs (port content into panels, section-card style)
New tab-panel sections in `app/components/app/settings/sections/`:
- **`AccountBillingPanel.tsx`** — ports `PlanModal` (PlanCard tiers, billing interval toggle, all Stripe
  CTAs) + `InstructorAccountSection` (Clerk photo/name/email/password) + `DeleteAccountDialog` (keep as a
  confirm dialog — destructive, deliberately NOT inlined). Use `PlanTierPicker`/Tier-pill for tier
  display. **Do not touch any Stripe call signatures.**
- **`NavbarPanel.tsx`** — ports `NavbarModal` (minimal toggle + side L/R) via `useNavbarVariant()`.
- **`InvitesPanel.tsx`** — ports `InvitesModal`; Max-tier gate + member table + invite flow; the
  former `onOpenPlan` callback becomes `setActiveTab("plan")`.
- **`PrivacyPanel.tsx`** — ports `PrivacyModal` analytics opt-in/out.

Wrap each in `<SettingsSection>`(s) for visual consistency with the designed tabs.

### Stage 5 — Cleanup
Delete `app/components/app/settings/modals/{GridModal,SymbolsModal,ScaffoldModal}.tsx` (unused legacy).
After ports verify, the six ported modal files (`InstructorProfileModal`, `ProfileModal`, `PlanModal`,
`InvitesModal`, `PrivacyModal`, `NavbarModal`) can be deleted **once their panels are confirmed working**
— do this last, in one commit, after manual verification. Keep `DeleteAccountDialog` (still used).

---

## New atoms (summary)
`app/components/app/settings/ui/`: `Tab.tsx`, `TabBar.tsx`, `SettingsSection.tsx`, `LanguagePicker.tsx`,
`VoiceCard.tsx`, `ThemeSwatch.tsx`, `GridSizePicker.tsx`, `SymbolsControls.tsx`.
Reuse from `app/components/app/shared/ui/`: `Button`, `IconButton`, `Input`, `PlanTierPicker`,
`UpgradeNudge`, `Toast`, `Dialog` (Account delete only).

## i18n (en.json ONLY — Critical Rule #1)
All section/control copy already exists across namespaces `instructorProfile`, `studentProfile`, `plan`,
`account`, `invites`, `privacy`, `navbar`, `grid`, `symbols`. **New keys needed = the six tab labels**
(the `settings` namespace already has `instructor/profile/plan/navbar/invites/privacy` strings — reuse
those for the tab labels if their wording matches the design; the design uses "Instructor Profile",
"Student Profiles", "Account & Billing", "Navigational Side Bar", "Invites", "Data & Privacy"). Add only
what's missing to **`messages/en.json`** under `settings` (e.g. `tabInstructor`, `tabProfile`,
`tabPlan`, `tabNavbar`, `tabInvites`, `tabPrivacy` if the existing labels don't match) — do **not** add
to any other locale file.

## Functionality risks to watch
- **Stripe (Account & Billing):** highest risk. Port `PlanModal` verbatim — same endpoints, same
  interval logic, same `track("started_checkout")`. Verify checkout redirect + `BillingBanner`
  `?success/cancelled` still fires.
- **Clerk profile:** photo/name/email/password edits + `useReverification` must keep working; account
  deletion stays behind the typed-confirmation `DeleteAccountDialog`.
- **Language / locale switching:** instructor language click sets `users.locale` + `NEXT_LOCALE` cookie
  and reloads (AppStateProvider redirect). Auto-save must not fire the reload on mount/initial render —
  only on an actual user change (guard `locale !== currentLocale`). Student language is a separate
  concern (`studentProfiles.language`) — don't conflate.
- **Per-student vs instructor scope:** keep `users.*` setters in the Instructor tab and
  `studentProfiles.*` / `viewMode`-aware `useProfile()` setters in the Student tab. Don't cross them.
- **Auto-save regressions:** the instructor grid→text-size derivation (`handleGridChange`) must still run
  on each change; theme must keep applying live via `setInstructorTheme` (don't double-write on other
  saves — see the existing comment at `InstructorProfileModal.tsx:140`).
- **Collaborator tab filtering + deep-link:** preserve the reduced collaborator tab set and the
  `?modal=`→`?tab=` entry point.

## Verification
1. `npx tsc --noEmit` after each stage.
2. Dev server is already running on **localhost:3000** (do NOT start a second). Drive the signed-in app
   via the Claude-in-Chrome MCP across **every tab**:
   - Tab-bar switches panels; collaborator account shows only 3 tabs; `?tab=plan` deep-link lands on
     Account & Billing.
   - Instructor Profile: change language (reload fires once), voice preview plays, theme applies live,
     grid + symbols persist (reload page → values stuck). Confirm no Save button.
   - Student Profiles: switch student via secondary tab-bar, create + delete a profile, edit name,
     toggle a permission + header mode, change grid/theme/voice — all persist.
   - Account & Billing: tier display correct; open (don't complete) a Stripe checkout to confirm redirect;
     account name edit saves; delete-account dialog gates on typed confirmation.
   - Navbar / Invites / Privacy: minimal+side toggles apply; invite gate shows for non-Max; analytics
     toggle flips PostHog + persists.
3. Confirm no `console` errors; theme tokens only (no hard-coded hex/px) — grep the new files.