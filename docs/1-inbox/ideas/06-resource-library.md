# Resource Library and Seasonal Packs

## What It Is

The Mo Speech resource library is a collection of curated content packs managed by the Mo Speech team via the admin dashboard. Instructors can browse the library, preview packs, and load them into their student's profile as a starting point or supplement.

A pack is simply a category with its accompanying lists, sentences, and first-thens bundled together — the same structure as everything else in the app.

---

## Why It Matters

Non-verbal students often miss the ambient cultural context that verbal children absorb passively. A Halloween category, a Diwali sentence set, a Christmas first-then — timely, contextual content keeps the student connected to what is happening around them. No AAC platform currently does this as a curated, regularly updated resource.

The library also solves the cold-start problem. A new instructor does not need to build everything from scratch. They load a starter pack, the student has working AAC immediately, and the instructor customises from there.

---

## Pack Structure

A pack contains:

```
resourcePack
  ├── category (name, icon, colour, ordered symbols with optional display overrides)
  ├── lists[]
  ├── sentences[]
  └── firstThens[]
```

All symbol references within a pack point to `symbolId` values in the SymbolStix library. The pack does not contain custom images — it uses the existing library.

---

## Authoring Model (Hybrid)

Admins author resource pack content directly in the main Mo Speech app, using their own student profile as the working surface. When a Clerk user has `publicMetadata.role === "admin"`, the app exposes additional affordances:

- "Save category to library" — appears in category edit-mode toolbar
- "Save list to library" — appears in list editor
- "Save sentence to library" — appears in sentence editor
- "Save first-then to library" — appears in first-then editor

Tapping any of these takes a snapshot of the current item and creates or updates a `resourcePack` document. This approach reuses every existing UI component — no duplicate authoring surface inside the admin dashboard. The trade-off (mixing creator and consumer modes in one app) is gated cleanly by the role check; regular users never see these buttons.

---

## Admin CMS (Thin)

The admin dashboard's Library section handles only metadata and lifecycle, not content authoring:

- Pack listing (filter by season, status, featured)
- Set `publishedAt` / unpublish (null = draft, not visible to users)
- Set `expiresAt` (e.g. Halloween pack expires 1 November)
- Toggle `featured` for home dashboard promotion
- Set `season` and `tags` for discoverability
- Reorder packs within season groupings
- Delete packs

No code deploy is required to publish, update, or expire a pack.

---

## Home Dashboard Promotion

Featured and current seasonal packs are surfaced on the Home dashboard. The home screen fetches a lightweight metadata index on load — just name, cover image, season, and featured flag — not the full pack content. Full content only fetches when the user taps to preview or load.

The promotional section updates automatically as packs are published and expired by the admin team.

---

## Public Browse Surface

The library has two browse surfaces, both built with the design system:

- **Marketing-site library** — public, unauthenticated, SEO-indexed. Lives on the marketing site (e.g. `/library` or `/resources`). Shows pack covers, seasonal context, preview content. No load action — call-to-action is "Sign up to load this pack". Functions as a sales asset and discovery surface.
- **Authed app library** — at `/[locale]/library`. Same browse experience but adds the "Load into profile" action and surfaces personal load history. Drives the actual loading flow.

Pack metadata is queried by both surfaces. The marketing-site version uses ISR / static generation where possible to keep latency low; the authed version uses live Convex queries.

---

## Loading a Pack

When an instructor loads a pack:

1. A Convex mutation `loadResourcePack(profileId, packId)` runs
2. Creates a `profileCategory` from the pack's category
3. Creates `profileSymbol` records for each symbol (with any starter display overrides)
4. Creates `profileList`, `profileSentence`, `profileFirstThen` records
5. Sets `librarySourceId` on all created records — the only thread back to the source
6. Content is now fully in the user's profile — the library is not touched again

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
