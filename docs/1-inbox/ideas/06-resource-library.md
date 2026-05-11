# Resource Library and Seasonal Packs

## What It Is

The Mo Speech resource library is a collection of curated content packs managed by the Mo Speech team via the admin dashboard. Instructors can browse the library, preview packs, and load them into their student's profile as a starting point or supplement.

A pack is simply a category with its accompanying lists, sentences, and first-thens bundled together — the same structure as everything else in the app.

---

## Why It Matters

Non-verbal students often miss the ambient cultural context that verbal children absorb passively. A Halloween category, a Diwali sentence set, a Christmas first-then — timely, contextual content keeps the student connected to what is happening around them. No AAC platform currently does this as a curated, regularly updated resource.

The library also solves the cold-start problem. A new instructor does not need to build everything from scratch. They have a default set up loaded on sign up, the student has working AAC immediately, and the instructor customises from there.

---

## Pack Structure

A pack is any combination of categories, lists, and sentences — none are individually required. A pack might be a full category bundle (Halloween: category + 3 lists + 5 sentences), or just a single list (a Diwali greetings list), or a single sentence (a back-to-school sentence). The shape is flexible:

```
resourcePack
  ├── tier         ("free" | "pro" | "max" — controls who can load it)
  ├── category? (optional — name, icon, colour, ordered symbols with optional display overrides)
  ├── lists[]      (may be empty)
  └── sentences[]  (may be empty)
```

All symbol references within a pack point to `symbolId` values in the SymbolStix library. The pack does not contain custom images — it uses the existing library.

**Schema notes for Phase 6 build**:
- Today's `resourcePacks.category` field in [convex/schema.ts](../../../convex/schema.ts) is a single non-optional object. Phase 6 makes it optional so lists-only and sentences-only packs are valid. If packs should bundle multiple categories, change `category` → `categories: v.array(...)` at the same time.
- Add `tier: v.union(v.literal('free'), v.literal('pro'), v.literal('max'))` to mirror the existing `themes.tier` field. See "Tier Gating" below.

---

## Authoring Model (Hybrid)

Admins author resource pack content directly in the main Mo Speech app, using their own account's content (categories, lists, sentences) as the working surface. Content is account-owned (the instructor owns it); student profiles only carry surface-level personalisation like theme, grid size, and language. So an admin curating a starter pack is just an instructor on an admin-flagged account, working with the same data shape as any other instructor.

Admin chrome is gated on **`viewMode === 'admin'`** — the third entry in the breadcrumb dropdown, available only when Clerk role is admin. See **ADR-008** for the rationale (admin is a Clerk role + view-mode entry, not a profile type). When the admin selects this view mode, the app exposes additional affordances:

- "Save category to library" — appears in category edit-mode toolbar
- "Save list to library" — appears in list editor
- "Save sentence to library" — appears in sentence editor
- "Make Default" — saves the category, list, or sentence to the canonical starter `resourcePack` so all future new accounts seed with the latest content
- A nav link to `/admin` becomes visible

Switching back to `viewMode === 'instructor'` hides all admin chrome, letting admins preview their content as a normal instructor sees it. Regular Clerk users never see the Admin entry in the dropdown at all.

Tapping any save action takes a snapshot of the current item and creates or updates a `resourcePack` document. This approach reuses every existing UI component — no duplicate authoring surface inside the admin dashboard. The trade-off (mixing creator and consumer modes in one app) is gated cleanly by view mode + role check; regular users never see these buttons.

---

## Recommended Authoring Workflow — for Mo Speech Staff

The view-mode toggle is also a propagation switch: once a row has been published to a pack (i.e. `publishedToPackId` is set), edits made **in admin view** auto-sync to the pack snapshot via `propagateToPack: true`; edits made **in instructor view** stay private to the admin's own account. Use this deliberately:

### 1. Build in instructor view

Create the category, list, sentence, or symbol the same way any instructor would — using the standard editor. No admin chrome, no toggles, no risk of accidentally promoting half-finished work. Choose imagery, colour, audio, ordering. Iterate freely; nothing leaves your account.

> The create mutations are view-mode-agnostic: instructor and admin view produce identical rows. Working in instructor view is purely a discipline / safety choice — there's no admin chrome to mis-click.

### 2. Flip to admin view to publish

When the content is ready, switch to admin view via the breadcrumb dropdown. The admin chrome appears on the detail page:

- **"Make Default"** — promotes the item into the canonical starter pack (seeds every new account from now on).
- **"Save to library"** — opens the pack picker; choose an existing library pack ("Add to existing") or create a new one ("New pack").

The toggle takes a snapshot of the current row state and writes it into the pack. The `AdminPackEditingBanner` now appears at the top of the editor as a reminder that this row is live.

### 3. Edits after publishing

Once a row is published, the view mode determines whether edits propagate:

| View mode | Behaviour on edit | Use it when… |
|---|---|---|
| Admin | Edits auto-sync to the pack snapshot — visible to every new user who loads the pack from now on. | You want to update the live pack — fix a typo, swap an image, reorder symbols. |
| Instructor | Edits stay on your account only; pack snapshot untouched. | You want to make a personal change (your own student's customisation) or preview how a regular instructor sees the pack. |

The pack snapshot is **frozen for already-loaded users** — any user who loaded the pack before your edit keeps the older content. Propagation only affects future loads.

### 4. Sanity-check before promoting

Before clicking "Make Default" or "Save to library", flip to instructor view briefly. You'll see exactly what a regular family will see when they load the pack — no admin chrome, no toggles, just the content. If something looks off, flip back to admin view, fix it, then publish.

### Mental model

- **Admin view = author mode.** Chrome visible. Edits propagate. Use when committing changes to live packs.
- **Instructor view = preview / private mode.** Chrome hidden. Edits are personal. Use when drafting, previewing, or making changes you don't want to ship.

### Things to avoid

- **Don't edit a published row in admin view unless you mean to update the pack.** Flip to instructor view first if you're just trying things out.
- **Don't drag-reorder a long list of mixed published and unpublished items in admin view casually** — the reorder propagates to every pack that contains any of those items. The new listing-page disclaimer banner is your reminder.
- **Don't "Make Default" something half-finished** to "save your progress." The snapshot is immediate. New accounts start seeding from that pack right away. Drafts stay unpublished until they're really ready.

---

## Admin CMS (Thin) — Built in Phase 7

The metadata/lifecycle layer lives in the admin dashboard's Library section, which is built as part of **Phase 7 — Admin Dashboard**. That section handles only metadata and lifecycle, not content authoring:

- Pack listing (filter by season, status, featured)
- Set `publishedAt` / unpublish (null = draft, not visible to users)
- Set `expiresAt` (e.g. Halloween pack expires 1 November)
- Toggle `featured` for home dashboard promotion
- Set `season` and `tags` for discoverability
- Reorder packs within season groupings
- Delete packs

No code deploy is required to publish, update, or expire a pack. Full spec for the admin dashboard surface lives in `17-admin-dashboard.md`.

---

## Home Dashboard Promotion

Featured and current seasonal packs are surfaced on the Home dashboard. The home screen fetches a lightweight metadata index on load — just name, cover image, season, and featured flag — not the full pack content. Full content only fetches when the user taps to preview or load.

The promotional section updates automatically as packs are published and expired by the admin team.

---

## Library Surface — One Page, Auth-Aware

There is **one library page** at `/[locale]/library`. It serves both unauthenticated marketing visitors and logged-in users, with auth-aware CTAs on each pack card. No separate marketing-site library route — collapsing the two surfaces eliminates duplication, prevents visual drift, and keeps URLs portable across auth states (a logged-out user shares a pack URL; their friend visits while logged in and the page just works).

The page itself:

- Public route, accessible to everyone, server-rendered.
- Pack listing is statically rendered (or ISR-cached) for cold visitors and SEO crawlers.
- Auth state hydrates client-side and updates each pack's CTA accordingly.
- SEO-indexed: pack covers, seasonal context, descriptive copy, structured data.

CTA per pack card depends on auth + tier:

| User state | Pack tier | CTA | Action |
|---|---|---|---|
| Logged out | Any | "Sign up to load" | Routes to `/sign-up?intent=load&packId=…` so the load resumes after auth |
| Logged in, tier permits | Their tier ≥ pack tier | "Load into profile" | Triggers `loadResourcePack` mutation |
| Logged in, tier insufficient | Their tier < pack tier | "Upgrade to load" | Routes to checkout for the required tier |

Same pack card UI handles all three states — no duplication.

---

## Tier Gating

Each pack has a `tier` field: `'free' | 'pro' | 'max'`, mirroring how themes are gated.

**Defaults / policy:**
- The **starter pack** is always free, regardless of `tier` field. New accounts seed with it on creation; gating doesn't apply to seeding.
- **Browsing is always free for everyone**, including unauthenticated visitors. Free users see the entire catalogue with "Upgrade to load" CTAs on gated packs — this preserves the library as a value-demonstration surface, not a hidden paywall.
- **Loading enforcement** lives in `loadResourcePack`: if `useSubscription().tier` < `pack.tier`, the mutation rejects with a tier-error that the UI translates into the "Upgrade to load" CTA.

**Avoided for V1**: in-app purchase per pack. Stripe one-time payments are technically straightforward but fragment billing and bookkeeping. Subscription tiers naturally capture the seasonal-pack value proposition ("subscribe to Pro and get every seasonal pack we ship"), which is the right mechanic.

**Suggested initial policy** (configurable per pack from the Phase 7 admin dashboard, no code deploy):
- Free: starter pack and a handful of evergreen packs
- Pro: general library packs and most seasonal packs
- Max: premium / deeply themed packs (e.g. fully illustrated story packs)

Admins set `tier` per pack from Phase 7's Library section. Tier of an existing pack can be changed at any time without affecting users who already loaded it (loaded content is independent — see "Loading a Pack" below).

---

## The Starter Pack — How New Accounts Are Seeded

There is one canonical `resourcePack` flagged as the starter. This is what new accounts are seeded with on first profile creation.

Today, `seedDefaultAccount` ([convex/profileCategories.ts](../../../convex/profileCategories.ts)) reads directly from the `DEFAULT_CATEGORIES` TypeScript module ([convex/data/defaultCategorySymbols.ts](../../../convex/data/defaultCategorySymbols.ts)) and inserts profile records for each word. Phase 6 migrates this to use the resource library:

1. One-time: materialise `DEFAULT_CATEGORIES` into a `resourcePack` flagged `isStarter: true` (or similar). The TS module remains in the repo as the source-of-truth recipe used to author the starter pack — but it is no longer load-bearing at runtime.
2. Switch `seedDefaultAccount` to call `loadStarterTemplate(starterPackId)`, which delegates to `loadResourcePack` against the starter pack.
3. The "Make Default" admin action overwrites or appends to this canonical starter pack, so future new accounts seed with the latest content. No code deploy required.

This means the starter pack is just a regular `resourcePack` with elevated semantics — nothing special at the schema level beyond a flag. Same load mechanism as any other pack.

---

## Loading a Pack

When an instructor loads a pack:

1. A Convex mutation `loadResourcePack(profileId, packId)` runs
2. **Tier check**: rejects with a tier-error if `users.subscription.plan` tier < `pack.tier`. The starter pack bypasses this check.
3. Creates a `profileCategory` from the pack's category (if present)
4. Creates `profileSymbol` records for each symbol (with any starter display overrides)
5. Creates `profileList`, `profileSentence`, `profileFirstThen` records
6. Sets `librarySourceId` on all created records — the only thread back to the source
7. Content is now fully in the user's profile — the library is not touched again. A subsequent change to `pack.tier` does not affect already-loaded content.

The loaded content is completely independent from the library. Editing it does not affect the pack. Deleting the pack does not affect the user's content.

---

## Reload Defaults

If a category has a `librarySourceId`, the instructor can "Reload Defaults" — reset all customisations back to the original pack state.

This is a destructive action. The confirmation modal warns clearly:
- All label overrides will be lost
- All colour and display changes will be reset
- Custom audio will be deleted from R2
- Custom images (AI generated, uploaded) will be deleted from R2
- This cannot be undone

On confirm, all `profileSymbol` records for the category are deleted and recreated from the library source. The `librarySourceId` is preserved so defaults can be reloaded again in future.

---

## Individual Items

Instructors can also browse and load individual items from the library — a single list, a single sentence, a single first-then — without loading the full pack. These load into an existing category of the instructor's choosing.
