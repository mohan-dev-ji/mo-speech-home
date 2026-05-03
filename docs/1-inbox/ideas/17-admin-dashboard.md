# Admin Dashboard

## Build Priority — Read This First

The `/admin` route already exists in this codebase as scaffolding (Overview stat cards, Users list, User detail). Phase 7 — immediately after Phase 6 — **completes** the admin dashboard. It does not build it from scratch.

Designing the full admin dashboard in Figma before the build is unnecessary. Most of it composes existing design-system components (sidebar, tables, stat cards, badges) that already exist in the scaffold. The Library section depends on shared components that only fully exist after Phases 3–6. The agent can scaffold the rest from this spec.

**The plan:**
1. Phases 0–6 build the main app and ship Phase 6 (in-app library authoring + browse + load).
2. Phase 7 completes the admin dashboard, with the Library section as its centrepiece.
3. Themes and Affiliates admin sections plug in as Phases 8 and 10 ship.

The dashboard is a different skin on the same components — composition, not a parallel component tree.

---

## Overview

The admin dashboard is the operational surface for the Mo Speech team. It lives at `/admin`, gated by Clerk role (`publicMetadata.role === "admin"`) at [app/(admin)/layout.tsx](../../../app/(admin)/layout.tsx). Admins use it to:

- Manage resource pack metadata and lifecycle (publish, schedule, feature, expire)
- Monitor users and subscriptions (start date, plan, usage)
- See platform-level KPIs at a glance
- Operate themes, affiliates, core vocabulary, and the starter pack

**It is not the place where content is authored.** Per Phase 6 and ADR-008, content authoring (categories, lists, sentences) happens in the main app under `viewMode === 'admin'`, using the same editors that instructors use. The dashboard handles only metadata and lifecycle.

For the rationale (admin as Clerk role + view-mode entry, not a profile type) see **ADR-008**.

---

## Page Layout

Left sidebar selects the section. Main area shows the section's content. The sidebar already exists at [app/(admin)/layout.tsx:8](../../../app/(admin)/layout.tsx) with Overview and Users links — Phase 7 extends it.

```
┌─────────────────┬──────────────────────────────────────────────┐
│  ADMIN          │  [Section content]                            │
│                 │                                                │
│  Overview       │                                                │
│  Users          │                                                │
│  Library        │                                                │
│  Themes         │  (sections shown only when their phase       │
│  Affiliates     │   has shipped)                                │
│  Core Vocab     │                                                │
│  Starter Pack   │                                                │
└─────────────────┴──────────────────────────────────────────────┘
```

A topbar shows the admin's name and a "Back to App" link.

---

## Sections

### Overview

The landing page. Today's scaffold has 5 stat cards (total users, free, pro, max counts). Phase 7 extends with operational metrics:

- Active in last 7 days
- New signups (this week / this month)
- MRR breakdown by plan
- Resource library: live packs, scheduled packs, expiring soon
- Translation gaps (packs missing Hindi)

Specifics decided when building, based on what's actually useful day-to-day.

### Users

Extends the existing users list. Each row shows:

- Name / email / Clerk userId
- Account start date
- Plan (free / pro monthly / pro yearly / max monthly / max yearly)
- Profile count
- Last active
- Actions: Drill into detail · Grant access · Open in Stripe

User detail page (already partially scaffolded) shows subscription history, profile list, R2 usage, recent activity, and grant-access controls.

### Library

The metadata/lifecycle CMS for resource packs. **No content authoring here** — content is authored in-app per Phase 6.

Pack listing:

```
Resource Packs                                        [+ Refresh]

🎃 Halloween Pack    🇬🇧✅ 🇮🇳⏳   Oct 1–Nov 1   🟢 Live
🌸 Spring Starter    🇬🇧✅ 🇮🇳✅   Always        🟢 Live
🚀 Space Explorer    🇬🇧✅ 🇮🇳⏳   Always        ⚪ Draft
🎄 Christmas Pack    🇬🇧✅ 🇮🇳⏳   Dec 1–Jan 1   🔵 Scheduled

Filter: [All ▼]  [Status ▼]  [Season ▼]  [Featured ▼]
```

Per-row actions: Edit metadata · Toggle featured · Set publish/expire dates · Set season/tags · Reorder · Delete. Tapping the translation indicator (⏳) opens the pack in the in-app editor with `viewMode === 'admin'` so the admin can fill in missing translations using the existing UI.

Status workflow:

```
Draft → Scheduled → Live → Expired (auto) or Archived (manual)
```

Scheduled means a future `publishedAt` date — content goes live automatically. Critical for seasonal packs. The team prepares the Christmas pack in November, schedules it for 1 December, and nothing needs to happen on the day.

### Themes (Phase 8 onwards)

Theme listing with toggle for `tier: free | premium`, set season, set cover image, archive. Same shape as Library but smaller surface. Authoring (token values) happens in a dedicated theme editor since themes don't have an in-app authoring surface like categories do.

### Affiliates (Phase 10 onwards)

Affiliate management surface. Approve/reject affiliate applications, view commission history, see Stripe Connect status per affiliate, manual payouts if needed. Per `16-affiliates.md`.

### Core Vocabulary

Global core words / numbers / letters that drive the talker dropdown. Three tabs, draggable lists.

```
[Core Words]  [Numbers]  [Letters]

  ≡  [I]        symbol card    [remove]
  ≡  [want]     symbol card    [remove]
  ...

  ⚠️ Changes to core vocabulary affect all users globally
  [Save Changes]
```

Persistent warning — this is the only admin surface that edits shared global state rather than publishable per-pack content.

### Starter Pack

The canonical starter `resourcePack` that new accounts are seeded with (see `06-resource-library.md`). Editing happens in the main app under `viewMode === 'admin'` — the admin opens their own categories, edits, and taps "Make Default". This dashboard section just shows:

- Current starter pack contents (read-only summary: which categories, list count, sentence count)
- Translation status
- Last updated by / when
- A "Reset to factory recipe" action that re-materialises from `DEFAULT_CATEGORIES` if the admin has corrupted the starter

```
  ≡  🟦 Things & Objects     42 symbols
  ≡  🟩 People               18 symbols
  ≡  🟨 Feelings             24 symbols
  ...

  ⚠️ Changes affect all new student profiles created after the next "Make Default"
  [Reset to factory recipe]
```

---

## Language Handling

Three distinct concerns. They are not the same thing.

### 1. Admin UI language — English only

The admin interface itself (menus, buttons, labels) is English only. The admin team works in English. No need to translate the admin UI.

### 2. Pack metadata fields — both languages, side by side

Metadata edit forms in the dashboard show name and description in all supported languages together:

```
Name (English)  [Halloween Pack                    ]
Name (Hindi)    [हैलोवीन पैक                       ]
```

Not a language switch — two fields on the same form. If Hindi is empty, the app falls back to English.

### 3. In-app preview — already handled

For previewing pack *content* in different languages, the admin uses the existing in-app language switch — they're already in the main app authoring under `viewMode === 'admin'`. No special preview panel needed.

### Translation status indicators

Each pack row in the Library section shows a per-language status indicator (`🇬🇧✅ 🇮🇳⏳`). Tapping the ⏳ opens the pack in the in-app editor focused on the missing fields.

A dashboard-wide "Translation gaps" widget (in Overview) surfaces packs that are live but missing Hindi.

### Translation workflow for V1

Side-by-side metadata fields plus translation status indicators is the right infrastructure for V1. Bulk translation is a spreadsheet workflow until volume demands a CSV import/export — design that in when needed, not before.

---

## Shared Components

Phase 7's dashboard reuses existing design-system components: tables, stat cards, badges, sidebar layout, language fields. The design system pieces are already in use elsewhere (the existing `/admin` scaffold, Settings, etc.).

The dashboard does **not** import in-app authoring components (CategoryBoardGrid, SymbolCard editor, ListEditor, SentenceEditor) — content authoring lives in the main app under `viewMode === 'admin'`. The dashboard is metadata + tables + lifecycle controls only.

The one shared concept that crosses surfaces: when the Library section sends an admin "into the editor for this pack" (e.g. to fill a translation gap), it routes the admin to the relevant in-app screen with `viewMode === 'admin'` set. No parallel editor in the dashboard.

---

## References

- [`06-resource-library.md`](06-resource-library.md) — pack structure, in-app authoring, starter pack
- [`14-pricing-tiers.md`](14-pricing-tiers.md) — plan field shape used in Users section
- [`16-affiliates.md`](16-affiliates.md) — affiliates section detail
- [`15-themes.md`](15-themes.md) — themes section detail
- [`ADR-008-admin-role-and-view-modes.md`](../../4-builds/decisions/ADR-008-admin-role-and-view-modes.md) — admin role / view-mode model
- [app/(admin)/layout.tsx](../../../app/(admin)/layout.tsx) — existing admin route + role gate
