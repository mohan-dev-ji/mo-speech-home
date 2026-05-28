import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { requireCallerIsAdmin } from "./lib/account";
import { LANGUAGE_MODULES } from "./data/languages/_index";
import { internal } from "./_generated/api";

/**
 * Phase 8.2 translation job state — the durable layer that makes the
 * symbols-translation pipeline resumable, observable, and admin-controllable.
 *
 * Two surfaces:
 *
 *   1. **Admin actions** — `startSymbolTranslation`, `pauseJob`,
 *      `resumeJob`, `cancelJob`. All Clerk-admin-gated.
 *
 *   2. **Live progress query** — `getJob` (subscribed by the admin row in
 *      `LanguagesAdminTable`). Returns the row + a few derived UI fields.
 *
 * The actual translation work runs in `convex/translationActions.ts`
 * (built next) — `startSymbolTranslation` here is just the trigger that
 * inserts the job row and schedules the first action invocation.
 *
 * **Cost estimate** (`estimateSymbolTranslation`) is a read-only query
 * powering the dry-run modal. Counts only symbols that genuinely need
 * translation (the diff against existing `words.<code>` values) so re-runs
 * for partial progress estimate honestly.
 */

const KIND_VALIDATOR = v.union(
  v.literal("symbols-words"),
  v.literal("library-packs")
);

const STATUS_VALIDATOR = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("paused"),
  v.literal("completed"),
  v.literal("failed")
);

// ─── Internal helper — shared row lookup ──────────────────────────────────

async function findJob(
  ctx: QueryCtx,
  slug: string,
  kind: "symbols-words" | "library-packs"
): Promise<Doc<"translationJobs"> | null> {
  return await ctx.db
    .query("translationJobs")
    .withIndex("by_slug_and_kind", (q) => q.eq("slug", slug).eq("kind", kind))
    .unique();
}

// ─── Cost / progress estimation ───────────────────────────────────────────

/**
 * Token cost model for the symbols pipeline. Keep these constants in sync
 * with the actual prompt + responseSchema sizes when those land in
 * `translationActions.ts`. The estimate is approximate by design —
 * Gemini's structured-output mode is fairly deterministic on token count
 * for a given key set, so ±10% is realistic.
 *
 * Inputs scale with batch size (system prompt is per-call, not per-symbol).
 * Output scales with batch + script family — non-Latin generates richer
 * synonyms (native + Latin transliterations).
 */
// MUST match `BATCH_SIZE` in convex/translationActions.ts — drives the
// estimated-batches calculation. Dropped from 100 to 50 after first
// Spanish run tripped Gemini's 8k output-token limit; halving the batch
// keeps each call well inside the API budget at the cost of doubling
// the API-call count (~$0.20 more on a full 52k run).
const BATCH_SIZE = 50; // symbols per Gemini call
const INPUT_TOKENS_PER_BATCH = 1500;
const OUTPUT_TOKENS_PER_SYMBOL_LATIN = 12;
const OUTPUT_TOKENS_PER_SYMBOL_NON_LATIN = 22;

// Gemini 2.5 Flash pricing — keep in sync with translate-ui-strings route
// header. EU +30% is applied at the bill level, not here.
const PRICE_PER_M_INPUT_USD = 0.30;
const PRICE_PER_M_OUTPUT_USD = 2.50;

type Estimate = {
  totalSymbols: number;       // total in DB
  alreadyTranslated: number;  // skip count
  toTranslate: number;        // estimate target
  estimatedBatches: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number;
  estimatedSeconds: number;
};

/**
 * Internal page-counter query — counts symbols in a single paginate call,
 * tallying how many already have a `words[slug]` entry. Driven by the
 * `estimateSymbolTranslation` action below, which calls this repeatedly
 * with the cursor until the table is exhausted.
 *
 * **Why an internal query + action loop instead of a single query?**
 * Convex caps any query/mutation handler to ONE `paginate()` call. A
 * naïve "scan the whole table inside one query" implementation hits that
 * limit immediately. Actions can call multiple queries, so we loop here.
 */
export const estimateSymbolTranslationPage = internalQuery({
  args: {
    slug: v.string(),
    cursor: v.union(v.string(), v.null()),
    pageSize: v.number(),
  },
  handler: async (ctx, { slug, cursor, pageSize }) => {
    const page = await ctx.db
      .query("symbols")
      .order("asc")
      .paginate({ numItems: pageSize, cursor });

    let alreadyTranslated = 0;
    for (const sym of page.page) {
      const words = sym.words as Record<string, string>;
      if (typeof words[slug] === "string" && words[slug].length > 0) {
        alreadyTranslated++;
      }
    }
    return {
      pageCount: page.page.length,
      alreadyTranslated,
      nextCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

/**
 * Dry-run estimate — counts every symbol in the DB + how many still need a
 * `words.<slug>` entry. Action (not query) because Convex caps queries to
 * one paginate call; loops the internal page query above and accumulates.
 *
 * Heavy on reads but rare — admin only hits this when opening the
 * "Translate symbols" confirm modal. ~15 page queries for a 58k-row table
 * at 4000 per page; total runtime ~2-5 s.
 *
 * Admin-gated. Cleanly separated from `estimateSymbolTranslationPage`
 * (internal, unauthed — only callable from this action) so the admin
 * check lives at the action boundary, not on every page query.
 */
export const estimateSymbolTranslation = action({
  args: { slug: v.string() },
  handler: async (ctx, { slug }): Promise<Estimate> => {
    // Admin gate via a small dedicated internal query — actions don't get
    // QueryCtx so we can't call `requireCallerIsAdmin` directly here.
    const isAdmin = await ctx.runQuery(
      internal.translationJobs.checkCallerIsAdmin,
      {},
    );
    if (!isAdmin) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Admin only.",
      });
    }

    const mod = LANGUAGE_MODULES.find((m) => m.code === slug);
    if (!mod) {
      throw new ConvexError({
        code: "LANGUAGE_NOT_FOUND",
        message: `No language module for code "${slug}".`,
      });
    }
    if (slug === "en") {
      throw new ConvexError({
        code: "SOURCE_LANGUAGE",
        message: "Cannot translate into the source language (en).",
      });
    }

    const PAGE_SIZE = 4000;
    let totalSymbols = 0;
    let alreadyTranslated = 0;
    let cursor: string | null = null;
    let safetyPages = 0;
    while (true) {
      safetyPages++;
      if (safetyPages > 50) {
        throw new ConvexError({
          code: "SCAN_OVERRUN",
          message:
            "Estimate scan exceeded 50 pages — table is bigger than expected.",
        });
      }
      // Type annotation required because the action and the internal query
      // it calls live in the same file — Convex's generated `internal.*`
      // types can't resolve before TS resolves this action's return type,
      // creating a circular inference. Annotate to break the cycle.
      const page: {
        pageCount: number;
        alreadyTranslated: number;
        nextCursor: string;
        isDone: boolean;
      } = await ctx.runQuery(
        internal.translationJobs.estimateSymbolTranslationPage,
        { slug, cursor, pageSize: PAGE_SIZE },
      );
      totalSymbols += page.pageCount;
      alreadyTranslated += page.alreadyTranslated;
      if (page.isDone) break;
      cursor = page.nextCursor;
    }

    const toTranslate = totalSymbols - alreadyTranslated;
    const estimatedBatches = Math.ceil(toTranslate / BATCH_SIZE);
    const perSymbolOutput =
      (mod.scriptFamily ?? "latin") === "non-latin"
        ? OUTPUT_TOKENS_PER_SYMBOL_NON_LATIN
        : OUTPUT_TOKENS_PER_SYMBOL_LATIN;
    const estimatedInputTokens = estimatedBatches * INPUT_TOKENS_PER_BATCH;
    const estimatedOutputTokens = toTranslate * perSymbolOutput;
    const estimatedCostUsd =
      (estimatedInputTokens / 1_000_000) * PRICE_PER_M_INPUT_USD +
      (estimatedOutputTokens / 1_000_000) * PRICE_PER_M_OUTPUT_USD;
    // ~3s per batch end-to-end (Gemini latency dominates).
    const estimatedSeconds = estimatedBatches * 3;

    return {
      totalSymbols,
      alreadyTranslated,
      toTranslate,
      estimatedBatches,
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedCostUsd,
      estimatedSeconds,
    };
  },
});

/**
 * Internal admin-check helper called by the `estimateSymbolTranslation`
 * action. Returns `true` if the caller is an admin, `false` otherwise.
 *
 * Wraps `requireCallerIsAdmin` in a try/catch so the action can give a
 * clean error rather than the bare Convex auth exception bubbling up.
 */
export const checkCallerIsAdmin = internalQuery({
  args: {},
  handler: async (ctx): Promise<boolean> => {
    try {
      await requireCallerIsAdmin(ctx);
      return true;
    } catch {
      return false;
    }
  },
});

// ─── Read: subscribed by admin progress bar ───────────────────────────────

/**
 * Returns the current job row for (slug, kind) — `null` if none exists.
 * The admin table subscribes to this for each row with a running job.
 *
 * Public (no admin guard) so the same query can drive both the table and
 * a future audit / public-facing status page. Job rows contain no
 * sensitive data — only counts, timestamps, and error messages.
 */
export const getJob = query({
  args: {
    slug: v.string(),
    kind: KIND_VALIDATOR,
  },
  handler: async (ctx, { slug, kind }) => {
    return await findJob(ctx, slug, kind);
  },
});

/**
 * List every translation job — used by the admin overview page (future).
 * Sorted by most-recently-updated first. Capped at 100 rows.
 */
export const listJobs = query({
  args: {},
  handler: async (ctx) => {
    await requireCallerIsAdmin(ctx);
    return await ctx.db.query("translationJobs").order("desc").take(100);
  },
});

// ─── Trigger: admin actions ───────────────────────────────────────────────

/**
 * Insert the job row and schedule the first action invocation. Idempotent
 * for re-runs — re-uses the existing row, resets it to `running` state.
 *
 * Returns `{ jobId, scheduled }` so the admin UI can subscribe.
 *
 * The actual translation logic lives in `translationActions.ts`. We
 * schedule it via `internal.translationActions.translateSymbolsBatch` —
 * that action will self-schedule until done.
 */
export const startSymbolTranslation = mutation({
  args: {
    slug: v.string(),
    // Allow the admin UI to pass the estimated total so the row's
    // `totalCount` reflects the dry-run user saw (rather than re-scanning
    // here, which would cost an extra full-table pass).
    totalCount: v.number(),
    estimatedTokens: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { clerkUserId } = await requireCallerIsAdmin(ctx);

    // Validate the language is in the registry.
    const mod = LANGUAGE_MODULES.find((m) => m.code === args.slug);
    if (!mod) {
      throw new ConvexError({
        code: "LANGUAGE_NOT_FOUND",
        message: `No language module for code "${args.slug}".`,
      });
    }
    if (args.slug === "en") {
      throw new ConvexError({
        code: "SOURCE_LANGUAGE",
        message: "Cannot translate into the source language (en).",
      });
    }

    const now = Date.now();
    const existing = await findJob(ctx, args.slug, "symbols-words");

    let jobId: Id<"translationJobs">;
    if (existing) {
      // Reset / restart the existing row. Any prior cursor is dropped so
      // the next run starts from the beginning of the still-untranslated
      // symbols — the action's per-batch skip-if-translated check makes
      // this safe (translated rows are no-ops).
      await ctx.db.patch(existing._id, {
        status: "running",
        cursor: null,
        totalCount: args.totalCount,
        processedCount: 0,
        actualInputTokens: undefined,
        actualOutputTokens: undefined,
        estimatedTokens: args.estimatedTokens,
        startedAt: now,
        completedAt: undefined,
        lastError: undefined,
        updatedAt: now,
      });
      jobId = existing._id;
    } else {
      jobId = await ctx.db.insert("translationJobs", {
        slug: args.slug,
        kind: "symbols-words",
        status: "running",
        cursor: null,
        totalCount: args.totalCount,
        processedCount: 0,
        estimatedTokens: args.estimatedTokens,
        startedAt: now,
        createdBy: clerkUserId,
        updatedAt: now,
      });
    }

    // Schedule the first action — fires as soon as Convex can pick it up.
    // The action self-schedules subsequent invocations until done.
    await ctx.scheduler.runAfter(
      0,
      internal.translationActions.translateSymbolsBatch,
      { jobId }
    );

    return { jobId, scheduled: true };
  },
});

/**
 * Pause a running job — the action checks status before each batch and
 * stops scheduling itself when paused. Cursor is preserved so resume
 * picks up exactly where pause caught it.
 */
export const pauseJob = mutation({
  args: { jobId: v.id("translationJobs") },
  handler: async (ctx, { jobId }) => {
    await requireCallerIsAdmin(ctx);
    const job = await ctx.db.get(jobId);
    if (!job) throw new ConvexError({ code: "NOT_FOUND" });
    if (job.status !== "running") return { ok: true, noop: true };
    await ctx.db.patch(jobId, {
      status: "paused",
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

/**
 * Resume a paused or failed job — clears any error, flips to running,
 * schedules a fresh action invocation. Cursor is left untouched so we
 * pick up where we stopped.
 */
export const resumeJob = mutation({
  args: { jobId: v.id("translationJobs") },
  handler: async (ctx, { jobId }) => {
    await requireCallerIsAdmin(ctx);
    const job = await ctx.db.get(jobId);
    if (!job) throw new ConvexError({ code: "NOT_FOUND" });
    if (job.status === "running" || job.status === "completed") {
      return { ok: true, noop: true };
    }
    await ctx.db.patch(jobId, {
      status: "running",
      lastError: undefined,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(
      0,
      internal.translationActions.translateSymbolsBatch,
      { jobId }
    );
    return { ok: true };
  },
});

/**
 * Cancel a job — sets it to `failed` with a "cancelled by admin" message
 * and freezes the cursor. Cleanup of the row is the admin's call (delete
 * via the dashboard if you want to start fresh).
 */
export const cancelJob = mutation({
  args: { jobId: v.id("translationJobs") },
  handler: async (ctx, { jobId }) => {
    await requireCallerIsAdmin(ctx);
    const job = await ctx.db.get(jobId);
    if (!job) throw new ConvexError({ code: "NOT_FOUND" });
    await ctx.db.patch(jobId, {
      status: "failed",
      lastError: "Cancelled by admin.",
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

// ─── Internal mutations — called from the action ──────────────────────────

/**
 * Patch the job row after a batch completes. Called from the action via
 * `ctx.runMutation`. Internal so the action is the only caller — admins
 * use the gated mutations above.
 *
 * `markCompleted` flips status to `completed` and stamps `completedAt`.
 * Otherwise the row stays `running` (or `paused` if the admin paused
 * mid-batch, which the action notices on the next check).
 */
export const recordBatchProgress = internalMutation({
  args: {
    jobId: v.id("translationJobs"),
    processedDelta: v.number(),
    inputTokensDelta: v.number(),
    outputTokensDelta: v.number(),
    nextCursor: v.union(v.string(), v.null()),
    markCompleted: v.boolean(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job vanished mid-batch");
    const now = Date.now();
    await ctx.db.patch(args.jobId, {
      processedCount: job.processedCount + args.processedDelta,
      actualInputTokens:
        (job.actualInputTokens ?? 0) + args.inputTokensDelta,
      actualOutputTokens:
        (job.actualOutputTokens ?? 0) + args.outputTokensDelta,
      cursor: args.nextCursor,
      ...(args.markCompleted
        ? { status: "completed" as const, completedAt: now }
        : {}),
      updatedAt: now,
    });
  },
});

/**
 * Flag the job as failed with the error message that broke the action.
 * Cursor is preserved so the admin can hit Resume after fixing the cause.
 */
export const recordJobFailure = internalMutation({
  args: {
    jobId: v.id("translationJobs"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.jobId, {
      status: "failed",
      lastError: args.error.slice(0, 1000), // cap the size
      completedAt: now,
      updatedAt: now,
    });
  },
});

// ─── Action helpers — called by `translationActions.translateSymbolsBatch` ──
//
// These three are split out from `translationActions.ts` because that file
// uses `"use node"` and `internalQuery` / `internalMutation` can't live
// alongside `"use node"` directives in Convex. They're semantically
// "action plumbing" — not part of the admin-facing API above.

/**
 * Read a job row by id. Used by the action to (a) load initial state
 * and (b) re-check status before every Gemini call so admin pauses /
 * cancels stop the loop within ~5 s.
 */
export const getJobInternal = internalQuery({
  args: { jobId: v.id("translationJobs") },
  handler: async (ctx, { jobId }): Promise<Doc<"translationJobs"> | null> => {
    return await ctx.db.get(jobId);
  },
});

/**
 * Concurrency guard query — returns the first `running` job that ISN'T
 * `myJobId`, or `null` if no other job is running. The action pauses
 * itself when this returns non-null so the queued job wins cleanly
 * (rather than failing one or running two in parallel and blowing the
 * Convex bandwidth budget — both would be bad).
 */
export const findOtherRunningJob = internalQuery({
  args: { jobId: v.id("translationJobs") },
  handler: async (ctx, { jobId }) => {
    const running = await ctx.db
      .query("translationJobs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .collect();
    return running.find((r) => r._id !== jobId) ?? null;
  },
});

/**
 * Internal pause variant — called by the action's concurrency guard.
 * Differs from the admin-facing `pauseJob` mutation in two ways:
 *   - no admin auth check (this is called by the action, not by a user)
 *   - takes a `reason` string written to `lastError` so the admin sees
 *     WHY the job paused (it shows up in the row's error display).
 */
export const markJobPaused = internalMutation({
  args: {
    jobId: v.id("translationJobs"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;
    await ctx.db.patch(args.jobId, {
      status: "paused",
      lastError: args.reason.slice(0, 1000),
      updatedAt: Date.now(),
    });
  },
});
