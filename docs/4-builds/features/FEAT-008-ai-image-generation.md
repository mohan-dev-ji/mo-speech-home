# AI Image Generation (symbol editor → AI Generate tab)

**Status:** Shipped — uncached generation + dual meters (MOS-48) · tab UI pending (MOS-47)
**Relates to:** ADR-023 (uncached generation — the governing decision) · ADR-005 (symbol editor image sources) · MOS-48 · MOS-47 · MOS-49 (tier pricing, which sets the ceiling)

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

Flow: auth → Max check → both meters checked and incremented → provider call (~5–10s) → the raw PNG returned inline to the client, which resizes it to a 512px webp before previewing. R2 is not touched. The image reaches R2 only if the user adopts it, at which point it is uploaded to `accounts/<accountId>/images/<uuid>.webp` and the symbol records `imageSource: { type: "aiGenerated", imagePath, aiPrompt }`.

**The resize (`toResizedWebp`, browser-side — it needs canvas) runs on arrival, not on adoption.** The preview is then the exact artefact that will be saved — no surprise on save — and the session reel costs ~20KB per image instead of ~880KB.

### The session reel

Generated images stay in the tab's state for the editing session, capped at 10, object URLs revoked as they fall off. Nothing already paid for is lost mid-task: a user can generate, generate again, and go back to the first one.

It ends when the modal closes. **An image generated and never adopted is gone permanently** — the accepted regression in ADR-023.

MOS-47 owns what this looks like: Generate on the prompt row always, Add to symbol and Discard always present and disabled when there is nothing to act on.

## 4. Adoption

Adopting an image overwrites the description label with the prompt — the prompt *is* the concept the symbol is for — and decouples afterwards, so editing the label doesn't echo back. It clears any image-search attribution left by another tab. AI-generated images are recordable in the image-credit registry; SymbolStix and user uploads are not.

## 5. Failure modes

| case | status | behaviour |
|---|---|---|
| Not Max | 403 | Upsell panel; no call made |
| Prompt > 500 chars | 400 | — |
| Daily cap reached | 429 `meter: "day"` | "You've used today's 20 — more tomorrow" |
| Monthly ceiling reached | 429 `meter: "month"` | "You've used this month's 100 — resets on the 1st" |
| **Provider refusal** | 422 | Deterministic: the same prompt and style will be refused identically, so the copy must say *change the wording*, never *try again*. Both meters refunded. |
| Provider error | 502 | Both meters refunded |

The refusal path is the one that most needs care. A 200 response with no image part **is** a refusal, not a malformed response — Gemini declines by returning success plus a `finishReason` and usually a text explanation. Everything the model said goes into the server log; the user gets copy that tells them to rephrase (MOS-40).

Prompt text is logged server-side (it is the one place it's needed for debugging) and **never** sent to analytics.

## 6. Instrumentation

The feature ships partly blind — the cache made attempts-per-kept-image unmeasurable, because identical prompts returned identical images and nobody could meaningfully re-roll. These events exist to replace the guess in §2 with a number:

| event | where | properties |
|---|---|---|
| `ai_generate_used` | server | `tier`, `style`, `dailyRemaining`, `monthlyRemaining` |
| `ai_generate_adopted` | client | `style`, **`attempts`** — generations before this one was kept |
| `ai_generate_abandoned` | client | `style`, `attempts` — closed having kept nothing; this is wasted spend |
| `ai_generate_quota_blocked` | server | `meter: "day" \| "month"` — which ceiling actually bites |

`cached` is gone as a property; it would be `false` forever.

**No prompt text in any event, ever.** Style is a fixed enum and safe; the prompt is user content and, in an AAC app, is frequently about a specific child.

Read these together after a month of real use: if `abandoned.attempts` is high, the templates or the guidance are failing, not the allowance. If `quota_blocked` fires on `month` for engaged users, 100 is too low. If it never fires at all, it is too high and the cost model has room.

## 7. Privacy

Generated imagery is account-scoped from the moment it is adopted and is never shared between accounts. Prompts are never stored server-side beyond request logs and are never sent to analytics. This is a change of posture, not a restatement: until ADR-023 the generated image was global and keyed on the user's own words.
