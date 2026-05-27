"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  buildVertexClient,
  buildSymbolTranslationSchema,
  callJsonResponse,
  isRetryableVertexError,
  sleep,
  type VertexClient,
} from "../lib/llm/vertex";
import { LANGUAGE_MODULES } from "./data/languages/_index";

/**
 * Phase 8.2 — symbol translation pipeline.
 *
 * `translateSymbolsBatch` is the self-scheduling action that runs the
 * actual Gemini calls against the symbols table. It's invoked the first
 * time by `translationJobs.startSymbolTranslation`, then re-invokes
 * itself via `ctx.scheduler.runAfter(0, ...)` every ~4 minutes until the
 * job completes.
 *
 * **Invariants** (see also the plan at
 * `~/.claude/plans/thanks-forgot-to-ask-delightful-volcano.md`):
 *
 *   - One language at a time — concurrency guard at action entry pauses
 *     self if another job is `running`. The queued job wins cleanly.
 *   - Time-based break (4 min) — well under Convex's 10-min action
 *     ceiling. Self-schedules the next invocation; no work lost.
 *   - Idempotent — re-runs filter out rows where `words[slug]` is already
 *     populated. Safe to interrupt + resume from any cursor.
 *   - Status re-check before every Gemini call — admin pause stops the
 *     loop within ~5 s.
 *   - Rate-limit backoff — Vertex 429/500/503 → exp backoff (1s, 4s, 16s)
 *     up to 3 attempts, then fails the job with the captured error.
 *   - Per-batch try/catch — failures attach the symbol IDs in the failing
 *     batch to `lastError` so the admin sees exactly what broke.
 *
 * **Token usage** is captured from `usageMetadata` on every successful
 * Gemini response and accumulated on the job row — Phase 8.6 review
 * tooling can compare against the dry-run estimate.
 */

// ── Tunables (kept inline; tweak after observation) ──────────────────────

const BATCH_SIZE = 100;            // symbols per Gemini call
const PAGE_SIZE = 200;             // symbols per Convex paginate
const TIME_BUDGET_MS = 4 * 60_000; // 4 min — leave 6 min headroom under 10 min ceiling
const MAX_RETRIES = 3;
const BACKOFF_MS = [1_000, 4_000, 16_000]; // 1s, 4s, 16s

// ── Prompts ──────────────────────────────────────────────────────────────

const LATIN_SYSTEM_PROMPT = `You are translating SymbolStix AAC pictogram labels for Mo Speech, an app for non-verbal children and their families.

Each input is a short English word or phrase shown under a small pictogram (e.g. "dog", "happy", "go to bed"). Translate accurately, naturally, and at a register appropriate for a child or their caregiver.

For EACH input:
- "word" — the single best translation in the target language.
- "synonyms" — 2 to 4 short alternates a user might search for (verb/noun forms, regional variants, common shortenings).

Rules:
- Leave proper nouns and brand names unchanged ("Mo Speech", "Hello Kitty", "SymbolStix").
- Preserve the meaning, not the surface form — translate "go to bed" as a natural phrase, not word-by-word.
- Synonyms should be common everyday alternates, not rare formal forms.
- Return JSON exactly matching the schema. Keep input IDs in the same order.`;

const NON_LATIN_SYSTEM_PROMPT = `You are translating SymbolStix AAC pictogram labels for Mo Speech, an app for non-verbal children and their families.

Each input is a short English word or phrase shown under a small pictogram (e.g. "dog", "happy", "go to bed"). Translate accurately, naturally, and at a register appropriate for a child or their caregiver.

For EACH input:
- "word" — the single best translation in the target language's NATIVE SCRIPT (e.g. Devanagari for Hindi, Hangul for Korean, Gurmukhi for Punjabi). Do NOT romanise.
- "synonyms" — 4 to 6 alternates total, mixing native-script variants AND Latin-script transliterations following standard romanisation conventions. Example for Hindi "dog" / "कुत्ता": ["कुत्ता","कुत्ते","kutta","dog","puppy"]. Transliterations let users with English keyboards still search for the symbol.

Rules:
- Leave proper nouns and brand names unchanged ("Mo Speech", "Hello Kitty", "SymbolStix").
- Preserve the meaning, not the surface form — translate "go to bed" as a natural phrase, not word-by-word.
- Include at least 2 Latin transliterations in the synonyms array.
- Return JSON exactly matching the schema. Keep input IDs in the same order.`;

// ── Action handler ───────────────────────────────────────────────────────

export const translateSymbolsBatch = internalAction({
  args: { jobId: v.id("translationJobs") },
  handler: async (ctx, { jobId }) => {
    const actionStartedAt = Date.now();

    // ─── 1. Read job state ────────────────────────────────────────────────
    const job = await ctx.runQuery(internal.translationJobs.getJobInternal, {
      jobId,
    });
    if (!job) {
      // Row vanished — nothing to do.
      return;
    }
    if (job.status !== "running") {
      // Admin paused / cancelled / completed before we got here. Silent exit.
      return;
    }

    // ─── 2. Concurrency guard ─────────────────────────────────────────────
    // If another job is `running`, pause ourselves and bail. The other job
    // continues; admin can resume us after it finishes.
    const otherRunning = await ctx.runQuery(
      internal.translationJobs.findOtherRunningJob,
      { jobId },
    );
    if (otherRunning) {
      await ctx.runMutation(internal.translationJobs.markJobPaused, {
        jobId,
        reason: `Paused: another job is running (slug=${otherRunning.slug}). Resume when that one completes.`,
      });
      return;
    }

    // ─── 3. Look up the language module ───────────────────────────────────
    const langMod = LANGUAGE_MODULES.find((m) => m.code === job.slug);
    if (!langMod) {
      await ctx.runMutation(internal.translationJobs.recordJobFailure, {
        jobId,
        error: `Language module not found for code "${job.slug}".`,
      });
      return;
    }
    const isNonLatin = (langMod.scriptFamily ?? "latin") === "non-latin";
    const systemPrompt = isNonLatin
      ? NON_LATIN_SYSTEM_PROMPT
      : LATIN_SYSTEM_PROMPT;

    // ─── 4. Build the Vertex client (once per invocation) ────────────────
    let vertex: VertexClient;
    try {
      vertex = await buildVertexClient();
    } catch (e) {
      await ctx.runMutation(internal.translationJobs.recordJobFailure, {
        jobId,
        error: `Failed to build Vertex client: ${(e as Error).message}`,
      });
      return;
    }

    // ─── 5. Main loop — paginate, translate, write back ─────────────────
    let cursor: string | null = job.cursor ?? null;
    let totalProcessedThisInvocation = 0;

    while (true) {
      // Time budget check — break before the next page if we're past 4 min.
      if (Date.now() - actionStartedAt > TIME_BUDGET_MS) {
        await ctx.scheduler.runAfter(
          0,
          internal.translationActions.translateSymbolsBatch,
          { jobId },
        );
        return;
      }

      // Pre-batch status re-check — admin pause/cancel responsiveness.
      const liveJob = await ctx.runQuery(
        internal.translationJobs.getJobInternal,
        { jobId },
      );
      if (!liveJob || liveJob.status !== "running") return;

      // Fetch one page of candidates — server-filters to rows missing the
      // target language so we don't waste API spend on already-done work.
      const page = await ctx.runMutation(
        internal.symbols.fetchUntranslatedPage,
        { slug: job.slug, cursor, pageSize: PAGE_SIZE },
      );

      // Even if every row in the page is already translated, we still
      // advance the cursor — otherwise we'd loop forever on the same page.
      if (page.page.length === 0) {
        if (page.isDone) {
          // Whole table scanned, no work remaining → mark complete.
          await ctx.runMutation(internal.translationJobs.recordBatchProgress, {
            jobId,
            processedDelta: 0,
            inputTokensDelta: 0,
            outputTokensDelta: 0,
            nextCursor: null,
            markCompleted: true,
          });
          return;
        }
        cursor = page.nextCursor;
        continue;
      }

      // Slice the candidates into BATCH_SIZE chunks. PAGE_SIZE = 2 × BATCH_SIZE
      // so we typically do 2 Gemini calls per Convex page.
      for (let i = 0; i < page.page.length; i += BATCH_SIZE) {
        // Pre-batch status re-check (again, between batches in the same page).
        const checkJob = await ctx.runQuery(
          internal.translationJobs.getJobInternal,
          { jobId },
        );
        if (!checkJob || checkJob.status !== "running") return;

        const slice = page.page.slice(i, i + BATCH_SIZE);
        // Build the input map: { symbolId: englishWord }.
        const inputMap: Record<string, string> = {};
        for (const sym of slice) {
          // Skip rows with no English word — can't translate without source.
          if (typeof sym.wordsEn === "string" && sym.wordsEn.length > 0) {
            inputMap[sym._id] = sym.wordsEn;
          }
        }
        const symbolIds = Object.keys(inputMap);
        if (symbolIds.length === 0) continue;

        try {
          const { translations, usage } = await translateOneBatch(
            vertex,
            systemPrompt,
            langMod,
            inputMap,
          );

          const entries = symbolIds.map((id) => ({
            symbolId: id as Id<"symbols">,
            word: translations[id].word,
            synonyms: translations[id].synonyms,
          }));

          await ctx.runMutation(internal.symbols.applyTranslationsBatch, {
            slug: job.slug,
            entries,
          });

          totalProcessedThisInvocation += entries.length;

          await ctx.runMutation(internal.translationJobs.recordBatchProgress, {
            jobId,
            processedDelta: entries.length,
            inputTokensDelta: usage.inputTokens,
            outputTokensDelta: usage.outputTokens,
            nextCursor: page.nextCursor,
            markCompleted: false,
          });
        } catch (e) {
          const msg = (e as Error).message ?? String(e);
          const failingIds = symbolIds.slice(0, 5).join(", ");
          await ctx.runMutation(internal.translationJobs.recordJobFailure, {
            jobId,
            error: `${msg} · failing batch sample ids: ${failingIds}${
              symbolIds.length > 5 ? ` (+${symbolIds.length - 5} more)` : ""
            }`,
          });
          return;
        }
      }

      cursor = page.nextCursor;

      if (page.isDone) {
        // Final completion check — there may be no rows past this cursor
        // OR there may be more pages that are entirely already-translated.
        // We'd rather mark complete here and have a no-op resume than
        // leave the job in `running` perpetually.
        await ctx.runMutation(internal.translationJobs.recordBatchProgress, {
          jobId,
          processedDelta: 0,
          inputTokensDelta: 0,
          outputTokensDelta: 0,
          nextCursor: null,
          markCompleted: true,
        });
        // Console log for diagnostics — visible in Convex logs.
        console.log(
          `[translateSymbolsBatch] job ${jobId} complete for ${job.slug}; processed ${totalProcessedThisInvocation} this invocation`,
        );
        return;
      }
    }
  },
});

// ── Single Gemini call with retry / backoff ──────────────────────────────

type TranslationResult = {
  translations: Record<string, { word: string; synonyms: string[] }>;
  usage: { inputTokens: number; outputTokens: number };
};

async function translateOneBatch(
  vertex: VertexClient,
  systemPrompt: string,
  langMod: { code: string; label: string; nativeLabel: string },
  inputMap: Record<string, string>,
): Promise<TranslationResult> {
  const symbolIds = Object.keys(inputMap);
  const userPrompt = `Target language: ${langMod.label} (${langMod.nativeLabel}, ISO: ${langMod.code}).

Translate every value in this JSON object. The keys are stable symbol IDs — keep them EXACTLY as given. Return a JSON object with the SAME keys, each mapping to { "word": <translation>, "synonyms": [<alternates>] }.

${JSON.stringify(inputMap, null, 2)}`;

  let lastError: unknown = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const { result, usage } = await callJsonResponse(
        vertex,
        {
          systemInstruction: {
            role: "system",
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: userPrompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            responseSchema: buildSymbolTranslationSchema(symbolIds),
            // Symbol translations are short (~10-20 tokens each) — 100 symbols
            // × ~25 tokens × non-Latin synonym richness ~= 5k tokens budget.
            // Headroom to 8k.
            maxOutputTokens: 8192,
          },
        },
        (parsed) => {
          if (typeof parsed !== "object" || parsed === null) {
            throw new Error("Gemini response was not a JSON object");
          }
          const out: Record<string, { word: string; synonyms: string[] }> = {};
          for (const id of symbolIds) {
            const entry = (parsed as Record<string, unknown>)[id];
            if (typeof entry !== "object" || entry === null) {
              throw new Error(
                `Gemini omitted or mis-typed symbol "${id}" (got ${typeof entry})`,
              );
            }
            const e = entry as Record<string, unknown>;
            if (typeof e.word !== "string") {
              throw new Error(`Gemini missing word for "${id}"`);
            }
            if (!Array.isArray(e.synonyms)) {
              throw new Error(`Gemini missing synonyms array for "${id}"`);
            }
            const synonyms: string[] = [];
            for (const s of e.synonyms) {
              if (typeof s === "string") synonyms.push(s);
            }
            out[id] = { word: e.word, synonyms };
          }
          return out;
        },
      );
      return { translations: result, usage };
    } catch (e) {
      lastError = e;
      // Only retry on transient Vertex errors (429/500/503).
      if (!isRetryableVertexError(e) || attempt === MAX_RETRIES - 1) {
        throw e;
      }
      const wait = BACKOFF_MS[attempt] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
      console.warn(
        `[translateSymbolsBatch] Vertex transient error (attempt ${attempt + 1}/${MAX_RETRIES}), backing off ${wait}ms: ${(e as Error).message}`,
      );
      await sleep(wait);
    }
  }
  // Unreachable — the loop either returns or throws on the last attempt.
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
