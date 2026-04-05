# Resource Library and Seasonal Packs

## What It Is

The Mo Speech resource library is a collection of curated content packs managed by the Mo Speech team via the admin dashboard. Parents can browse the library, preview packs, and load them into their child's profile as a starting point or supplement.

A pack is simply a category with its accompanying lists, sentences, and first-thens bundled together — the same structure as everything else in the app.

---

## Why It Matters

Non-verbal children often miss the ambient cultural context that verbal children absorb passively. A Halloween category, a Diwali sentence set, a Christmas first-then — timely, contextual content keeps the child connected to what is happening around them. No AAC platform currently does this as a curated, regularly updated resource.

The library also solves the cold-start problem. A new parent does not need to build everything from scratch. They load a starter pack, the child has working AAC immediately, and the parent customises from there.

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

## Admin Management

Packs are created and managed via the Mo Speech admin dashboard. Admins can:

- Create a new pack from scratch — adding symbols, lists, sentences, first-thens
- Preview the pack as a user would see it before publishing
- Set a `publishedAt` date (null = draft, not visible to users)
- Set an `expiresAt` date — pack automatically hides after this date (Halloween pack goes live 1 October, expires 1 November)
- Mark as `featured` — appears in the home dashboard promotional section
- Add `season` and `tags` for discoverability
- Unpublish or delete at any time

No code deploy is required to publish, update, or expire a pack.

---

## Home Dashboard Promotion

Featured and current seasonal packs are surfaced on the Home dashboard. The home screen fetches a lightweight metadata index on load — just name, cover image, season, and featured flag — not the full pack content. Full content only fetches when the user taps to preview or load.

The promotional section updates automatically as packs are published and expired by the admin team.

---

## Loading a Pack

When a parent loads a pack:

1. A Convex mutation `loadResourcePack(profileId, packId)` runs
2. Creates a `profileCategory` from the pack's category
3. Creates `profileSymbol` records for each symbol (with any starter display overrides)
4. Creates `profileList`, `profileSentence`, `profileFirstThen` records
5. Sets `librarySourceId` on all created records — the only thread back to the source
6. Content is now fully in the user's profile — the library is not touched again

The loaded content is completely independent from the library. Editing it does not affect the pack. Deleting the pack does not affect the user's content.

---

## Reload Defaults

If a category has a `librarySourceId`, the parent can "Reload Defaults" — reset all customisations back to the original pack state.

This is a destructive action. The confirmation modal warns clearly:
- All label overrides will be lost
- All colour and display changes will be reset
- Custom audio will be deleted from R2
- Custom images (AI generated, uploaded) will be deleted from R2
- This cannot be undone

On confirm, all `profileSymbol` records for the category are deleted and recreated from the library source. The `librarySourceId` is preserved so defaults can be reloaded again in future.

---

## Individual Items

Parents can also browse and load individual items from the library — a single list, a single sentence, a single first-then — without loading the full pack. These load into an existing category of the parent's choosing.
