/**
 * `/api/admin/translate-ui-strings` — Phase 8.1 first translation pipeline.
 *
 * Reads `messages/en.json` (canonical), reads `messages/<code>.json` if it
 * exists, computes the key diff, AI-translates the new/changed keys via
 * Google Gemini 2.5 Flash on Vertex AI, and writes back to
 * `messages/<code>.json`. Idempotent — keys whose English value hasn't
 * changed since the target file was last written are skipped.
 *
 * **Provider choice — Gemini 2.5 Flash via Vertex AI.** Reuses the same
 * `GOOGLE_SERVICE_ACCOUNT_JSON` + `GOOGLE_CLOUD_PROJECT_ID` auth as the
 * Imagen route (`app/api/ai-generate/imagen/route.ts`); no new env var.
 * Pricing is roughly 25× cheaper than Claude Sonnet, ~4× cheaper than
 * Claude Haiku, and quality on translation is excellent (multilingual is
 * a Gemini strength). See the pricing comparison in the Phase 8.1 chat.
 *
 * **Local-dev-only** (mirrors `language-publish`). Writes to the repo
 * working tree via `node:fs/promises`. Production needs the GitHub API
 * authoring path — see ADR-010 "Future hooks".
 *
 * **Diff strategy:** an extra `_sourceSnapshot` key is written into the
 * target file holding the English values that were translated. On rerun
 * we compare each en key against the snapshot — anything new, changed,
 * or missing from the target gets retranslated. The snapshot is
 * filtered out at runtime by `i18n/request.ts` because the merge there
 * only iterates `Object.keys(enMessages)`, so the snapshot key never
 * reaches next-intl.
 *
 * Auth: Clerk-authenticated admin.
 *
 * POST body: `{ code: string }` — ISO language code matching a module in
 * `convex/data/languages/`.
 *
 * Returns: `{ ok, code, translated, skipped, total, model }` on success.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { GoogleAuth } from "google-auth-library";

export const dynamic = "force-dynamic";
// Translation runs can take 60s+ for the full 829-key UI dictionary across
// ~9 sequential batches. Bump from the default 10s edge timeout.
export const maxDuration = 300;

const REPO_ROOT = process.cwd();
const MESSAGES_DIR = join(REPO_ROOT, "messages");
const SNAPSHOT_KEY = "_sourceSnapshot";

// Gemini 2.5 Flash: $0.30/M input + $2.50/M output as of May 2026 —
// 25× cheaper than Claude Sonnet 4.6 and excellent multilingual quality.
// Switch to 2.5 Flash-Lite for an extra 80% off if quality holds for the
// Phase 8.2 symbol pipeline.
const MODEL = "gemini-2.5-flash";

function isDevEnvironment(): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  if (process.env.DISABLE_LANGUAGE_PUBLISH === "true") return false;
  return true;
}

// ── Recursive key flatten / unflatten ──────────────────────────────────────
//
// next-intl namespaces are nested objects (`lists.create`, `lists.deleteTitle`).
// Translation works key-by-key, so we flatten to dot paths, translate, then
// rebuild. The snapshot is flat too — comparing nested objects is fragile.

type NestedRecord = { [k: string]: string | NestedRecord };

function flatten(obj: NestedRecord, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") {
      out[path] = v;
    } else if (v && typeof v === "object") {
      Object.assign(out, flatten(v, path));
    }
  }
  return out;
}

function unflatten(flat: Record<string, string>): NestedRecord {
  const out: NestedRecord = {};
  for (const [path, value] of Object.entries(flat)) {
    const parts = path.split(".");
    let cursor: NestedRecord = out;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      if (typeof cursor[seg] !== "object" || cursor[seg] === null) {
        cursor[seg] = {};
      }
      cursor = cursor[seg] as NestedRecord;
    }
    cursor[parts[parts.length - 1]] = value;
  }
  return out;
}

// ── Gemini via Vertex AI ──────────────────────────────────────────────────
//
// Uses the same `generateContent` REST endpoint as the AI Studio SDK but
// authenticated via Google Cloud service account. `responseMimeType:
// "application/json"` + `responseSchema` constrains output to a key→string
// map so we don't need to tolerate fenced markdown like an unconstrained
// model would emit.

const SYSTEM_PROMPT = `You are translating UI strings for Mo Speech, an AAC (augmentative communication) app for non-verbal children and their families.

Rules:
1. Preserve ALL placeholders exactly: \`{name}\`, \`{count}\`, \`<b>…</b>\`, \`\\n\`, etc. Never rename or remove them.
2. Preserve sentence-final punctuation and ellipsis (\`…\`) — they're load-bearing in the UI.
3. Match register: button labels are imperative ("Create", "Delete"), titles are nouns, error messages are calm and direct.
4. Use native script where appropriate (Devanagari for Hindi, Gurmukhi for Punjabi). Do NOT romanise.
5. Return a JSON object mapping each English key to its translated string. Keep keys EXACTLY as given — including dots.
6. Where a string is an interjection or proper noun that doesn't translate ("Mo Speech", "AAC"), leave it as-is.`;

type LanguageInfo = {
  code: string;
  label: string;
  nativeLabel: string;
};

type AuthedVertexClient = {
  call: (body: unknown) => Promise<unknown>;
};

/**
 * Build a Vertex-AI REST client bound to the project's service account.
 * One client per request — `generateContent` is rate-limited per-project
 * not per-connection so there's nothing to pool.
 */
async function buildVertexClient(): Promise<AuthedVertexClient> {
  const credJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set");
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  if (!projectId) throw new Error("GOOGLE_CLOUD_PROJECT_ID not set");
  // Region preference:
  //  - `GEMINI_TRANSLATION_LOCATION` if set — lets you put translation in
  //    EU (e.g. `europe-west4`, Netherlands — reliable Gemini 2.5 Flash
  //    presence) without moving Imagen, which is pinned to `us-central1`.
  //  - Else the shared `GOOGLE_CLOUD_LOCATION` (Imagen's home).
  //  - Else `us-central1`.
  // europe-west2 (London) currently 404s on Gemini 2.5 Flash; west4 is the
  // closest reliable EU region.
  const location =
    process.env.GEMINI_TRANSLATION_LOCATION ??
    process.env.GOOGLE_CLOUD_LOCATION ??
    "us-central1";

  const googleAuth = new GoogleAuth({
    credentials: JSON.parse(credJson),
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await googleAuth.getClient();
  const { token } = await client.getAccessToken();

  const url =
    `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}` +
    `/locations/${location}/publishers/google/models/${MODEL}:generateContent`;

  return {
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
        throw new Error(`Vertex AI ${MODEL} ${res.status}: ${text}`);
      }
      return res.json();
    },
  };
}

/**
 * Build the responseSchema for a single batch. Gemini's structured-output
 * mode honours a JSON Schema subset — `type: "object"` with a `properties`
 * map keyed by the source keys forces a 1:1 response shape and lets us
 * skip the regex / fenced-markdown tolerance loop entirely.
 *
 * Gemini's schema spec requires `propertyOrdering` to control the output
 * order (and avoid alphabetisation), so we set it to the input order.
 */
function buildResponseSchema(keys: string[]): Record<string, unknown> {
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

async function translateBatch(
  vertex: AuthedVertexClient,
  target: LanguageInfo,
  entries: Record<string, string>
): Promise<Record<string, string>> {
  const keys = Object.keys(entries);
  const userPrompt = `Target language: ${target.label} (${target.nativeLabel}, ISO: ${target.code}).

Translate every value in this JSON object. Return a JSON object with the SAME keys mapping to the translated strings.

${JSON.stringify(entries, null, 2)}`;

  const body = {
    // Vertex's generateContent shape — system instruction is its own field;
    // contents holds the user turn.
    systemInstruction: {
      role: "system",
      parts: [{ text: SYSTEM_PROMPT }],
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
      responseSchema: buildResponseSchema(keys),
      maxOutputTokens: 8192,
    },
  };

  const json = (await vertex.call(body)) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    promptFeedback?: { blockReason?: string };
  };

  if (json.promptFeedback?.blockReason) {
    throw new Error(
      `Gemini blocked the prompt: ${json.promptFeedback.blockReason}`
    );
  }
  const cand = json.candidates?.[0];
  if (!cand) throw new Error("Gemini returned no candidates");
  if (cand.finishReason && cand.finishReason !== "STOP") {
    throw new Error(
      `Gemini stopped early with reason: ${cand.finishReason}` +
        (cand.finishReason === "MAX_TOKENS"
          ? " — lower the batch size."
          : "")
    );
  }
  const text = cand.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini candidate had no text part");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      `Gemini returned non-JSON despite structured output. First 200 chars: ${text.slice(0, 200)}`
    );
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Gemini response was not a JSON object");
  }
  const result: Record<string, string> = {};
  for (const key of keys) {
    const v = (parsed as Record<string, unknown>)[key];
    if (typeof v !== "string") {
      throw new Error(
        `Gemini omitted or mis-typed key "${key}" (got ${typeof v})`
      );
    }
    result[key] = v;
  }
  return result;
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(request: Request) {
  if (!isDevEnvironment()) {
    return NextResponse.json(
      {
        error:
          "Translate-ui-strings is dev-only. Set NODE_ENV=development to enable.",
      },
      { status: 403 }
    );
  }

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !process.env.GOOGLE_CLOUD_PROJECT_ID) {
    return NextResponse.json(
      {
        error:
          "GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_CLOUD_PROJECT_ID must be set in .env.local — same auth as the Imagen route.",
      },
      { status: 503 }
    );
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const code = (body as { code?: unknown })?.code;
  if (typeof code !== "string" || !/^[a-z]{2,3}(-[A-Z]{2})?$/.test(code)) {
    return NextResponse.json(
      { error: "`code` must be an ISO 639-1 code, optionally region-tagged" },
      { status: 400 }
    );
  }
  if (code === "en") {
    return NextResponse.json(
      { error: "Cannot translate into the source language (en)" },
      { status: 400 }
    );
  }

  // Look up the language module so the prompt knows the label + native label.
  const languagesDir = join(REPO_ROOT, "convex", "data", "languages");
  const langModulePath = join(languagesDir, `${code}.json`);
  if (!existsSync(langModulePath)) {
    return NextResponse.json(
      {
        error: `Language module not found at convex/data/languages/${code}.json — call /api/admin/language-publish first.`,
      },
      { status: 404 }
    );
  }
  const langMod = JSON.parse(await readFile(langModulePath, "utf8")) as LanguageInfo;

  // Load source (en) and existing target (if any).
  const enPath = join(MESSAGES_DIR, "en.json");
  const enContent = JSON.parse(await readFile(enPath, "utf8")) as NestedRecord;
  const enFlat = flatten(enContent);

  const targetPath = join(MESSAGES_DIR, `${code}.json`);
  let targetFlat: Record<string, string> = {};
  let lastSnapshot: Record<string, string> = {};
  if (existsSync(targetPath)) {
    const targetContent = JSON.parse(await readFile(targetPath, "utf8")) as NestedRecord & {
      [SNAPSHOT_KEY]?: Record<string, string>;
    };
    const { [SNAPSHOT_KEY]: snap, ...rest } = targetContent;
    lastSnapshot = snap ?? {};
    targetFlat = flatten(rest as NestedRecord);
  }

  // Determine which keys need (re)translation.
  // - Missing entirely from target: translate.
  // - English value changed since snapshot: retranslate.
  // - English value unchanged AND target has a value: skip.
  const toTranslate: Record<string, string> = {};
  let skipped = 0;
  for (const [key, enValue] of Object.entries(enFlat)) {
    if (targetFlat[key] === undefined) {
      toTranslate[key] = enValue;
      continue;
    }
    if (lastSnapshot[key] !== enValue) {
      toTranslate[key] = enValue;
      continue;
    }
    skipped++;
  }

  // Drop target keys that no longer exist in source — keeps the files in
  // sync with renames + deletes.
  const removed: string[] = [];
  for (const key of Object.keys(targetFlat)) {
    if (!(key in enFlat)) {
      delete targetFlat[key];
      removed.push(key);
    }
  }

  const total = Object.keys(toTranslate).length;
  if (total === 0) {
    return NextResponse.json({
      ok: true,
      code,
      translated: 0,
      skipped,
      removed: removed.length,
      total: Object.keys(enFlat).length,
      model: MODEL,
    });
  }

  // Batch ~100 keys per Gemini call. Gemini 2.5 Flash has an 8k output
  // token budget which comfortably fits 100 short UI strings as JSON; the
  // structured-output schema prevents truncation by failing loudly on
  // MAX_TOKENS rather than returning malformed JSON.
  const vertex = await buildVertexClient();
  const allEntries = Object.entries(toTranslate);
  const BATCH_SIZE = 100;
  let translated = 0;
  for (let i = 0; i < allEntries.length; i += BATCH_SIZE) {
    const slice = Object.fromEntries(allEntries.slice(i, i + BATCH_SIZE));
    const result = await translateBatch(vertex, langMod, slice);
    Object.assign(targetFlat, result);
    translated += Object.keys(result).length;
  }

  // Write back: unflatten the translations + write the new snapshot.
  const nextTarget = unflatten(targetFlat) as NestedRecord & {
    [SNAPSHOT_KEY]?: Record<string, string>;
  };
  // Snapshot reflects the source state we just translated against — copy
  // the full en flat map (not just the slice translated this run) so future
  // diffs are correct.
  nextTarget[SNAPSHOT_KEY] = enFlat;

  await writeFile(targetPath, JSON.stringify(nextTarget, null, 2) + "\n");

  return NextResponse.json({
    ok: true,
    code,
    translated,
    skipped,
    removed: removed.length,
    total: Object.keys(enFlat).length,
    model: MODEL,
  });
}
