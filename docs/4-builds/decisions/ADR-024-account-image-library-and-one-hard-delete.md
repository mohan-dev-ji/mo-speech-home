# ADR-024 — The account keeps the images it paid for, and one place deletes them

**Status:** accepted
**Date:** 2026-09-05
**Partly reverses:** ADR-023 decision point 3 (the request-path R2 upload) and point 5 (the session reel) · the **image** half of MOS-50 (`4b2673b`)
**Related:** ADR-023 (uncached generation — still stands, see below) · ADR-005 (symbol editor image sources) · ADR-022 (module asset promotion) · MOS-52 · MOS-50 · MOS-44 (replace orphans)

## Context

Two decisions, both correct when made, had the same premise: **there is nowhere for an image to live except on a symbol.**

- **ADR-023** removed the per-generation R2 write because nothing read it, and accepted the consequence in as many words: *"an image generated and not adopted is gone permanently once the modal closes."* A session-scoped reel in the AI tab covered that within one editing session and nothing covered it across sessions.
- **MOS-50** (`4b2673b`) made a symbol delete take its adopted AI image with it. That was right too — an image nothing points at, in a product with no gallery, is an object no screen can ever show and no user can ever remove, billed forever.

Phase 36 (MOS-52) builds the gallery. Both premises are gone. An instructor pays roughly 4p and eight seconds per generation, out of a metered monthly allowance, for a picture that cannot be reproduced identically; the product was throwing those away on two separate paths — one at modal close, one at symbol delete.

### Why the R2 write is back, and why ADR-023 still stands

A reader diffing this ADR against ADR-023 will see one decision add the write another removed. They are not the same write. **The difference is ownership, not mechanism:**

| | ADR-023's write | ADR-024's write |
|---|---|---|
| Destination | `ai-cache/<uuid>.png`, one global namespace | `accounts/<accountId>/images/<uuid>.webp` |
| Read by | `aiImageCache`, keyed on `(model, style, template, prompt)` | `accountImages`, keyed on `accountId` |
| Serves | any account that typed the same words | the account that paid for it |
| Lifetime | forever, unreachable, ~79% dead | until that account deletes it on purpose |

ADR-023's census killed a **shared cache** that served one family's image to another and whose hit counter was measuring frustration. Nothing in that reasoning is reversed here. What returns is a write into the user's **own account-scoped library** — the same namespace adoption already used since Phase 29 — because they bought the image and it is theirs.

## Decision

### 1. `accountImages` indexes every image the account owns

A new Convex table, **one row per R2 key** (`accountId`, `imageKey`, `source`, optional `prompt`), indexed `by_account`, ordered by `_creationTime` for the newest-first grid. R2 lists lexicographically and carries no metadata, so the ordering has to be a Convex index.

**It is a sibling of `imageCredits`, never a merge with it.** `imageCredits` records attribution obligations for images *in use*; `accountImages` records what the account *owns*, including images no symbol has ever referenced. Folding never-used rows into the credits table would muddy every credit report that reads it. The grid joins the two per row so a re-used Image Search picture carries the attribution its licence obliges us to display.

All three sources land in the table: the AI route writes a row as it uploads, and uploads and Image Search picks are recorded at save by `recordAccountImageSafely`, which sits beside `recordImageCreditSafely` at all four upload sites and shares its contract — never rejects into `handleSave`, never makes the user wait, recoverable by `scripts/backfill-account-images.mjs`. **Audio is never recorded; it is not in the library.**

### 2. THE RULE — one hard delete, everything else soft. For images.

**The My Images Delete button is the only thing in the product that removes an image object from R2.** Every other delete — symbol, category reload, module uninstall, list, sentence, phrase, folder — removes the *placement* and leaves the object alone. The image reappears in My Images, where the account can delete it deliberately.

The gallery's Delete is gated on **`countRowsReferencingKeys`** (`convex/lib/personalAssetRefs.ts`) — the same predicate the orphan sweep uses, deliberately not a second "is this in use?" walk. Two walks drift, and the drift is silent in both directions: the UI refusing to delete what the sweep calls garbage, or the sweep flagging what the UI is protecting. MOS-50 found that question already being asked in four places, having drifted in two.

The gate runs twice on purpose. The button reads `usageCount` and greys itself out, which is only a snapshot — a collaborator or a second tab can place the image between query and click — so `deleteIfUnused` re-counts inside the mutation and throws `IN_USE`, which `/api/delete-account-image` turns into a 409 carrying the real number. The mutation also drops the matching `imageCredits` row: once the object is gone, the credit describes a picture that no longer exists.

### 3. Recorded audio still hard-deletes. The principle is cost of recreation, not media type.

This asymmetry is the decision most likely to be "tidied up" by a future reader, so it is written at every site and again here.

- An **AI image** costs money and provider time, cannot be reproduced identically, and **has a home to be seen in**. Soft-deleting it is free: the user can find it and remove it.
- A **recording** costs ten seconds of a parent's time to redo and **has no library**. A soft-deleted recording would be an invisible leak — an object nothing points at, no screen can show, and the account is billed for forever. That is exactly the failure mode MOS-50 was right about, still true for audio because audio has no gallery.

**Two questions, two predicates, never merged** (`convex/lib/contentModuleDelete.ts`):

- **`isPersonalAudioKey`** — *"may deleting a placement remove this object from R2?"* The **delete-candidate** walk. A personal key with an `/audio/` segment; used by all nine collectors. Images are not candidates, by construction.
- **`isPersonalAssetKey`** — *"is this object owned by one account?"* The **referenced** walk (`collectReferencedPersonalKeys`, `countRowsReferencingKeys`), unchanged and **must keep seeing image keys** — it is what stops the gallery deleting an image a symbol still uses.

Collapsing these into one predicate breaks the gallery's safety gate. They answer different questions about the same key.

### 4. Half of MOS-50 is reversed; the other half stays

`4b2673b` did two things. The **delete** half — image keys collected as delete candidates on symbol/category/module paths — is reversed here, at every one of the nine collectors, plus `profileSentences`/`profilePhrases` and the `lib/contentModuleDelete` list/sentence/phrase collectors. The **counting** half — `getProfileSymbolUsageCount`, which drives the "used by N other items" warning — is untouched: it is a warning, not a delete path.

One deliberate exception: `studentProfiles.profilePhoto` keeps `isPersonalAssetKey` as its collector. No UI writes that field and it is absent from My Images, so soft-deleting it would mean invisibly leaking it. If a UI ever writes profile photos, that collector moves under this rule.

### 5. Adoption is by reference, not by copy

Selecting a library image and pressing **Add to symbol** points the draft at the library row's **own R2 key**. No second object is minted.

This is load-bearing, not an optimisation. Every save path mints a fresh key and uploads any pending blob, so handing the grid's selection back as a blob would create a second R2 object per Add and leave the symbol pointing at a key the library has never heard of — destroying the very join the "used by N other items" delete gate depends on.

What a reference loses is the **type**: `my-images` is a container, not a source. The draft therefore carries `libraryImageSource` (the row's own `aiGenerated` / `userUpload` / `imageSearch` tag), and one helper — `imageSourceTypeForDraft` — resolves it, replacing five duplicated tab→type ternaries that would each have fallen through to `upload`. **Provenance travels with the library row**, so a re-used Image Search picture keeps its attribution and a re-used AI image stays `aiGenerated`.

### 6. The AI route resizes server-side and answers with JSON

Because the symbol now references the library object itself, **the library object is what a board renders.** A raw 1024px PNG in the library therefore becomes an ~880KB board image — the exact problem `scripts/backfill-ai-image-sizes.mjs` existed to fix. So `/api/ai-generate/imagen` re-encodes to a **512px webp with `sharp`** (an explicit pinned dependency, `0.34.5`, same parameters as `resizeImage.ts` and the backfill) before the R2 write. The client-side resize on arrival, which ADR-023's flow relied on, has nothing left to do for AI images.

The route returns **`{ imageKey }`** as JSON instead of PNG bytes with `X-*` headers. The client no longer displays the result; it only needs to know which library row to highlight.

### 7. The session reel is retired, and the tab is create-only

Everything the reel protected is now persisted. The AI tab has no result view, no Discard, no Add to symbol: the spinner **names the destination before the switch happens** ("your image will be saved to My Images"), so arriving in the gallery is confirmation rather than surprise, and adoption happens there, by reference. Failures stay on the AI tab — there is nothing to show in the gallery and the prompt the user needs to change is on this tab.

`ai_generate_abandoned` is deleted from the analytics contract. It cannot mean anything once nothing is abandoned.

### 8. MOS-44 is resolved by design

"Replacing a symbol's image orphans the old one" stops being a bug the moment the old image is a library entry. There is no delete-on-replace and there should not be one; a replaced image is exactly the thing this ADR says the account keeps.

## Consequences

**Gained**

- Nothing the account paid for is destroyed by the app. Both loss paths — modal close and placement delete — are closed.
- The single real regression ADR-023 accepted is **retired**, and by a mechanism that is smaller than the cache it replaced: a per-account index, not a global keyed store.
- One image can be re-used across many symbols without re-uploading its bytes.
- One "is this in use?" predicate, one delete route, one gate — the drift MOS-50 cleaned up cannot recur by inlining.

**Costs, accepted**

- **R2 grows monotonically per account until the user prunes it.** That is the promise: you keep what you paid for. The user-facing pressure valve is the gallery's own Delete; the operational one is the monthly generation ceiling (FEAT-008 §2), not storage. A storage fee was considered and rejected (MOS-52).
- The orphan sweep now **keeps** any key with an `accountImages` row and reports it under that reason (`listAllKeysForSweep`, a deliberate full-table collect — fine for an owner-run census, never for a request path). A future sweep with a delete arm must not treat the library as garbage; that was the whole point of adding the KEEP section before any such arm exists.
- **`npx convex export` snapshots never contain R2 objects.** A restore brings back the index and not the pictures, which is a library of broken tiles. The durability of "you keep what you paid for" is bounded by R2, not by the Convex backups in `CLAUDE.md`. R2 is the thing to back up if this promise is ever to be more than best-effort.

**Deliberately not done**

- **No special case for account deletion.** `/api/delete-account` already wipes `accounts/<id>/` and every `profiles/<id>/` prefix wholesale, so library objects go with everything else; `cascadeDeleteAccount`'s compiler-enforced table list picks up `accountImages` on its own.
- **No second usage predicate**, no delete-on-replace, no confirm dialog on the gallery Delete (select-a-tile-then-press-Delete is already the deliberate two-step; a modal inside a modal would be a third).
- **`studentProfiles.profilePhoto` is left alone** — see decision 4.
