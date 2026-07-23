# TTS cache fix — `skipSymbolstix` so literal clips cache — Implementation Plan

> **Self-contained. Execute on `main`** (not a worktree). The owner runs `npx convex dev` on `main`, so the Convex change here **auto-deploys**; a worktree cannot deploy it. This is the one deploy-dependent leftover from Phase 15.6 Stage 2 (Variant Lifecycle fork-on-edit), deferred to the `main` merge on purpose.
> **Design spec:** [`docs/superpowers/specs/2026-07-18-language-variant-lifecycle-design.md`](../../../superpowers/specs/2026-07-18-language-variant-lifecycle-design.md) §2 item 4 "Perf follow-up".
> **ADR:** [`ADR-016 Addendum I`](../../decisions/ADR-016-composed-content-language-variants.md) — "Deferred to the `main` merge".

---

## Problem (verified end-to-end, 2026-07-19)

Stage 2 made composed/authored content speak its **literal** text via `POST /api/tts` with `literal:true`, which skips the SymbolStix per-language default so a word says what was typed in the board voice (e.g. "breakfast" in a Hindi accent), not the translated word ("nashta"). That works. But **literal clips never cache** — every play re-synthesizes.

Root cause is on the **read** side, in `convex/ttsCache.ts` → `resolveCachedAudio`:

1. `/api/tts` calls `api.ttsCache.lookup`. `resolveCachedAudio` checks **SymbolStix first** and, for a known single word like "breakfast", returns `{ source: "symbolstix" }` **before it ever consults the `ttsCache` table**.
2. The route sees `literal` is true and correctly **ignores** the symbolstix result (`if (!literal && lookup.source === "symbolstix")`, `app/api/tts/route.ts:233`) — but because `lookup` short-circuited at symbolstix, it **never returned the cached literal clip**, even though one exists.
3. So the route falls to Step 3: re-synthesizes via the paid Google TTS API and **writes another `ttsCache` row** (`route.ts:278`). Every play. The clip is written but can never be read back.

**Cost:** every literal play of a *known* word (composed word block, 1-word list-item description) = one paid TTS API call + latency + a duplicate `ttsCache` row (function-call + storage cost), and it defeats the global cross-user cache reuse. Multi-word literal text is unaffected (it matches no single symbol, so `resolveCachedAudio` already falls through to the cache).

## Fix

Give `resolveCachedAudio` / the `lookup` query a `skipSymbolstix` flag; when a request is `literal`, the route asks `lookup` to skip the symbol check so it returns the `ttsCache` hit. `checkMany` (the authoring availability signal) is **left unchanged** — it legitimately wants the symbolstix source.

**⚠️ Deploy ordering (critical — avoids the same `ArgumentValidationError` skew we hit before).** The Convex function and the route client must not go live out of order: passing `skipSymbolstix` to a `lookup` whose deployed validator doesn't know the arg throws `ArgumentValidationError`.

- Do **Step 1 (Convex) first**, save, and **confirm `convex dev` has redeployed** (watch the `convex dev` terminal print a successful push, or that the app's literal TTS still works) **before** doing Step 2 (route).
- On `main` with `convex dev` running this is near-atomic (it redeploys within seconds of the file changing), but do them in this order and verify between.

---

### Step 1 — Convex: `resolveCachedAudio` + `lookup` accept `skipSymbolstix`

**File:** `convex/ttsCache.ts`.

- [x] Add the param to `resolveCachedAudio` and guard the SymbolStix block with it. Current signature (~`:22`):
```ts
async function resolveCachedAudio(
  ctx: QueryCtx,
  text: string,
  voiceId: string,
  tone?: string,
  // `skipSymbolstix` (Variant Lifecycle Stage 2 perf): literal requests bypass the
  // SymbolStix default lookup so a KNOWN word (e.g. "breakfast") still resolves the
  // cached literal TTS clip instead of short-circuiting at symbolstix + regenerating.
  skipSymbolstix?: boolean,
): Promise<ResolveResult> {
```
Then change the SymbolStix guard from `if (!viaGemini) {` (~`:37`) to:
```ts
  if (!viaGemini && !skipSymbolstix) {
```
(The `ttsCache` table lookup below it is unchanged — with symbolstix skipped, execution falls straight to it.)

- [x] Thread it through the `lookup` query (~`:91`):
```ts
export const lookup = query({
  args: {
    text: v.string(),    // normalised (lowercase, trimmed)
    voiceId: v.string(),
    tone: v.optional(v.string()),
    skipSymbolstix: v.optional(v.boolean()),
  },
  handler: async (ctx, { text, voiceId, tone, skipSymbolstix }) =>
    resolveCachedAudio(ctx, text, voiceId, tone, skipSymbolstix),
});
```
- [x] **Leave `checkMany` as-is** — it calls `resolveCachedAudio(ctx, text, voiceId)` with no skip, which is correct (the authoring signal wants to know a symbol is seeded).
- [x] Verify convex tsc: `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json --noEmit` clean. **Confirm `convex dev` redeployed** before Step 2.

### Step 2 — Route: pass `skipSymbolstix: literal`

**File:** `app/api/tts/route.ts`. The `lookup` call is ~`:226`.
- [x] Add the arg (only literal requests set it; everything else omits it and behaves exactly as today):
```ts
  const lookup = await convex.query(api.ttsCache.lookup, {
    text: normalised,
    voiceId,
    tone: requestedTone,
    ...(literal ? { skipSymbolstix: true } : {}),
  }) as LookupResult;
```
- [x] Verify app tsc: `npx tsc --noEmit 2>&1 | grep -E "^(app|lib|convex)/" | grep -v "lib/stripe.ts"` clean.

### Step 3 — Verify (owner, manual, on the running app)

- [x] On a HI board, play a **1-word list item** whose description is a known symbol word (e.g. "breakfast") **twice**. First play: `[TTS] … source":"none"` then `source: "generated"`. **Second play must be a cache hit** — the `/api/tts` response `source: "cache"` (check the server log: `lookup=` now returns `ttsCache`, and the response is `cached:true`). Before this fix the second play logged `symbolstix` and regenerated.
- [x] Play a **composed word block** (single-symbol block in a sequence sentence) twice — same: second play is a cache hit.
- [x] **Symbols/talker unchanged:** a plain symbol tap (NOT literal) still returns `source:"symbolstix"` and plays the seeded per-language default (it must NOT synthesise). This proves the skip is scoped to literal only.
- [x] Multi-word literal text still works (was already caching).

### Step 4 — Docs + commit

- [x] Flip the deferred rows to ✅ in [`ADR-016 Addendum I`](../../decisions/ADR-016-composed-content-language-variants.md) ("Deferred to the `main` merge") and in [`phase-15.6-variant-lifecycle-2-fork-on-edit.md`](phase-15.6-variant-lifecycle-2-fork-on-edit.md) (ledger `:24` + self-review `:153`). Move this plan to `plans/_done/` when it ships.
- [x] Commit: `git commit -am "perf(tts): skipSymbolstix on literal lookup so literal clips cache (not regenerate)"`.

## Notes
- **No schema change, no migration.** One optional query arg + one optional route arg, both additive and back-compatible.
- **Rollback** is trivial: revert both edits; literal clips go back to regenerating (correctness unaffected — only cost/latency).
