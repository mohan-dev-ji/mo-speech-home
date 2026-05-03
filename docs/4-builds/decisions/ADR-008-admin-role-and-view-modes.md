# ADR-008 — Admin Role and View Modes
Date: 2026-05-03
Status: Accepted

---

## Context

Mo Speech Home has admin functionality split across two surfaces:

1. **In-app affordances** — when curating resource library content, admins use the same editors that instructors use. They get extra buttons ("Save category to library", "Save list to library", "Save sentence to library", "Make Default") that appear in the existing toolbars and editors.
2. **`/admin` dashboard** — a separate route (already scaffolded) for metadata, lifecycle, and operational data: pack publishing/expiration/featuring, user management, KPIs.

While planning Phase 6 (resource library) and Phase 7 (admin dashboard), the question came up: should "admin" be modelled as a *new profile type* in the breadcrumb dropdown — a peer of the existing student profiles?

Two facts pushed the decision:

- **Content is account-owned (instructor-owned), not student-owned.** Categories, lists, and sentences are scoped to the account (`accountId`) and persist across all student profiles on the account. Student profiles only carry surface-level personalisation (theme, grid size, language). An admin curating a pack is just an instructor on an admin-flagged account, working with the same data shape as any other instructor — they don't need a separate data context.
- **The breadcrumb dropdown already has a precedent for non-profile entries.** "Instructor" in [BreadcrumbViewModeDropdown.tsx](../../../app/components/app/shared/ui/BreadcrumbViewModeDropdown.tsx) is a *view mode*, not a profile. It sits alongside student profiles in the same dropdown without being a profile itself.

Without an explicit decision, future contributors are likely to add an `adminProfiles` table, a `type` field on `studentProfiles`, or a `role` column — for what is fundamentally a UI affordance, not a data model.

---

## Decision

### 1. Content ownership

Categories, lists, sentences, and first-thens are **account-owned** (`accountId`). Despite being named `profileCategories` / `profileSymbols` / etc., they are not scoped per student profile. Student profiles overlay only personalisation (theme, grid size, language).

This shifted from an originally student-owned model during the build, and the naming is preserved to avoid churn. New code should treat these tables as account-scoped.

### 2. Admin is a Clerk role only

There is no Convex admin entity. There is no profile type. Admin status lives at exactly one place: Clerk `publicMetadata.role === "admin"`, surfaced in `sessionClaims.metadata.role`.

Server-side admin gating uses this Clerk role directly (see [app/(admin)/layout.tsx:14](../../../app/(admin)/layout.tsx)). Convex queries and mutations that require admin do their own check via the same field.

### 3. View modes extended by one value

`ProfileContext` currently exposes a `viewMode` union of:

```typescript
type ViewMode = 'instructor' | 'student-view'
```

This ADR extends it to:

```typescript
type ViewMode = 'instructor' | 'student-view' | 'admin'
```

The `'admin'` mode is **only selectable when Clerk role is admin**. For non-admin users, attempting to select it (which they cannot — see below) is a no-op.

### 4. Breadcrumb dropdown gains an "Admin" entry

[BreadcrumbViewModeDropdown.tsx](../../../app/components/app/shared/ui/BreadcrumbViewModeDropdown.tsx) gains a third view-mode entry, **Admin**, alongside the existing "Instructor" entry. The Admin entry is conditionally rendered: visible only when Clerk role is admin. Regular users never see it.

Selecting Admin sets `viewMode === 'admin'` via the existing `setViewMode` mutation.

### 5. In-app admin chrome is gated on viewMode, not on Clerk role

The save-to-library buttons, Make Default action, library-source labels (e.g. "loaded from: Halloween Pack" badges), and the nav link to `/admin` are gated on `viewMode === 'admin'` — **not** on Clerk role directly.

This is tighter than naive role-based gating. It lets admins toggle between two modes:

- `viewMode === 'instructor'` — preview content as a normal instructor sees it (clean UI, no admin chrome). Useful for sanity-checking authored packs before publishing.
- `viewMode === 'admin'` — curatorial tools on, library-source labels visible, link to `/admin` available.

### 6. The `/admin` dashboard is the canonical home for metadata work

Pack lifecycle (publish, expire, feature, season, tags), user management, KPIs, and starter pack management live at `/admin`. The route is gated by Clerk role at the layout level — `/admin` does **not** require `viewMode === 'admin'` (the in-app view-mode toggle is for in-app affordances; visiting `/admin` directly is always allowed for admin Clerk users).

In-app authoring (the save buttons) is the canonical home for content authoring. The dashboard does not have a parallel editor.

---

## Consequences

- **Profile schema unchanged.** No `type` field on `studentProfiles`. No `adminProfiles` table. No `role` column on profiles. ProfileContext's profile resolution logic remains profile-only.
- **`BreadcrumbViewModeDropdown` gains an admin branch.** When Clerk role is admin, the dropdown renders three view modes (Instructor / Admin / [student profiles]) instead of two.
- **`ProfileContext` extends its `viewMode` union by one value** (`'admin'`). Components reading `viewMode` add admin-mode branches where appropriate.
- **Phase 6 spec is tightened.** The original Phase 6 spec gated admin save buttons on Clerk role directly ("when a Clerk user has `publicMetadata.role === 'admin'`, the app exposes additional affordances"). Per this ADR, the gate is `viewMode === 'admin'`, allowing admins to preview as instructor.
- **Phase 7 (admin dashboard) builds on Clerk-role gating.** `/admin` continues to gate at the layout via Clerk role. View mode is irrelevant inside `/admin`.
- **Future themes/affiliates admin UI plugs into `/admin`**, not new routes. There is one admin surface, with sections.
- **Translation-gap remediation flow stays consistent**: when the dashboard's Library section routes an admin "into the editor for this pack" to fill missing translations, it sets `viewMode === 'admin'` and navigates into the main app — same in-app authoring surface, just deep-linked.

---

## Out of scope

- Per-admin permission tiers (super-admin vs editor vs read-only). Single admin role for now.
- Admin-scoped data isolation (e.g. dev/staging admins seeing only test data).
- Multi-admin collaboration features (review queues, audit trails).
- Any admin-only data context distinct from the admin's own account content. Admins curate using their own account's categories/lists/sentences.

These can be revisited if/when the operational surface grows beyond a single small team.

---

## References

- [`06-resource-library.md`](../../1-inbox/ideas/06-resource-library.md) — in-app authoring under `viewMode === 'admin'`, starter pack mechanics
- [`17-admin-dashboard.md`](../../1-inbox/ideas/17-admin-dashboard.md) — full dashboard section spec
- [app/(admin)/layout.tsx](../../../app/(admin)/layout.tsx) — Clerk role gate at the route level
- [app/components/app/shared/ui/BreadcrumbViewModeDropdown.tsx](../../../app/components/app/shared/ui/BreadcrumbViewModeDropdown.tsx) — current Instructor view-mode entry; future home of the Admin entry
- ProfileContext — `viewMode` union and `setViewMode` mutation
