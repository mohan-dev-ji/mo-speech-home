# AI Image Generation (symbol editor → AI Generate tab)

**Status:** Shipped — uncached generation + dual meters (MOS-48) · create-only tab (MOS-47) · generations land in the account's image library (MOS-52)
**Relates to:** ADR-023 (uncached generation) · ADR-024 (the image library and the one-hard-delete rule — the governing decision for everything after the provider call) · ADR-005 (symbol editor image sources) · MOS-48 · MOS-47 · MOS-52 · MOS-49 (tier pricing, which sets the ceiling)

> **One-line vision:** an instructor who needs a symbol that SymbolStix doesn't have and image search can't find describes it, sees it drawn in one of four styles, and keeps re-rolling until one is right — inside a monthly allowance they can spend however they like.

---

## 1. What the feature is for

**Tangible, generic objects absent from SymbolStix and unfindable by image search.** That is the whole brief, and it is narrower than "AI images" sounds.

The four style templates wrap every prompt in *single subject only, isolated on a pure white background, no ground, no scenery*. A prompt describing a scene, an action, a specific person, or an abstract idea fights that wrapper and disappoints. The tab is responsible for making that legible **before** a credit is spent — MOS-47 does it by showing the wrapped prompt with the user's words highlighted in place, which teaches the constraint by showing it rather than asserting it.

Two style behaviours users must be told about, both observed while generating the sample thumbnails:

- **Photorealistic renders a shadow** despite `no shadow` in the template. The negatives are suggestions, not constraints.
- **Storybook anthropomorphises.** A racing car came back with eyes, unprompted. Ask it for "a cup" and you may get a cup with a face.

## 2. Access and limits

| | value | where |
|---|---|---|
| Tier | Max only (server-authoritative) | `getMyAccess` check in the route |
| Daily cap | 20 | `AI_IMAGE_DAILY_LIMIT` overrides |
| Monthly ceiling | 100 | `AI_IMAGE_MONTHLY_LIMIT` overrides |
| Month boundary | 1st, UTC | matches `todayKey()`'s existing convention |

**The month is the budget; the day is a runaway guard.** Real usage is bursty — a family sets up one or two categories in a week and then doesn't touch the feature for a month — so a daily-only cap punishes the setup week for no saving. With a monthly ceiling in place the daily number can be generous without changing worst-case cost.

Both meters are checked before either is incremented, in one Convex transaction. A generation that fails or is refused refunds **both**.

100/month is a **starting number to be corrected with evidence**, not a commitment. It was sized on a guess of ~15 custom symbols × ~3 attempts for a heavy setup month; §6 is how that guess gets replaced.

Overrides exist because a content module is 12 symbols and default-content authoring cannot happen inside a family-sized allowance. Both parse fail-closed — a malformed value falls back to the default rather than becoming `NaN`, which would silently grant unlimited generations (`current >= NaN` is always false).

## 3. Generation behaviour

**Every Generate is a live provider call. Nothing is cached across sessions or accounts** — see ADR-023 for why, including the census that killed the shared cache.

The consequence users care about: *pressing Generate again gives a different image.* `gemini-2.5-flash-image` is non-deterministic and no seed is pinned, so this needs no variant machinery — it is what the provider does when nothing intercepts it.

Flow: auth → Max check → both meters checked and incremented → provider call (~5–10s) → the returned PNG is re-encoded server-side to a **512px webp** (`sharp`, the same parameters as `resizeImage.ts`) → written to `accounts/<accountId>/images/<uuid>.webp` → indexed as an `accountImages` row carrying the prompt → the route answers **`{ imageKey }`** as JSON.

Two things follow from ADR-024's decision that adoption is **by reference**. The resize has to happen server-side, because the object in the library is the object a board will render — a raw 1024px PNG there would be an ~880KB board image. And the response is an identifier rather than bytes, because the tab no longer displays the result; it only needs to know which library row to highlight.

**The generation is safe before the user does anything.** The library write happens inside the request, so nothing depends on the user reacting, adopting, or keeping the modal open. A storage failure at that point refunds both meters, exactly like a provider failure, and is never reported as a refusal.

### The tab is create-only; the result lives in My Images

There is no result view on the AI Generate tab, no Discard, no Add to symbol, and no session reel. The tab's job ends at "a generation now exists".

- **The spinner pre-announces the destination** — *"Generating… this takes a few seconds. Your image will be saved to My Images."* Arriving in the gallery is then confirmation, not surprise. On success the modal switches to My Images with the new row highlighted; a newer generation always wins that highlight, even after a manual tile tap.
- **Failures stay on the AI tab.** There is nothing to show in the gallery, and the prompt the user has to change is on this tab.
- **Adoption happens in My Images, by reference** — see §4.

**ADR-023's one accepted regression is retired.** "An image generated and never adopted is gone permanently" was true of the reel-era tab and is no longer true of anything: every generation is in the library before the client hears about it, and it stays there until the user deletes it from the gallery on purpose (ADR-024's one hard delete). Re-rolling costs a credit, as it always did, but it no longer destroys the previous attempt.

The tab is still **mounted for the whole time the modal is open** and hidden with `display:none` when another image source is selected, so the prompt text and attempt counter survive a tab switch. One consequence worth knowing: the tab's quota subscription stays live for the modal's whole lifetime, not just while the AI tab is on screen — a single lightweight query, accepted deliberately.

## 4. Adoption

Adoption happens in **My Images**, not on the AI tab, and it is **by reference**: the symbol points at the library row's own R2 key rather than re-uploading the bytes. The draft carries `libraryImageSource` so the row's provenance (`aiGenerated`) travels with it and the saved symbol is still typed as AI-generated — `my-images` is a container, not a source. See ADR-024 for why a copy would break the gallery's delete gate.

Adopting overwrites the description label with the prompt — the prompt *is* the concept the symbol is for — and decouples afterwards, so editing the label doesn't echo back. It clears any image-search attribution left by another tab. AI-generated images are recordable in the image-credit registry; SymbolStix and user uploads are not — and the credit row is written **at adoption**, by `handleImageReferenced` as it attaches the library row by reference, not when the image is generated. That is the same moment the pre-library flow recorded it (the credit used to ride on the adopt-time upload), and it is the right one: `imageCredits` records images *in use*, while merely owning a generation is what its `accountImages` row already says (ADR-024 §1). The write is idempotent on the key, so re-adopting the same picture on a second symbol is a no-op.

Deleting the symbol afterwards does **not** delete the image: the placement goes, the picture stays in My Images, and only the gallery's own Delete removes it from R2 (ADR-024).

## 5. Failure modes

| case | status | behaviour |
|---|---|---|
| Not Max | 403 | Upsell panel; no call made |
| Prompt > 500 chars | 400 | — |
| Daily cap reached | 429 `meter: "day"` | "You've used today's 20 — more tomorrow" |
| Monthly ceiling reached | 429 `meter: "month"` | "You've used this month's 100 — resets on the 1st" |
| **Provider refusal** | 422 | Deterministic: the same prompt and style will be refused identically, so the copy must say *change the wording*, never *try again*. Both meters refunded. |
| Provider error | 502 | Both meters refunded |
| Storage/index failure after a successful generation | 502 `storage_error` | Both meters refunded. Reported as a storage failure, never as a refusal — the model did its job |

The refusal path is the one that most needs care. A 200 response with no image part **is** a refusal, not a malformed response — Gemini declines by returning success plus a `finishReason` and usually a text explanation. Everything the model said goes into the server log; the user gets copy that tells them to rephrase (MOS-40).

Prompt text is logged server-side (it is the one place it's needed for debugging) and **never** sent to analytics.

## 6. Instrumentation

The feature ships partly blind — the cache made attempts-per-kept-image unmeasurable, because identical prompts returned identical images and nobody could meaningfully re-roll. These events exist to replace the guess in §2 with a number:

| event | where | properties |
|---|---|---|
| `ai_generate_used` | server | `tier`, `style`, `dailyRemaining`, `monthlyRemaining` |
| `ai_generate_adopted` | modal | `style`, **`attempts`** — generations before this one was kept. Fires from My Images, once, for the row this session generated |
| `ai_generate_quota_blocked` | server | `meter: "day" \| "month"` — which ceiling actually bites |

`cached` is gone as a property; it would be `false` forever. **`ai_generate_abandoned` is gone too** — it measured spend destroyed at modal close, and since MOS-52 nothing is destroyed at modal close. A generation that isn't adopted today is sitting in My Images waiting to be adopted tomorrow, so "abandoned" no longer names an event that happens.

**No prompt text in any event, ever.** Style is a fixed enum and safe; the prompt is user content and, in an AAC app, is frequently about a specific child.

Read these together after a month of real use: if `adopted.attempts` is high, the templates or the guidance are failing, not the allowance. If `quota_blocked` fires on `month` for engaged users, 100 is too low. If it never fires at all, it is too high and the cost model has room. The gap between `ai_generate_used` and `ai_generate_adopted` counts is now a *library* of unadopted images, not wasted spend — check My Images before reading it as waste.

## 7. Privacy

Generated imagery is account-scoped from the moment it is created — it is written straight to `accounts/<accountId>/images/` and indexed against that account — and is never shared between accounts. The library is per-account: no query returns another account's rows, and account deletion wipes the whole prefix. Prompts are never stored server-side beyond request logs and are never sent to analytics. This is a change of posture, not a restatement: until ADR-023 the generated image was global and keyed on the user's own words.
