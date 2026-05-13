# Resource Library Catalogue

Operational tracking of every library pack — planned, in-progress, and live. Spec lives in [`docs/1-inbox/ideas/06-resource-library.md`](../../1-inbox/ideas/06-resource-library.md). Authoring workflow lives in the same doc under "Recommended Authoring Workflow". This file is the catalogue — keep it current as packs are added, promoted, or retired.

---

## Tier rationale

- **Free** — universal essentials, safety, inclusion. Demo the platform; never paywall content every family needs.
- **Pro** — year-round depth. Special interests sustained over months (dinosaurs, cars, space). Daily-life verticals (school, food). The "I'd use this every week" tier.
- **Max** — peaks. Seasonal festivals, life events, fully illustrated story packs. The "I want this for the big moments" tier. Usually billed against a single time-bound event.

Drift check: if a pack feels equally at home in two tiers, ask: "would a family with one obsessed kid renew for this all year?" → Pro. "Would they pay for this once a year for a specific moment?" → Max.

---

## Status legend

- **Planned** — idea captured, no authoring yet
- **Authoring** — in admin view on dev, work in progress
- **Review** — feature-complete, pending sanity-check in instructor view (see authoring workflow §4)
- **Live** — published, visible in `/[locale]/library`
- **Archived** — was live, no longer published (e.g. expired seasonal, deprecated)

---

## Catalogue

| Pack | Tier | Status | Season | Notes |
|---|---|---|---|---|
| Religion & Faith | Free | Live | — | Cross-faith neutral — ship before any single-faith pack; balanced symbol set |
| Fun | Free | Live | — | |
| Dinosaurs | Pro | Planned | — | Kids' obsession classic — high upgrade-driver |
| Cars & Vehicles | Pro | Planned | — | |
| Computers & Gaming | Pro | Planned | — | Older-kid appeal; controllers, screens, characters |
| Space & Planets | Pro | Planned | — | |
| Animals | Pro | Planned | — | Consider splitting later: Farm / Wild / Sea |
| Music & Instruments | Pro | Planned | — | |
| Diwali | Max | Planned | Oct / Nov | Expire ~2 weeks after; re-publish each year. Fully illustrated |
| Christmas | Max | Planned | Dec | Fully illustrated story pack |
| Chinese New Year | Max | Planned | Jan / Feb | Fully illustrated; consider zodiac variant per year |

---

## Per-pack outlines

Lightweight outlines for packs you're authoring. Add a section here when you start each one — category symbols, suggested sentences, suggested lists. Sections can stay rough; they're a working scratch surface, not a spec.

### Religion & Faith (Free · Live)

*Live; outline preserved for reference and translation work.*

- **Category symbols** *(48)*: TBD — populate after pack is finalised
- **Sentences**: TBD
- **Lists**: TBD

### Fun (Free · Live)

- **Category symbols** *(48)*: TBD
- **Sentences**: TBD
- **Lists**: TBD

### Dinosaurs (Pro · Planned)

- **Category symbols** *(48)*: tyrannosaurus, triceratops, stegosaurus, velociraptor, brachiosaurus, pterodactyl, fossil, dig, egg, footprint, museum, scientist, jungle, volcano, river, plants, meat-eater, plant-eater, big, small, fierce, gentle, roar, run …
- **Sentences**: "I want to see the dinosaurs" · "T-rex is the biggest" · "Let's go to the museum" · "Look at the fossil"
- **Lists**: *Dig for fossils* (pick spot, brush, scrape, find, label) · *Museum visit* (ticket, map, pick exhibit, look, snack)

### Diwali (Max · Planned)

- **Category symbols** *(48)*: diya, rangoli, fireworks, sweets, gifts, lakshmi, ganesh, mehndi, new clothes, blessing, lights, family, prayer, sparkler, candle …
- **Sentences**: "Happy Diwali" · "Let's light the diyas" · "I want sweets" · "Look at the lights" · "Time for prayer"
- **Lists**: *Diwali sweets* (laddu, jalebi, barfi, gulab jamun, soan papdi) · *Getting ready* (bath, new clothes, mehndi, jewellery, family photo, gifts)

### Christmas (Max · Planned)

- **Category symbols** *(48)*: tree, baubles, lights, star, presents, Santa, reindeer, snowman, stocking, carol, turkey, cracker, mince pie, snow, candle …
- **Sentences**: "Merry Christmas" · "I want a present" · "Time to decorate the tree" · "Father Christmas is coming"
- **Lists**: *Christmas Eve* (dinner, bath, pyjamas, story, sleep) · *Christmas morning* (presents, breakfast, family video call, lunch, walk)

### Chinese New Year (Max · Planned)

- **Category symbols** *(48)*: lantern, dragon, lion dance, red envelope, dumplings, fireworks, zodiac animal, ancestor altar, blossoms, gold, family meal, sweep, scroll …
- **Sentences**: "Happy New Year" · "Let's watch the dragon dance" · "I got a red envelope" · "Time for dumplings"
- **Lists**: *Reunion dinner* (set table, dumplings, fish, rice, fruit) · *New Year's morning* (red clothes, greet elders, red envelopes, treats)

---

## Future ideas (parking lot)

Captured here so they're not lost; promote into the table when ready.

- **Pro**: Sport · Construction & Building · Princesses & Fairy Tales · Superheroes · Trains & Tracks · Food & Cooking · Weather · Body & Feelings · Garden
- **Max — Festivals**: Eid · Vaisakhi · Hanukkah · Halloween · Easter · Holi · Lunar / Mid-Autumn · Bonfire Night
- **Max — Life events**: Wedding · Birthday · New Sibling · Moving House · First Day at School · Hospital Visit · Holiday Abroad

---

## Maintenance notes

- Update this file in the same PR as any pack publish / unpublish / tier change. Easier to keep in sync than retrofit later.
- When a seasonal pack expires, change Status → Archived rather than deleting the row — keeps the rationale and outline available for the next year's edition.
- When tier strategy shifts (rare), update the "Tier rationale" section first, then re-tier individual packs.
- Per-pack outlines can stay rough. They're a scratch surface, not a feature spec. Promote a pack to its own doc in `docs/4-builds/features/` only if it grows complex (e.g. dedicated illustration brief, voice talent procurement).
