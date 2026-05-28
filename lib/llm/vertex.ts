/**
 * Shared Google Vertex AI Gemini 2.5 Flash client. Used by:
 *
 *   - `app/api/admin/translate-ui-strings/route.ts` — Phase 8.1 UI strings
 *   - `convex/translationActions.ts` — Phase 8.2 symbol translations
 *
 * Both surfaces authenticate the same way (`GOOGLE_SERVICE_ACCOUNT_JSON`
 * service account, same scopes), hit the same `:generateContent` endpoint,
 * use the same structured-output trick (`responseMimeType: "application/json"`
 * + `responseSchema`), and have the same `finishReason !== "STOP"` /
 * `MAX_TOKENS` failure modes. Extracting them here avoids the two surfaces
 * drifting apart as we tune prompts and add features.
 *
 * **Runtime**: pure Node 20+ (`fetch` + `google-auth-library`). Works in
 * Next.js server routes AND in Convex Node actions (the latter via the
 * `"use node"` directive in the importing file).
 *
 * **Region**: `GEMINI_TRANSLATION_LOCATION` overrides the shared
 * `GOOGLE_CLOUD_LOCATION` (Imagen pins to us-central1) — handy for putting
 * translation work in EU without moving Imagen.
 *
 * **Schema-bound responses**: callers pass the expected response shape as a
 * JSON Schema fragment; Gemini emits valid JSON matching that schema. The
 * helper `buildStringMapSchema(keys)` covers the "translate values keyed
 * by id" case used by both surfaces.
 */

import { GoogleAuth } from "google-auth-library";

/** Gemini 2.5 Flash — $0.30/M input + $2.50/M output (May 2026). */
export const VERTEX_MODEL = "gemini-2.5-flash";

const LEGACY_LOCATION_FALLBACK = "us-central1";

export type VertexClient = {
  /** Call `:generateContent`. Returns the raw response JSON. */
  call: (body: unknown) => Promise<unknown>;
  /** The model id this client is bound to — for logging. */
  model: string;
  /** The region this client routes to — for logging. */
  location: string;
};

/**
 * Resolve the Vertex AI region with the same precedence used everywhere:
 * `GEMINI_TRANSLATION_LOCATION` → `GOOGLE_CLOUD_LOCATION` → us-central1.
 *
 * europe-west2 (London) currently 404s on Gemini 2.5 Flash; europe-west4
 * (Netherlands) is the closest reliable EU region.
 */
export function resolveVertexLocation(): string {
  return (
    process.env.GEMINI_TRANSLATION_LOCATION ??
    process.env.GOOGLE_CLOUD_LOCATION ??
    LEGACY_LOCATION_FALLBACK
  );
}

/**
 * Build a Vertex AI REST client bound to the project's service account.
 * One client per request — `generateContent` is rate-limited per-project,
 * not per-connection, so there's nothing to pool.
 *
 * Throws synchronously if the auth env vars are missing — callers should
 * surface the error to the admin (via toast, job-row `lastError`, etc.).
 */
export async function buildVertexClient(
  model: string = VERTEX_MODEL,
): Promise<VertexClient> {
  const credJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set");
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  if (!projectId) throw new Error("GOOGLE_CLOUD_PROJECT_ID not set");

  const location = resolveVertexLocation();

  const googleAuth = new GoogleAuth({
    credentials: JSON.parse(credJson),
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await googleAuth.getClient();
  const { token } = await client.getAccessToken();

  const url =
    `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}` +
    `/locations/${location}/publishers/google/models/${model}:generateContent`;

  return {
    model,
    location,
    async call(body) {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        // Attach status code to the error message so callers can
        // pattern-match for 429 backoff without parsing the response body.
        const err = new Error(
          `Vertex AI ${model} ${res.status}: ${text}`,
        ) as Error & { status?: number };
        err.status = res.status;
        throw err;
      }
      return res.json();
    },
  };
}

/**
 * Build a responseSchema for the "object keyed by id, every value is a
 * string" case — Phase 8.1 UI strings pipeline shape.
 *
 * Gemini's schema spec requires `propertyOrdering` to control output order
 * (otherwise the model can alphabetise, breaking JSON parse stability).
 */
export function buildStringMapSchema(keys: string[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const k of keys) {
    properties[k] = { type: "string" };
  }
  return {
    type: "object",
    properties,
    required: keys,
    propertyOrdering: keys,
  };
}

/**
 * Build a responseSchema for the Phase 8.2 symbol translation shape.
 *
 * **Why an array, not a keyed object?** Vertex AI's structured-output
 * mode rejects schemas with too many "states" — a keyed object with
 * 100 nested `{word, synonyms[]}` properties produces ~300 schema nodes
 * and trips the limit with a 400:
 *
 *   "The specified schema produces a constraint that has too many states
 *   for serving."
 *
 * Flattening to `{translations: [{id, word, synonyms}, ...]}` makes the
 * schema constant-size (~7 nodes) regardless of batch count. The model
 * receives the input ids in the user prompt and echoes them back as the
 * `id` field on each item; the caller's validator maps back to the
 * original input.
 *
 * `word` is the primary translation; `synonyms` is an array of alternates
 * and (for non-Latin scripts) Latin transliterations.
 */
export function buildSymbolTranslationSchema(): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      translations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            word: { type: "string" },
            synonyms: { type: "array", items: { type: "string" } },
          },
          required: ["id", "word", "synonyms"],
          propertyOrdering: ["id", "word", "synonyms"],
        },
      },
    },
    required: ["translations"],
    propertyOrdering: ["translations"],
  };
}

/**
 * Shape of the `:generateContent` response. Both candidates and
 * promptFeedback can carry failure signals — callers should check both.
 */
export type VertexGenerateContentResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

/**
 * Call Gemini and extract the single JSON candidate, parse it, and run the
 * caller-supplied validator. Wraps the common error-path handling:
 *
 *   - `promptFeedback.blockReason` → throw
 *   - missing candidate → throw
 *   - `finishReason !== "STOP"` → throw (with "lower the batch size" hint
 *     for MAX_TOKENS)
 *   - non-JSON text → throw (with a 200-char preview for diagnostics)
 *   - validator failure → throw whatever the validator says
 *
 * Returns the parsed + validated value. The validator returns a typed
 * result; this function preserves that type.
 *
 * **Token bookkeeping**: returns `{result, usage}` so the caller can
 * accumulate token counts on its progress row.
 */
export async function callJsonResponse<T>(
  vertex: VertexClient,
  body: {
    systemInstruction: { role: "system"; parts: Array<{ text: string }> };
    contents: Array<{ role: "user"; parts: Array<{ text: string }> }>;
    generationConfig: {
      temperature?: number;
      responseMimeType: "application/json";
      responseSchema: Record<string, unknown>;
      maxOutputTokens?: number;
    };
  },
  validate: (raw: unknown) => T,
): Promise<{
  result: T;
  usage: { inputTokens: number; outputTokens: number };
}> {
  const json = (await vertex.call(body)) as VertexGenerateContentResponse;

  if (json.promptFeedback?.blockReason) {
    throw new Error(
      `Gemini blocked the prompt: ${json.promptFeedback.blockReason}`,
    );
  }
  const cand = json.candidates?.[0];
  if (!cand) throw new Error("Gemini returned no candidates");
  if (cand.finishReason && cand.finishReason !== "STOP") {
    throw new Error(
      `Gemini stopped early with reason: ${cand.finishReason}` +
        (cand.finishReason === "MAX_TOKENS"
          ? " — lower the batch size."
          : ""),
    );
  }
  const text = cand.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini candidate had no text part");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      `Gemini returned non-JSON despite structured output. First 200 chars: ${text.slice(0, 200)}`,
    );
  }

  const result = validate(parsed);
  return {
    result,
    usage: {
      inputTokens: json.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: json.usageMetadata?.candidatesTokenCount ?? 0,
    },
  };
}

/**
 * Sleep helper for rate-limit backoff. Returns a promise that resolves
 * after `ms` milliseconds. Exported so the Phase 8.2 action can reuse it
 * without pulling in a dependency.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Recognise a transient Vertex error worth backing off + retrying.
 * Currently: 429 (rate limit), 503 (service unavailable), 500 (transient
 * server error). The error object carries the status code via the
 * `.status` property attached by `buildVertexClient`.
 */
export function isRetryableVertexError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const status = (err as Error & { status?: number }).status;
  return status === 429 || status === 500 || status === 503;
}
