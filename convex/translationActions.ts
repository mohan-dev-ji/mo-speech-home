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

// Walked from 100 → 50 → 25 across the first Spanish run. Each drop
// halved per-batch output token use, and each time Gemini still managed
// to find a pathological batch that tripped MAX_TOKENS. The actual
// culprit isn't the average batch — it's the long-tail batch where one
// symbol's "translation" balloons into multiple sentences of synonyms.
// Tightening the prompt's synonym cap (below) is the durable fix; the
// smaller batch is the belt-and-braces.
//
// Cost trade-off: smaller batches mean more system-prompt overhead per
// symbol. Going from 50 → 25 roughly doubles input-token cost
// (~$0.20 extra on a full 52k run). Acceptable.
const BATCH_SIZE = 25;
// 65536 is Gemini 2.5 Flash's hard ceiling — there's no higher number
// to bump to. If a 25-symbol batch ever overflows this we have a real
// problem with the prompt, not the size. There's NO billing impact
// from raising the cap: you pay only for tokens actually generated.
const MAX_OUTPUT_TOKENS = 65536;
const PAGE_SIZE = 200;             // symbols per Convex paginate (2 batches per page)
const TIME_BUDGET_MS = 4 * 60_000; // 4 min — leave 6 min headroom under 10 min ceiling
const MAX_RETRIES = 3;
const BACKOFF_MS = [1_000, 4_000, 16_000]; // 1s, 4s, 16s

// ── Prompts ──────────────────────────────────────────────────────────────

const LATIN_SYSTEM_PROMPT = `You are translating SymbolStix AAC pictogram labels for Mo Speech, an app for non-verbal children and their families.

Each input is a short English word or phrase shown under a small pictogram (e.g. "dog", "happy", "go to bed"). Translate accurately, naturally, and in everyday register a child uses at home with their family.

For EACH input:
- "word" — the single best translation in the target language. ONE word or short phrase only.
- "synonyms" — EXACTLY 2 short alternates a user might search for. Each synonym must be one short word or short phrase, never a sentence.

Rules:
- Leave proper nouns and brand names unchanged ("Mo Speech", "Hello Kitty", "SymbolStix") — the word becomes the same string, and synonyms is an empty array.
- Preserve the meaning, not the surface form — translate "go to bed" as a natural phrase, not word-by-word.
- **Synonyms must MEAN the same thing as the primary translation** — not just be related. Bad: listing "walk" as a synonym of "go", or "need" as a synonym of "want", or "ingest" as a synonym of "eat". Good: listing "perrita" / "cachorrito" as synonyms of "perro" (all genuinely mean dog).
- **Avoid clinical, technical, formal, or literary register** — a parent talking to their toddler does not say "ingerir" for "eat" or "domicilio" for "house". Pick words a 5-year-old hears at home.
- Prefer common variants (verb conjugations a child would say, diminutives, common nicknames) over rare alternates.
- Never repeat the "word" inside its own "synonyms" array.
- Return JSON exactly matching the schema. Keep input IDs in the same order.`;

const NON_LATIN_SYSTEM_PROMPT = `You are translating SymbolStix AAC pictogram labels for Mo Speech, an app for non-verbal children and their families.

Each input is a short English word or phrase shown under a small pictogram (e.g. "dog", "happy", "go to bed"). Translate accurately, naturally, and in everyday register a child uses at home with their family.

For EACH input:
- "word" — the single best translation in the target language's NATIVE SCRIPT (e.g. Devanagari for Hindi, Hangul for Korean, Gurmukhi for Punjabi). ONE word or short phrase only. Do NOT romanise.
- "synonyms" — EXACTLY 4 alternates total: 2 native-script variants AND 2 Latin-script transliterations following standard romanisation. Never more than 4. Example for Hindi "dog" / "कुत्ता": ["कुत्ते","कुतिया","kutta","kutiya"]. Each synonym must be one short word or short phrase, never a sentence.

Rules:
- Leave proper nouns and brand names unchanged ("Mo Speech", "Hello Kitty", "SymbolStix") — the word becomes the same string, and synonyms is an empty array.
- Preserve the meaning, not the surface form — translate "go to bed" as a natural phrase, not word-by-word.
- **Synonyms must MEAN the same thing as the primary translation** — not just be related. Bad: listing the word for "walk" as a synonym of "go", or "need" as a synonym of "want".
- **Use everyday casual register, not formal or Sanskritised forms** — for Hindi prefer "खाना" (khana) over "भोजन करना" (bhojan karna) for "eat", "घर" (ghar) over "गृह" (grih) for "house", "पानी" (pani) over "जल" (jal) for "water". A child at home speaking with their family is the target audience.
- **Transliterations must be the most common spelling a Latin-keyboard user would actually type** — for Hindi prefer "kutta" over "kuttaa", "namaste" over "namastey", "pani" over "paani". Phonetic, intuitive, no diacritics.
- Never repeat the "word" inside its own "synonyms" array.
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

          // Filter to ids that actually came back — see partial-response
          // tolerance in `translateOneBatch`. Missing rows will resurface
          // on the next pagination pass via the untranslated filter.
          const entries = symbolIds
            .filter((id) => translations[id] !== undefined)
            .map((id) => ({
              symbolId: id as Id<"symbols">,
              word: translations[id].word,
              synonyms: translations[id].synonyms,
            }));
          if (entries.length === 0) continue;

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
        // NOTE: stragglers (~1-2% of symbols Gemini occasionally omits)
        // will leave `processedCount` slightly below `totalCount`. Admin
        // can re-open the Translate-symbols modal to pick them up — the
        // estimate query's `alreadyTranslated` count excludes them so
        // they'll appear as "X to translate this run".
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

Translate every English value below. The keys are stable symbol IDs — echo them back EXACTLY as given in the \`id\` field of each output item. Return ONE object: \`{ "translations": [ { "id": "<symbolId>", "word": "<translation>", "synonyms": [<alternates>] }, ... ] }\` with one entry per input id, same order. Do not add, drop, or rename ids.

Inputs:
${JSON.stringify(inputMap, null, 2)}`;

  // Set of expected ids — let us validate the model returned every
  // requested symbol and didn't hallucinate extra ones.
  const expectedIds = new Set(symbolIds);

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
            responseSchema: buildSymbolTranslationSchema(),
            // See `MAX_OUTPUT_TOKENS` rationale at the top of the file —
            // 16k gives 2× headroom over the worst-case 8k batch.
            maxOutputTokens: MAX_OUTPUT_TOKENS,
          },
        },
        (parsed) => {
          if (typeof parsed !== "object" || parsed === null) {
            throw new Error("Gemini response was not a JSON object");
          }
          const root = parsed as { translations?: unknown };
          if (!Array.isArray(root.translations)) {
            throw new Error(
              "Gemini response missing the `translations` array",
            );
          }
          const out: Record<string, { word: string; synonyms: string[] }> = {};
          for (const raw of root.translations) {
            if (typeof raw !== "object" || raw === null) continue;
            const item = raw as Record<string, unknown>;
            if (typeof item.id !== "string") continue;
            if (!expectedIds.has(item.id)) continue; // ignore stray ids
            if (typeof item.word !== "string") {
              throw new Error(`Gemini missing word for "${item.id}"`);
            }
            if (!Array.isArray(item.synonyms)) {
              throw new Error(
                `Gemini missing synonyms array for "${item.id}"`,
              );
            }
            const synonyms: string[] = [];
            for (const s of item.synonyms) {
              if (typeof s === "string") synonyms.push(s);
            }
            out[item.id] = { word: item.word, synonyms };
          }
          // Partial-response tolerance — Gemini occasionally drops 1-2
          // items per 50-item batch (~2% rate, observed in early
          // Phase 8.2 runs). Treat as a soft failure: accept what came
          // back, log a warning, let the next pagination pass re-fetch
          // the missing rows (the action's `fetchUntranslatedPage` filter
          // strips already-translated rows so stragglers naturally
          // resurface).
          //
          // A hard fail (throwing here) would abort the entire job for
          // one missing row — discarding the other 49 good translations
          // and forcing a manual Resume. The soft path is robust against
          // Gemini's small omission rate without blocking progress.
          const missing = symbolIds.filter((id) => !(id in out));
          if (missing.length > 0) {
            // Allow up to half the batch to be missing — beyond that
            // something is structurally wrong (malformed batch,
            // truncated response). Catastrophic batches should fail
            // the job so admin notices; small omissions should not.
            if (missing.length > symbolIds.length / 2) {
              throw new Error(
                `Gemini returned only ${symbolIds.length - missing.length}/${symbolIds.length} symbols — too few to accept. First missing: ${missing.slice(0, 3).join(", ")}`,
              );
            }
            console.warn(
              `[translateSymbolsBatch] partial response: ${missing.length}/${symbolIds.length} symbols missing; accepting partial. First missing: ${missing.slice(0, 3).join(", ")}`,
            );
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
