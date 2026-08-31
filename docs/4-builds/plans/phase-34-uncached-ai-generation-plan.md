# Phase 34 — Uncached AI Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the shared AI image cache so pressing Generate twice gives two different images, and replace the single daily quota with a 20/day + 100/month pair.

**Architecture:** The cache is removed rather than extended into a variant list — `gemini-2.5-flash-image` is already non-deterministic, so re-rolling needs no machinery once nothing intercepts it (ADR-023). Two quota meters live in the existing `featureQuota` table as two rows with different period keys, checked and incremented in one Convex transaction. Generated images are held in the tab's own state for the session so nothing paid for is lost mid-task.

**Tech Stack:** Next.js 16 route handler · Convex 1.x · Vertex AI REST (`gemini-2.5-flash-image`) · R2 · PostHog · next-intl

## Global Constraints

- **All UI copy via `useTranslations`; new keys go in `messages/en.json` ONLY.** Never hand-add a key to `hi.json` / `es.json` — the pipeline only translates keys *absent* from a locale, so a hand-added placeholder ships forever.
- **AAC theme tokens only** — no hard-coded colours, spacing, radii or font sizes. Tailwind CSS 4, vars in `app/globals.css`.
- **There is no test framework in this repo.** `package.json` has `dev` / `build` / `lint` / `pack:migrate` and no vitest, jest or playwright. Do not write test files; do not add a framework — that is a separate decision. Every task verifies with typecheck + lint + a named manual check.
- **Work on `main`.** Do not create a branch or a worktree.
- `npx convex dev` is already running on `main` and auto-pushes — Convex changes deploy on save. Do NOT start a second one.
- Node 20+ for any CLI work: `source ~/.nvm/nvm.sh && nvm use 20.17.0`.
- Prompt text is never sent to analytics. Server logs only.
- Governing decision: `docs/4-builds/decisions/ADR-023-uncached-ai-image-generation.md`. Capability spec: `docs/4-builds/features/FEAT-008-ai-image-generation.md`.

## File Structure

| file | responsibility after this phase |
|---|---|
| `lib/ai-image-limits.ts` | **new** — the two allowances and their env overrides, in one place both route and tab read |
| `convex/featureQuota.ts` | gains `getRemainingDual` / `checkAndIncrementDual` / `refundOneDual`; existing three functions untouched (image search uses them) |
| `convex/schema.ts` | `aiImageCache` removed; `featureQuota.day` comment explains the period key |
| `app/api/ai-generate/imagen/route.ts` | live generation only — no cache lookup, no cache write, no R2 upload |
| `app/components/…/symbol-editor/AiGenerateTab.tsx` | session reel, resize on arrival, two-meter footer |
| `lib/ai-style-prompts.ts` | gains `AI_IMAGE_MODEL` (model + templates verified together) |
| `lib/cache-identity.ts` | image-**search** cache only |
| `lib/analytics.ts` | event catalogue updated |
| `convex/imageCache.ts` | search cache only |
| `convex/migrations.ts` | `rehashAiImageCache` deleted |
| `scripts/sweep-cache-orphans.mjs` | search-cache census only |

**Task order matters.** The route stops using the cache (Task 2) before the cache is deleted (Task 6), so the app is never in a state where live code calls a removed function.

---

### Task 1: Limits module + dual-meter quota functions

**Files:**
- Create: `lib/ai-image-limits.ts`
- Modify: `convex/featureQuota.ts` (append; do not touch `getRemaining`, `checkAndIncrement`, `refundOne`)
- Modify: `convex/schema.ts:1401-1410` (comment only)

**Interfaces:**
- Produces: `AI_IMAGE_DAILY_LIMIT_DEFAULT: number`, `AI_IMAGE_MONTHLY_LIMIT_DEFAULT: number`, `resolveAiImageLimits(): { daily: number; monthly: number }`
- Produces: `api.featureQuota.getRemainingDual({ feature, dailyLimit, monthlyLimit })` → `{ daily: {used,remaining,limit}, monthly: {used,remaining,limit} } | null`
- Produces: `api.featureQuota.checkAndIncrementDual({ feature, dailyLimit, monthlyLimit })` → `{ dailyRemaining: number; monthlyRemaining: number }`, throws `"QuotaExceeded:month"` / `"QuotaExceeded:day"`
- Produces: `api.featureQuota.refundOneDual({ feature })` → `{ refunded: boolean }`

- [ ] **Step 1: Create the limits module**

Create `lib/ai-image-limits.ts`:

```ts
/**
 * AI image generation allowances (ADR-023).
 *
 * TWO METERS, and they are not the same kind of thing:
 *
 *  - MONTHLY is the budget. Real usage is bursty — a family sets up one or
 *    two categories over a week and then does not touch the feature again
 *    for a month — so the month is the honest unit to sell and to spend.
 *  - DAILY is a runaway guard, not an allowance. A stuck loop or a shared
 *    login is what it exists to stop.
 *
 * Because the month bounds total spend, the daily number is free to be
 * generous; capping the day tightly would only punish the setup week without
 * changing worst-case cost.
 *
 * 100/month is a STARTING NUMBER to be corrected with evidence, not a
 * commitment. It was sized on ~15 custom symbols x ~3 attempts for a heavy
 * setup month. `ai_generate_adopted.attempts` and `ai_generate_quota_blocked`
 * in PostHog are what replace the guess — see FEAT-008 §6.
 */
export const AI_IMAGE_DAILY_LIMIT_DEFAULT = 20;
export const AI_IMAGE_MONTHLY_LIMIT_DEFAULT = 100;

/**
 * Parsed defensively: a malformed value must not become NaN, because every
 * quota check is `current >= limit` and `x >= NaN` is always false — a typo
 * would silently grant unlimited generations rather than failing closed.
 */
function parseLimit(raw: string | undefined, fallback: number, name: string): number {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < 1) {
    console.warn(`[ai-generate] ignoring invalid ${name}=${raw}; using ${fallback}`);
    return fallback;
  }
  return n;
}

/**
 * SERVER ONLY — reads `process.env`. The overrides exist for admin authoring
 * sessions: a content module is 12 symbols, which cannot be authored inside a
 * family-sized allowance.
 *
 * KNOWN WART: the tab's footer renders the DEFAULTS, because these env vars
 * are not `NEXT_PUBLIC_` and must not be. During an admin session with an
 * override set, the footer therefore understates what is actually available.
 * Cosmetic only — the server is authoritative and nothing in the UI is
 * disabled by the footer. Pre-existing behaviour, carried forward knowingly
 * rather than fixed with a second env var that could disagree with this one.
 */
export function resolveAiImageLimits(): { daily: number; monthly: number } {
  return {
    daily: parseLimit(
      process.env.AI_IMAGE_DAILY_LIMIT,
      AI_IMAGE_DAILY_LIMIT_DEFAULT,
      "AI_IMAGE_DAILY_LIMIT"
    ),
    monthly: parseLimit(
      process.env.AI_IMAGE_MONTHLY_LIMIT,
      AI_IMAGE_MONTHLY_LIMIT_DEFAULT,
      "AI_IMAGE_MONTHLY_LIMIT"
    ),
  };
}
```

- [ ] **Step 2: Add the month key and row helpers to `convex/featureQuota.ts`**

Append below the existing `refundOne`. First change the import line at the top of the file from:

```ts
import { mutation, query } from "./_generated/server";
```

to:

```ts
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
```

Then append:

```ts
// ─── Dual meters: day + month (ADR-023) ──────────────────────────────────────
//
// THE `day` COLUMN IS A PERIOD KEY, not always a day. A daily row stores
// 'YYYY-MM-DD'; a monthly row stores 'YYYY-MM'. The two shapes can never
// collide, so `by_user_and_feature_and_day` addresses both without a schema
// change and image search keeps using the single-meter functions above,
// untouched.
//
// The column name is the wart. Renaming it to `periodKey` would migrate a
// table image search is actively writing to, for cosmetics — not worth it.

function monthKey(): string {
  // YYYY-MM UTC — the month rolls over at UTC midnight on the 1st, matching
  // todayKey()'s convention. A subscriber who joins on the 28th gets the
  // month's allowance for three days and then a fresh one; billing-anniversary
  // alignment is deliberately not built (FEAT-008 §2).
  return new Date().toISOString().slice(0, 7);
}

async function findQuotaRow(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  feature: string,
  period: string
) {
  return await ctx.db
    .query("featureQuota")
    .withIndex("by_user_and_feature_and_day", (q) =>
      q.eq("userId", userId).eq("feature", feature).eq("day", period)
    )
    .unique();
}

/**
 * Remaining counts for BOTH meters. Feeds the AI tab's footer.
 * Returns null when unauthenticated, matching `getRemaining`.
 */
export const getRemainingDual = query({
  args: { feature: v.string(), dailyLimit: v.number(), monthlyLimit: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const dayRow = await findQuotaRow(ctx, identity.subject, args.feature, todayKey());
    const monthRow = await findQuotaRow(ctx, identity.subject, args.feature, monthKey());

    const dayUsed = dayRow?.count ?? 0;
    const monthUsed = monthRow?.count ?? 0;

    return {
      daily: {
        used: dayUsed,
        remaining: Math.max(0, args.dailyLimit - dayUsed),
        limit: args.dailyLimit,
      },
      monthly: {
        used: monthUsed,
        remaining: Math.max(0, args.monthlyLimit - monthUsed),
        limit: args.monthlyLimit,
      },
    };
  },
});

/**
 * Check BOTH meters, then increment BOTH — in one transaction, so a request
 * can never spend the month without spending the day or vice versa.
 *
 * Throws `QuotaExceeded:month` or `QuotaExceeded:day`. The prefix is
 * deliberate: the route's existing `.includes("QuotaExceeded")` test still
 * matches, so the two sides can deploy in either order, while the suffix lets
 * the caller pick the right copy. Monthly is reported first when both are
 * exhausted — the longer wait is the more useful thing to tell someone.
 */
export const checkAndIncrementDual = mutation({
  args: { feature: v.string(), dailyLimit: v.number(), monthlyLimit: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const userId = identity.subject;

    // Read the period keys once — a call straddling UTC midnight must not
    // check one period and increment another.
    const day = todayKey();
    const month = monthKey();

    const dayRow = await findQuotaRow(ctx, userId, args.feature, day);
    const monthRow = await findQuotaRow(ctx, userId, args.feature, month);

    const dayUsed = dayRow?.count ?? 0;
    const monthUsed = monthRow?.count ?? 0;

    if (monthUsed >= args.monthlyLimit) throw new Error("QuotaExceeded:month");
    if (dayUsed >= args.dailyLimit) throw new Error("QuotaExceeded:day");

    if (dayRow) {
      await ctx.db.patch(dayRow._id, { count: dayUsed + 1 });
    } else {
      await ctx.db.insert("featureQuota", {
        userId,
        feature: args.feature,
        day,
        count: 1,
      });
    }

    if (monthRow) {
      await ctx.db.patch(monthRow._id, { count: monthUsed + 1 });
    } else {
      await ctx.db.insert("featureQuota", {
        userId,
        feature: args.feature,
        day: month,
        count: 1,
      });
    }

    return {
      dailyRemaining: args.dailyLimit - dayUsed - 1,
      monthlyRemaining: args.monthlyLimit - monthUsed - 1,
    };
  },
});

/**
 * Hand back one unit on BOTH meters after a failed or refused generation.
 *
 * `checkAndIncrementDual` reserves both before the provider is called, so a
 * failure the user did not cause has already spent one of each. Floors at 0
 * and never creates a row, exactly like `refundOne`, and is a compensating
 * action for one specific reservation — call it at most once per failure.
 */
export const refundOneDual = mutation({
  args: { feature: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const userId = identity.subject;

    let refunded = false;
    for (const period of [todayKey(), monthKey()]) {
      const row = await findQuotaRow(ctx, userId, args.feature, period);
      if (!row || row.count <= 0) continue;
      await ctx.db.patch(row._id, { count: row.count - 1 });
      refunded = true;
    }
    return { refunded };
  },
});
```

- [ ] **Step 3: Document the period key in the schema**

In `convex/schema.ts`, replace the `featureQuota` comment block and the `day` field comment:

```ts
  /**
   * Per-user quota counters for metered features.
   *
   * `day` IS A PERIOD KEY, not always a day (ADR-023). Single-meter features
   * (image search) write only 'YYYY-MM-DD' rows. AI generation runs two
   * meters and writes both a 'YYYY-MM-DD' row and a 'YYYY-MM' row; the two
   * shapes cannot collide, so one index serves both.
   *
   * Shared infra — image search uses 'imageSearch'; AI gen uses 'aiImageGenerate'.
   */
  featureQuota: defineTable({
    userId: v.string(),  // clerk user id (identity.subject)
    feature: v.string(), // e.g. 'imageSearch'
    day: v.string(),     // period key: 'YYYY-MM-DD' or 'YYYY-MM', both UTC
    count: v.number(),
  }).index("by_user_and_feature_and_day", ["userId", "feature", "day"]),
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit -p convex/tsconfig.json && npx tsc --noEmit
```

Expected: no output (both pass). If `QueryCtx` / `MutationCtx` are reported as missing exports, the Convex codegen is stale — the running `convex dev` regenerates on save; re-run after it settles.

- [ ] **Step 5: Verify the new functions exist on the deployed backend**

```bash
source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx convex run featureQuota:getRemainingDual '{"feature":"aiImageGenerate","dailyLimit":20,"monthlyLimit":100}' --no-push
```

Expected: `null` — the CLI has no caller identity, so the unauthenticated branch returns null. That null IS the pass: it proves the function deployed and ran. An error naming an unknown function means `convex dev` has not pushed yet.

- [ ] **Step 6: Commit**

```bash
git add lib/ai-image-limits.ts convex/featureQuota.ts convex/schema.ts
git commit -m "feat(quota): dual day+month meters for AI image generation

The month is the budget, the day is a runaway guard (ADR-023). Both are
checked before either is incremented, in one transaction, so a request can
never spend one without the other.

featureQuota.day becomes a period key: 'YYYY-MM-DD' or 'YYYY-MM'. The two
shapes cannot collide, so image search keeps the single-meter functions and
the existing index serves both.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Route generates live, spends both meters, uploads nothing

**Files:**
- Modify: `app/api/ai-generate/imagen/route.ts`

**Interfaces:**
- Consumes: `resolveAiImageLimits()` (Task 1), `api.featureQuota.checkAndIncrementDual`, `api.featureQuota.refundOneDual`
- Produces: `POST /api/ai-generate/imagen` → `200` with raw `image/png` bytes, or `429 { error: "quota_exceeded", meter: "day" | "month", limit }`

- [ ] **Step 1: Swap the limit constant for the shared module**

Delete the whole `const DAILY_LIMIT = (() => { … })();` IIFE (it moves to `lib/ai-image-limits.ts`) and add to the imports:

```ts
import { resolveAiImageLimits } from "@/lib/ai-image-limits";
```

Then inside the `POST` handler, after the style validation, add:

```ts
  const limits = resolveAiImageLimits();
```

- [ ] **Step 2: Delete the cache lookup block**

Remove the entire `// ── Cache lookup (free; doesn't decrement quota) ──` section — from `const hash = hashPromptStyleModel(style, rawPrompt);` through the closing `}` of `if (cached) { … }`. Also delete the `hashPromptStyleModel` function above the route and the now-unused imports `createHash`, `getFile`, and `aiImageCacheHashInput`.

`randomUUID` is still referenced by the upload block at this point; it is deleted along with that block in Step 4.

- [ ] **Step 3: Replace the quota block with the dual meter**

Replace the `// ── Quota check + increment` block with:

```ts
  // ── Quota: both meters, one transaction (ADR-023) ────────────────────────
  // Reserved BEFORE the provider call. Incrementing afterwards would let two
  // concurrent requests both pass the check and exceed the limit. The cost of
  // reserving is that a failure has already been charged — hence the refund on
  // every failure path below.
  let dailyRemaining: number;
  let monthlyRemaining: number;
  try {
    const incr = await convex.mutation(api.featureQuota.checkAndIncrementDual, {
      feature: FEATURE,
      dailyLimit: limits.daily,
      monthlyLimit: limits.monthly,
    });
    dailyRemaining = incr.dailyRemaining;
    monthlyRemaining = incr.monthlyRemaining;
  } catch (err) {
    if (err instanceof Error && err.message.includes("QuotaExceeded")) {
      // Which ceiling bit decides the copy: "back tomorrow" and "back on the
      // 1st" are very different things to be told.
      const meter = err.message.endsWith(":month") ? "month" : "day";
      return NextResponse.json(
        {
          error: "quota_exceeded",
          meter,
          limit: meter === "month" ? limits.monthly : limits.daily,
        },
        { status: 429 }
      );
    }
    throw err;
  }
```

Fire the blocked event in that same branch, immediately before the `return`. This is the event that says whether 100/month is right — if it never fires the allowance is too high; if it fires on `month` for engaged users it is too low:

```ts
      trackServer(userId, "ai_generate_quota_blocked", { meter, tier: "max" });
      await flushAnalytics();
```

- [ ] **Step 4: Refund both meters on failure, and return the bytes without touching R2**

In the `catch` around `generateImage`, change the refund call:

```ts
    try {
      await convex.mutation(api.featureQuota.refundOneDual, { feature: FEATURE });
    } catch (refundErr) {
      console.error("[ai-generate] quota refund failed", refundErr);
    }
```

Then replace the entire `// ── Upload + cache ──` block and the final `return` with:

```ts
  // ── Return ───────────────────────────────────────────────────────────────
  // NO R2 WRITE. The upload existed only to populate `aiImageCache`; with the
  // cache gone (ADR-023) nothing reads the object, and `X-R2-Key` was never
  // read by any caller. The image reaches R2 only if the user adopts it, at
  // which point SymbolEditorModal uploads a resized webp under
  // accounts/<accountId>/images/.
  trackServer(userId, "ai_generate_used", {
    tier: "max",
    style,
    dailyRemaining,
    monthlyRemaining,
  });
  await flushAnalytics();

  const pngAb = pngBuffer.buffer.slice(
    pngBuffer.byteOffset,
    pngBuffer.byteOffset + pngBuffer.byteLength
  ) as ArrayBuffer;
  return new Response(new Blob([pngAb]), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
      "X-Daily-Remaining": String(dailyRemaining),
      "X-Monthly-Remaining": String(monthlyRemaining),
    },
  });
```

Delete the now-unused imports: `uploadBuffer`, `R2_PATHS`, `randomUUID`. **Keep `isConfigured`** — the 503 guard at the top of the route still matters, because adoption immediately afterwards needs R2 and failing early is kinder than generating an image the user cannot save.

- [ ] **Step 5: Update the route's header comment**

Replace the pipeline line in the `POST` doc comment:

```ts
/**
 * POST /api/ai-generate/imagen
 * Body: { prompt: string, style: StyleId }
 *
 * Pipeline: auth → Max-tier check → both quota meters reserved → Gemini image
 * call → PNG bytes returned inline. No cache, no R2 write — see ADR-023.
 * Every call is a live generation, which is what makes re-generating give a
 * different image.
 */
```

- [ ] **Step 6: Typecheck and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors. An "unused import" or "unused variable" complaint means a deletion from Steps 2–4 was missed — fix rather than suppress.

- [ ] **Step 7: Manual check — the actual bug this phase exists to fix**

With the dev server already running (port 3001; do not start another), open a symbol editor → AI Generate as a Max user, type `wolf`, pick 3D Claymation, and press Generate **twice**.

Expected: **two visibly different wolves.** Identical wolves means a cache is still in the path.

- [ ] **Step 8: Commit**

```bash
git add app/api/ai-generate/imagen/route.ts
git commit -m "feat(ai-generate): every generation is live; spend both meters

Removes the aiImageCache lookup/write and the request-path R2 upload. The
upload only ever existed to feed the cache — X-R2-Key was read by nobody —
so with the cache gone the bytes go straight to the client.

Re-generating now returns a different image, which is what gemini-2.5-flash-image
does when nothing intercepts it.

Refusals and errors refund BOTH meters.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Copy

**Files:**
- Modify: `messages/en.json:866-882` (the `symbolEditor` block)

- [ ] **Step 1: Replace the two quota strings and add the new ones**

`messages/en.json` only — never `hi.json` / `es.json`. Replace:

```json
    "aiGenerationsLeft": "{count} generations left today",
```

with:

```json
    "aiGenerationsLeft": "{daily} left today · {monthly} left this month",
    "aiQuotaExceededMonth": "You've used this month's {limit} generations. Your allowance resets on the 1st.",
```

and replace:

```json
    "aiQuotaExceeded": "Daily generation limit reached. Try again tomorrow.",
```

with:

```json
    "aiQuotaExceeded": "You've used today's {limit} generations. More tomorrow — your monthly allowance still has room.",
```

Also update the refusal string, which currently promises something no longer true ("hasn't used up any of your daily generations" — both meters are refunded now):

```json
    "aiGenerationRefused": "The image service wouldn't create this one. Try describing it differently — this attempt hasn't cost you a generation.",
```

- [ ] **Step 2: Verify the JSON parses**

```bash
node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); console.log('valid')"
```

Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add messages/en.json
git commit -m "copy(ai-generate): two-meter quota strings

en.json only — the translation pipeline skips keys already present in a
locale, so a hand-added placeholder would ship forever.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Session reel, resize on arrival, two-meter footer

**Files:**
- Modify: `app/components/app/shared/modals/symbol-editor/AiGenerateTab.tsx`

**Interfaces:**
- Consumes: `AI_IMAGE_DAILY_LIMIT_DEFAULT`, `AI_IMAGE_MONTHLY_LIMIT_DEFAULT` (Task 1), `api.featureQuota.getRemainingDual` (Task 1), the copy keys from Task 3
- Produces: reel state `generations: Blob[]` + `reelIndex: number` that MOS-47 builds its arrows and button states on

- [ ] **Step 1: Replace the local limit constant and the quota query**

Delete `const DAILY_LIMIT = 10;` near the top and import the shared defaults:

```ts
import {
  AI_IMAGE_DAILY_LIMIT_DEFAULT,
  AI_IMAGE_MONTHLY_LIMIT_DEFAULT,
} from "@/lib/ai-image-limits";
```

Replace the `remaining` query with:

```ts
  const quota = useQuery(
    api.featureQuota.getRemainingDual,
    isMax
      ? {
          feature: FEATURE,
          dailyLimit: AI_IMAGE_DAILY_LIMIT_DEFAULT,
          monthlyLimit: AI_IMAGE_MONTHLY_LIMIT_DEFAULT,
        }
      : "skip"
  );
```

- [ ] **Step 2: Replace the single-image state with the reel**

Replace `const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);` and `const [previewUrl, setPreviewUrl] = useState<string | null>(null);` with:

```ts
  // THE SESSION REEL (ADR-023). With no server-side cache, an image that is
  // dropped is gone for good — so everything generated this session stays in
  // memory until the modal closes. Blobs are already resized to the 512px
  // webp on arrival, so ten of them cost ~200KB, not ~9MB.
  const REEL_MAX = 10;
  const [reel, setReel] = useState<{ blob: Blob; url: string }[]>([]);
  const [reelIndex, setReelIndex] = useState(0);
  const current = reel[reelIndex] ?? null;
```

Replace the object-URL cleanup effect with one that revokes the whole reel on unmount:

```ts
  // A ref mirroring the reel, so unmount cleanup can revoke every URL without
  // reading a stale closure and without setting state during unmount.
  const reelRef = useRef<{ blob: Blob; url: string }[]>([]);
  useEffect(() => {
    reelRef.current = reel;
  }, [reel]);

  // Revoke on unmount ONLY — the empty dependency array is deliberate.
  // Revoking on each reel change would kill URLs the reel is still showing.
  useEffect(() => {
    return () => {
      reelRef.current.forEach((e) => URL.revokeObjectURL(e.url));
    };
  }, []);
```

`useRef` joins the React import in this step: `import { useEffect, useRef, useState } from "react";`

- [ ] **Step 3: Resize on arrival and append to the reel**

In `handleGenerate`, replace the success branch (from `const blob = await res.blob();` to the end of `setPreviewUrl(...)`) with:

```ts
      // Resize HERE, not at adoption. The preview is then the exact artefact
      // that gets saved — no surprise on save — and the reel holds ~20KB
      // webps instead of ~880KB PNGs.
      const raw = await res.blob();
      const blob = await toResizedWebp(raw);
      const url = URL.createObjectURL(blob);
      // Computed here rather than inside a setState updater: revoking a URL
      // is a side effect and React 19 double-invokes updaters in StrictMode.
      // Safe against races because `isGenerating` serialises generation.
      const next = [...reel, { blob, url }];
      if (next.length > REEL_MAX) {
        URL.revokeObjectURL(next[0].url);
        next.shift();
      }
      setReel(next);
      setReelIndex(next.length - 1);
```

And replace the two quota error branches with:

```ts
      if (res.status === 429) {
        const body = (await res.json().catch(() => null)) as
          | { meter?: "day" | "month"; limit?: number }
          | null;
        setError(
          body?.meter === "month"
            ? t("aiQuotaExceededMonth", { limit: body.limit ?? AI_IMAGE_MONTHLY_LIMIT_DEFAULT })
            : t("aiQuotaExceeded", { limit: body?.limit ?? AI_IMAGE_DAILY_LIMIT_DEFAULT })
        );
        return;
      }
```

- [ ] **Step 4: Adopt from the reel without resizing again**

Replace the body of `handleAddToSymbol` with:

```ts
  async function handleAddToSymbol() {
    if (!current) return;
    // Already a 512px webp — resized on arrival, so there is nothing to do
    // here but hand it over.
    onImageSelected(current.blob, current.url);
    const trimmedPrompt = prompt.trim();
    patch({
      resolvedImagePath: undefined,
      imageSourceUrl: undefined,
      imageAttribution: undefined,
      imageLicense: undefined,
      imageProvider: undefined,
      imageTitle: undefined,
      ...(trimmedPrompt ? { labelEng: trimmedPrompt, aiPrompt: trimmedPrompt } : {}),
    });
  }
```

Delete the now-unused `toResizedWebp` call site there — the import stays, it is used in Step 3.

- [ ] **Step 5: Discard steps back through the reel**

Replace `handleDiscard` with:

```ts
  // Steps back rather than binning everything: the previous image was paid
  // for and cannot be regenerated identically.
  function handleDiscard() {
    setError(null);
    if (reel.length === 0) return;
    const next = reel.filter((_, i) => i !== reelIndex);
    URL.revokeObjectURL(reel[reelIndex].url);
    setReel(next);
    setReelIndex(Math.max(0, Math.min(reelIndex, next.length - 1)));
  }
```

- [ ] **Step 6: Point the render at the reel**

In the preview block, replace `previewUrl ?` with `current ?` and `src={previewUrl}` with `src={current.url}`. In the actions block, replace `generatedBlob ?` with `current ?`. Replace the footer with:

```ts
      {quota && (
        <div
          className="shrink-0 px-3 py-2 text-theme-xs text-center"
          style={{
            color: "var(--theme-secondary-text)",
            borderTop: "1px solid var(--theme-button-highlight)",
          }}
        >
          {t("aiGenerationsLeft", {
            daily: quota.daily.remaining,
            monthly: quota.monthly.remaining,
          })}
        </div>
      )}
```

- [ ] **Step 7: Typecheck and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 8: Manual checks**

With the dev server already running:

1. Generate twice → two different images, and the footer's daily and monthly counts both drop by one each time.
2. Press Discard → the previous image reappears rather than the pane going empty.
3. Add to Symbol → the saved image matches the preview exactly, and the symbol's label becomes the prompt.
4. Set `AI_IMAGE_MONTHLY_LIMIT=1` in `.env.local`, restart the dev server, generate twice → the second attempt shows the *monthly* message naming the 1st, not the daily one.
5. Restore `.env.local`.

- [ ] **Step 9: Commit**

```bash
git add app/components/app/shared/modals/symbol-editor/AiGenerateTab.tsx
git commit -m "feat(ai-generate): session reel + two-meter footer

Nothing generated is lost mid-session now that there is no cache to retrieve
it from. Resize moved to arrival so the preview is the artefact that gets
saved, and ten reel entries cost ~200KB instead of ~9MB.

Discard steps back through the reel rather than binning a paid-for image.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Instrumentation

**Files:**
- Modify: `lib/analytics.ts:82` (event catalogue)
- Modify: `app/components/app/shared/modals/symbol-editor/AiGenerateTab.tsx`

**Interfaces:**
- Consumes: `track()` from `lib/analytics.ts`, the reel state from Task 4
- Produces: `ai_generate_adopted`, `ai_generate_abandoned` client events

- [ ] **Step 1: Update the event catalogue**

In `lib/analytics.ts`, replace line 82:

```ts
  ai_generate_used:        { tier: SubscriptionTier; cached: boolean };
```

with:

```ts
  // `cached` is gone with the shared cache (ADR-023) — it would be false
  // forever. `attempts` is the number these events exist for: the cache made
  // attempts-per-kept-image unmeasurable, and it is what tells us whether
  // 100/month is the right allowance (FEAT-008 §6).
  ai_generate_used:        {
    tier: SubscriptionTier;
    style: string;
    dailyRemaining: number;
    monthlyRemaining: number;
  };
  ai_generate_adopted:     { style: string; attempts: number };
  ai_generate_abandoned:   { style: string; attempts: number };
  // Server-fired via trackServer (which is untyped) — catalogued here because
  // this file is the catalogue, same as ai_generate_used.
  ai_generate_quota_blocked: { meter: "day" | "month"; tier: SubscriptionTier };
```

- [ ] **Step 2: Fire adoption and abandonment from the tab**

Add the import:

```ts
import { track } from "@/lib/analytics";
```

In `handleAddToSymbol`, immediately after `onImageSelected(current.blob, current.url);`:

```ts
    // Never the prompt — it is user content and, in an AAC app, is frequently
    // about a specific child. Style is a fixed enum and safe.
    track("ai_generate_adopted", { style, attempts: reel.length });
```

Add an unmount effect that reports abandonment. It must read the live values, not a stale closure:

```ts
  // Wasted spend: the tab closed having kept nothing. Reuses `reelRef` from
  // Task 4 — an unmount cleanup would otherwise read the first render's
  // values. `styleRef` exists for the same reason.
  const adoptedRef = useRef(false);
  const styleRef = useRef(style);
  useEffect(() => {
    styleRef.current = style;
  }, [style]);
  useEffect(() => {
    return () => {
      if (!adoptedRef.current && reelRef.current.length > 0) {
        track("ai_generate_abandoned", {
          style: styleRef.current,
          attempts: reelRef.current.length,
        });
      }
    };
  }, []);
```

Set `adoptedRef.current = true;` in `handleAddToSymbol` beside the `track` call. `useRef` is already imported by Task 4.

- [ ] **Step 3: Typecheck and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors. A type error on `track("ai_generate_adopted", …)` means the EventMap edit in Step 1 was not saved.

- [ ] **Step 4: Manual check**

In the browser console with `NEXT_PUBLIC_POSTHOG_KEY` set, generate twice and adopt → one `ai_generate_adopted` with `attempts: 2`. Generate once and close the modal → one `ai_generate_abandoned` with `attempts: 1`. Confirm no event payload contains the prompt text.

- [ ] **Step 5: Commit**

```bash
git add lib/analytics.ts app/components/app/shared/modals/symbol-editor/AiGenerateTab.tsx
git commit -m "feat(analytics): measure attempts-per-kept-image

The cache made this unmeasurable — identical prompts returned identical
images, so nobody could re-roll. These events are what replace the guess
behind 100/month.

No prompt text in any payload.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Delete the AI cache surface

**Files:**
- Modify: `convex/schema.ts:1355-1372` (remove `aiImageCache`)
- Modify: `convex/imageCache.ts` (remove `lookupAi`, `writeAi`, `recordAiHit`, the `aiImage` branch of `listCacheRowsForSweep`)
- Modify: `convex/migrations.ts` (remove `rehashAiImageCache` and its import)
- Modify: `lib/cache-identity.ts` (remove `AI_IMAGE_MODEL` + `aiImageCacheHashInput`; rewrite the doc comment for one cache)
- Modify: `lib/ai-style-prompts.ts` (gains `AI_IMAGE_MODEL`)
- Modify: `app/api/ai-generate/imagen/route.ts` (import `AI_IMAGE_MODEL` from its new home)
- Modify: `scripts/sweep-cache-orphans.mjs` (search-cache census only)
- Modify: `convex/lib/imageCreditRefs.ts:44-45` (comment)

**Interfaces:**
- Produces: `AI_IMAGE_MODEL` exported from `lib/ai-style-prompts.ts` instead of `lib/cache-identity.ts`

- [ ] **Step 1: Back up the deployment (owner action, before anything else)**

```bash
source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx convex export --path backups/2026-08-31-pre-aiimagecache-removal.zip
```

Expected: a zip in `backups/` (gitignored). Do not proceed without it — Step 3 destroys rows.

- [ ] **Step 2: Move `AI_IMAGE_MODEL` to `lib/ai-style-prompts.ts`**

Add to the top of `lib/ai-style-prompts.ts`:

```ts
/**
 * The image generator. Lives here, beside the templates, because the two are
 * verified together: the four style templates below are known-good against
 * THIS model and no other (MOS-40). Changing the model means re-verifying
 * every template and regenerating the style thumbnails.
 *
 * Google retired the Imagen publisher models from Vertex (confirmed 2026-08).
 * Image generation lives in the Gemini image family.
 *
 * Note the request/response shape in `app/api/ai-generate/imagen/route.ts` is
 * Gemini's `:generateContent` contract and moves too if a future model changes it.
 *
 * It used to live in `lib/cache-identity.ts` because it was also the AI
 * cache's identity. ADR-023 deleted that cache; only the model remains.
 */
export const AI_IMAGE_MODEL = "gemini-2.5-flash-image";
```

Update the import in `app/api/ai-generate/imagen/route.ts` — `AI_IMAGE_MODEL` now comes from `@/lib/ai-style-prompts` alongside `STYLE_PRESETS`, and the `@/lib/cache-identity` import goes entirely.

- [ ] **Step 3: Clear the table (owner action, Convex dashboard)**

Convex dashboard → `aiImageCache` → Clear table (48 rows). This must happen *before* the schema edit in Step 4: a table with documents and no schema definition fails validation on push.

**Do not delete any R2 objects.** The `ai-cache/` PNGs stay — the 2026-08-24 decision to keep the imagery stands, and legacy `profileSymbols` rows may still reference those keys.

- [ ] **Step 4: Delete the table and its functions**

In `convex/schema.ts`, delete the entire `aiImageCache: defineTable({ … }).index("by_hash", ["hash"]),` block including its doc comment.

In `convex/imageCache.ts`: delete `lookupAi`, `writeAi`, `recordAiHit`, and the whole `// ─── AI image cache` section header. In `listCacheRowsForSweep`, remove the `aiRows` query, the `aiImage` array from the return, and `aiImageModel` from `identity`; update its doc comment to describe one cache. Fix the imports — `AI_IMAGE_MODEL` and `aiImageCacheHashInput` are no longer used there.

In `convex/migrations.ts`: delete `rehashAiImageCache` and its doc comment, and the line `import { AI_IMAGE_MODEL, aiImageCacheHashInput } from "../lib/cache-identity";`.

In `lib/cache-identity.ts`: delete `AI_IMAGE_MODEL` and `aiImageCacheHashInput`, and rewrite the file's doc comment so it describes the image-**search** cache only — keep the "row records the identity of the code that produced it" reasoning and the bump procedure, drop the two-cache table and the AI column.

- [ ] **Step 5: Update the sweep script and the credit-refs comment**

In `scripts/sweep-cache-orphans.mjs`: remove the `aiImage` classification, the `ai-cache/` KEEP list, and the AI lines from the summary. Keep the `imageSearchCache` census and the "full-size PNGs left by the Phase 29 backfill" probe. Update the header comment — the AI cache it describes no longer exists.

In `convex/lib/imageCreditRefs.ts`, replace the `aiImageCache` bullet:

```
 *   - AI-generated images are recorded like any other: the adopted copy lives
 *     under `accounts/…` and is credited by R2 key. There is no shared AI
 *     cache to exclude any more (ADR-023).
```

- [ ] **Step 6: Typecheck, lint, build**

```bash
npx tsc --noEmit -p convex/tsconfig.json && npx tsc --noEmit && npm run lint && npm run build
```

Expected: all pass. Any reference to `aiImageCache`, `lookupAi`, `writeAi`, `recordAiHit` or `aiImageCacheHashInput` surfacing here is a missed deletion.

- [ ] **Step 7: Prove nothing references the cache**

```bash
grep -rn "aiImageCache\|lookupAi\|writeAi\|recordAiHit\|aiImageCacheHashInput" --include="*.ts" --include="*.tsx" --include="*.mjs" app lib convex scripts | grep -v _generated
```

Expected: **no output.** Matches inside `docs/` are fine and expected — the ADR and the archived plans describe the thing that was removed.

- [ ] **Step 8: Run the sweep to confirm it still works**

```bash
source ~/.nvm/nvm.sh && nvm use 20.17.0 && node --env-file=.env.local scripts/sweep-cache-orphans.mjs
```

Expected: an `imageSearchCache` census and the Phase 29 PNG probe, no AI section, no crash.

- [ ] **Step 9: Commit**

```bash
git add convex/schema.ts convex/imageCache.ts convex/migrations.ts lib/cache-identity.ts lib/ai-style-prompts.ts app/api/ai-generate/imagen/route.ts scripts/sweep-cache-orphans.mjs convex/lib/imageCreditRefs.ts
git commit -m "refactor(ai-generate): delete the shared AI image cache

Removes aiImageCache, its three functions, the MOS-46 re-key migration and
the AI half of the cache-identity guard. AI_IMAGE_MODEL moves to
ai-style-prompts.ts, beside the templates it was verified against.

The census that decided this: 48 rows, 22 hits, and the most-hit row was one
person pressing Generate four times wanting a different wolf. See ADR-023.

R2 ai-cache/ objects are deliberately kept.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Close out

**Files:**
- Modify: `docs/4-builds/features/FEAT-008-ai-image-generation.md` (status line)
- Move: this plan → `docs/4-builds/plans/_done/`

- [ ] **Step 1: Full-app regression pass**

With the dev server running, as a Max user:

1. AI Generate: generate, re-generate, discard back, adopt. Symbol saves with the generated image.
2. **Image search still works** — it shares `featureQuota`, and its single-meter functions must be untouched. Search, pick an image, save. Its own quota footer still counts down.
3. Delete a symbol carrying an AI image → no console errors. (The stranded R2 object is MOS-50, not this phase.)
4. Reload the board → the AI image renders from `accounts/…`.

- [ ] **Step 2: Update the FEAT status line**

```markdown
**Status:** Shipped — uncached generation + dual meters (MOS-48) · tab UI pending (MOS-47)
```

- [ ] **Step 3: Retire the plan and commit**

```bash
git mv docs/4-builds/plans/phase-34-uncached-ai-generation-plan.md docs/4-builds/plans/_done/
git add docs/4-builds/features/FEAT-008-ai-image-generation.md
git commit -m "docs(ai-generate): retire phase-34 plan, mark FEAT-008 shipped

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Hand back to Linear**

Close MOS-48. MOS-47 is now unblocked — its Part 2 (always-present Discard) has something to discard to, and its Part 3 (prompt made visible) is untouched by this work.

---

## Notes for whoever executes this

- **The daily cap moved from 10 to 20 and a monthly ceiling of 100 appeared.** Both are deliberate (ADR-023): the month is the budget, the day is a runaway guard, and once the month bounds spend the day is free to be generous.
- **Do not reintroduce a cache "for speed".** It was removed on evidence, not taste. Re-read ADR-023's census before proposing one.
- **Do not delete `ai-cache/` R2 objects** at any point in this plan.
- If a step's code does not match what is on disk, the file has moved on since 2026-08-31 — stop and re-read the file rather than forcing the patch.
