# ADR-006 — Component Folder Conventions

**Date:** 2026-05-01
**Status:** Accepted

---

## Context

Early in the build, components were placed wherever felt natural at the time. Two folder shapes emerged in parallel and started to collide:

1. A **top-level** `app/components/shared/` holding genuinely cross-domain primitives (e.g. `SymbolCard`, `Header`, `ModellingOverlayWrapper`, `NavTabButton`) plus, over time, a growing pile of less-clearly-shared things (admin-shaped account/subscription cards, a flat list of editors, theme toggle, etc.).
2. A **flat** `app/components/app/shared/` holding the in-app shell (Sidebar, TopBar, talker, providers, modals) all in one directory with no `sections / ui / modals` distinction, even though the rest of the in-app domains (`categories/`, `home/`, `lists/`, `sentences/`, `onboarding/`, `settings/`) had already adopted that subdivision.

Two unrelated things called "shared" was confusing for both human and AI readers. Several components in the top-level `shared/` (e.g. `AccountCard`, `SubscriptionCard`, `UserMenu`, `UpgradeButton`) were really only ever rendered from in-app surfaces, while the actually cross-domain pieces were under-organised.

Two top-level provider files (`AppStateProvider.tsx`, `ConvexClientProvider.tsx`) sat at the root of `app/components/`, despite the rest of `app/components/` being organised by domain. Meanwhile `app/contexts/` already held every other React provider (`ProfileContext`, `ThemeContext`, `TalkerContext`, `BreadcrumbContext`, `ModellingSessionContext`, `ResourceLibraryContext`).

A separate decision (made before this ADR was written) tightened the role of admin: admin will use their existing role within the app — viewing default categories and the resource library through the same in-app surfaces with elevated permissions — rather than having its own parallel admin component infrastructure. This means the only legitimately cross-domain UI in the medium term is the future Resource Library viewer (used both from marketing pages and from inside the app).

---

## Decision

### 1 — Domain folders

Every component lives under exactly one **domain** folder:

```
app/components/
├── admin/        ← admin-only surfaces (admin shell, admin-shaped UI)
├── app/          ← logged-in app surfaces (the AAC product itself)
├── marketing/    ← public marketing surfaces (landing, pricing, blog)
└── shared/       ← genuinely cross-domain (currently empty; reserved for Resource Library)
```

Rules:
- A component placed in `shared/` must be used by **at least two** of `admin / app / marketing`. If only one domain renders it, it belongs in that domain.
- Duplication across domains is acceptable when the domains intentionally diverge in style. Example: `ThemeToggle` is duplicated in `marketing/ui/` and `admin/ui/` because admin will get its own visual identity so users know they are in the admin area; sharing one component would couple the two styles together.
- `shared/` may be empty. It is not a graveyard for "I'm not sure where this goes" components.

### 2 — Type subdivision (`sections / ui / modals`)

Within each domain, components are subdivided by **type**:

```
app/components/{domain}/{feature?}/
├── sections/   ← page-level compositions; usually consume context
├── ui/         ← reusable atoms / small molecules; props-only, no context
└── modals/     ← dialogs and full-screen modals
```

Rules:
- `page.tsx` files (Next.js route handlers) must be thin and import only from `sections/`, `ui/`, or `modals/`. They should not contain layout or data logic of their own.
- A `sections/` component composes `ui/` and `modals/` plus context hooks. It is the integration point.
- A `ui/` component must be drivable purely from props. No `useAppState`, no `useProfile`, no `useTalker`. This keeps atoms portable across features.
- A `modals/` component owns its own open/close mechanics or accepts them as props. Modals that share a feature can be grouped in a sub-folder (e.g. `modals/symbol-editor/`).

Inside `app/`, features get their own folder before the type subdivision:

```
app/components/app/
├── categories/{sections,ui,modals}/
├── home/{sections,ui,modals}/
├── lists/{sections,ui,modals}/
├── onboarding/{sections,ui,modals}/
├── sentences/{sections,ui,modals}/
├── search/{sections,ui,modals}/
├── settings/{sections,ui,modals}/
└── shared/{sections,ui,modals}/   ← in-app shell: Sidebar, TopBar, talker, providers, app-wide modals
```

`app/shared/` is "shared *across in-app features*" — Sidebar, TopBar, the persistent talker, the symbol editor modal (used from any feature that edits a symbol). It is not the same thing as the top-level `shared/`.

### 3 — Provider location

All React context providers live in `app/contexts/`, regardless of whether the file's primary export is a `Context` or a `Provider` component or both:

```
app/contexts/
├── AppStateProvider.tsx
├── BreadcrumbContext.tsx
├── ConvexClientProvider.tsx
├── ModellingSessionContext.tsx
├── ProfileContext.tsx
├── ResourceLibraryContext.tsx
├── TalkerContext.tsx
└── ThemeContext.tsx
```

The folder name `contexts/` is technically a minor misnomer (it includes pure providers like `ConvexClientProvider` that wrap third-party SDKs and don't expose a hook), but renaming the folder would touch every existing import for marginal gain. Treat `contexts/` as "providers + contexts", not a strict-context folder.

Filenames: keep the descriptive suffix that matches what the file exports. `ThemeContext.tsx` exposes a hook + provider; `AppStateProvider.tsx` exposes a provider + hook. The suffix is informative, not a rule.

---

## Why

- **One mental model.** Instead of mentally tracking two "shared" folders, contributors and AI agents apply a single rule: pick a domain, then pick a type. The placement question becomes mechanical.
- **`page.tsx` stays thin.** The `sections/ui/modals` subdivision exists so that route files have an obvious place to import from, and so that section authors have an obvious place to put atoms and dialogs that aren't the section itself.
- **Theme / context safety.** `ui/` atoms being context-free means they can't accidentally couple a styling primitive to the AAC `ThemeContext` or `AppState`, which would break reuse across student profiles or domains.
- **Provider discoverability.** New contributors looking for "where is auth wired" or "where is the user object provided" find every answer in one folder rather than spread between `app/components/` (top-level) and `app/contexts/`.
- **Admin-as-role keeps `shared/` honest.** Once admin became a permission inside the app rather than a separate UI tree, the only remaining cross-domain need is the Resource Library (marketing browsing + in-app browsing of the same library). Reserving `shared/` for that use case prevents the folder from collecting accidental "admin-shaped" leftovers again.

---

## Consequences

- The top-level `app/components/shared/` is currently empty and that is intentional. It will be repopulated when the Resource Library viewer is built.
- Existing docs that reference old paths (`app/components/shared/SymbolCard.tsx`, `app/components/shared/symbol-editor/...`, etc.) need to be swept. Tracked separately; not part of this ADR.
- When adding a new component, the placement decision is:
  1. Which domains render it? → `admin` / `app` / `marketing` / `shared` (only if 2+).
  2. Within `app`, which feature owns it? → `categories` / `home` / … / `shared` (in-app shell).
  3. Is it a page section, a reusable atom, or a dialog? → `sections` / `ui` / `modals`.
- When adding a new provider, the placement decision is: it goes in `app/contexts/`. There is no second option.

---

## Out of scope

- Page-route file conventions (`app/[locale]/...` vs `app/(admin)/...`). Documented elsewhere.
- Hook placement (`hooks/`). Existing convention is fine; not revisited here.
- Naming conventions for individual components (e.g. when to suffix `-Modal` vs `-Dialog`). Followed by feel.

---

## References

- `CLAUDE.md` rule 6 — the short version of this ADR, intended as the everyday reminder.
- ADR-001 — instructor/student terminology that informed how "parent container" reads in this folder structure.
