/**
 * Phase 8.3 — generic library-pack translator.
 *
 * Walks a `convex/data/library_packs/<slug>.json` file, finds every
 * `LocalisedString` field (pack name/description, category name, list
 * name, list-item description, sentence name, sentence text) that's
 * missing the requested locale, and asks Gemini 2.5 Flash to fill it in.
 *
 * Skips symbol-level `label` / `labelOverride` — those get overridden at
 * materialisation time by the live `symbols.words[locale]` populated in
 * Phase 8.2 (see materialiseSymbolsFromJson in convex/resourcePacks.ts).
 *
 * Why a Node script and not a Convex action? Pack content lives in repo
 * JSON files, not Convex tables. Same constraint as the publish API
 * route. Per-pack cost is ~5–15 strings, ~$0.01, ~5s wall-clock — no
 * batching, no resumability machinery, no progress UI needed.
 *
 * Why inline the Vertex caller instead of importing `lib/llm/vertex.ts`?
 * All scripts in this repo are vanilla .mjs (no TS loader in dev deps,
 * Node 20.17 doesn't strip types). The canonical client at
 * `lib/llm/vertex.ts` covers the Next.js route + Convex action; the
 * shape here mirrors it deliberately so prompt/auth/retry stay aligned.
 *
 * Usage:
 *   node --env-file=.env.local scripts/translate-pack.mjs <slug> <locale>
 *   node --env-file=.env.local scripts/translate-pack.mjs --all <locale>
 *   node --env-file=.env.local scripts/translate-pack.mjs --all <locale> --dry
 *   node --env-file=.env.local scripts/translate-pack.mjs <slug> <locale> --dry
 *
 * Locale must exist in `convex/data/languages/<locale>.json` (used for
 * the language name in the prompt).
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleAuth } from "google-auth-library";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const PACKS_DIR = join(REPO_ROOT, "convex", "data", "library_packs");
const LANGS_DIR = join(REPO_ROOT, "convex", "data", "languages");

// Gemini 2.5 Flash pricing (May 2026) — keep in sync with
// convex/translationJobs.ts:88-89.
const VERTEX_MODEL = "gemini-2.5-flash";
const PRICE_PER_M_INPUT_USD = 0.30;
const PRICE_PER_M_OUTPUT_USD = 2.50;
const BACKOFF_MS = [1_000, 4_000, 16_000];

const SYSTEM_PROMPT_LATIN = `You are translating AAC content pack labels for Mo Speech, an app for non-verbal children and their families.

Each input is a short user-facing label or phrase (e.g. "Bedtime routine", "Christmas", "I want to go outside"). Translate accurately, naturally, and in everyday register a child uses at home with their family.

Rules:
- Leave proper nouns and brand names unchanged ("Mo Speech", "Christmas", "Diwali", "Hello Kitty").
- Preserve the meaning, not the surface form — translate "I want to go outside" as a natural phrase a child would actually say, not word-by-word.
- **Avoid clinical, technical, formal, or literary register** — a parent talking to their toddler does not say "ingerir" for "eat" or "domicilio" for "house". Pick words a 5-year-old hears at home.
- Match the original tone: pack/category names are short noun phrases, list names are short action phrases, sentence names sound like things a child would say.
- Return JSON exactly matching the schema. Use the input keys (the dot-notation paths) as the response keys — do not modify them.`;

// ── CLI parsing ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const positional = args.filter((a) => !a.startsWith("--"));
const allMode = args.includes("--all");

let targets; // array of pack slugs
let locale;

if (allMode) {
  if (positional.length !== 1) {
    fatal("Usage: --all <locale> [--dry]");
  }
  locale = positional[0];
  targets = readdirSync(PACKS_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
} else {
  if (positional.length !== 2) {
    fatal(
      "Usage:\n" +
        "  scripts/translate-pack.mjs <slug> <locale> [--dry]\n" +
        "  scripts/translate-pack.mjs --all <locale> [--dry]",
    );
  }
  [targets, locale] = [[positional[0]], positional[1]];
}

const localeMeta = loadLocaleMeta(locale);

// ── Main loop ───────────────────────────────────────────────────────────

const totals = { fields: 0, inputTokens: 0, outputTokens: 0, packs: 0 };

for (const slug of targets) {
  const result = await translatePack(slug, locale, localeMeta, dry);
  totals.packs += 1;
  totals.fields += result.fields;
  totals.inputTokens += result.inputTokens;
  totals.outputTokens += result.outputTokens;
}

if (allMode || dry) {
  const cost = estimateCost(totals.inputTokens, totals.outputTokens);
  console.log(
    `\n${dry ? "[dry] " : ""}Total: ${totals.fields} field(s) across ${totals.packs} pack(s)` +
      (dry
        ? ` · est ~$${cost.toFixed(4)} (rough)`
        : ` · ~$${cost.toFixed(4)} actual`),
  );
}

// ── Per-pack flow ───────────────────────────────────────────────────────

async function translatePack(slug, locale, localeMeta, dry) {
  const packPath = join(PACKS_DIR, `${slug}.json`);
  const pack = JSON.parse(readFileSync(packPath, "utf8"));

  const fields = collectFields(pack, locale);
  if (fields.length === 0) {
    console.log(`${slug}.json — all done (${locale} already present)`);
    return { fields: 0, inputTokens: 0, outputTokens: 0 };
  }

  if (dry) {
    console.log(`[dry] ${slug}.json — ${fields.length} field(s) to translate:`);
    for (const f of fields) {
      console.log(`        ${f.path}  ←  "${truncate(f.en, 60)}"`);
    }
    // Rough cost estimate: ~1.5× the source length in tokens (input ≈ source +
    // prompt overhead, output ≈ source). Good enough for go/no-go.
    const sourceChars = fields.reduce((s, f) => s + f.en.length, 0);
    const estInput = Math.ceil(sourceChars * 0.6) + 600; // prompt overhead
    const estOutput = Math.ceil(sourceChars * 0.5);
    return {
      fields: fields.length,
      inputTokens: estInput,
      outputTokens: estOutput,
    };
  }

  const { translations, usage } = await callGemini(fields, localeMeta);

  // Validate every requested path came back.
  const missing = fields
    .map((f) => f.path)
    .filter((p) => typeof translations[p] !== "string" || !translations[p]);
  if (missing.length > 0) {
    fatal(
      `${slug}.json — Gemini did not return translations for: ${missing.join(", ")}`,
    );
  }

  // Apply translations into the pack object (mutates in place).
  for (const f of fields) {
    setLocalisedAtPath(pack, f.path, locale, translations[f.path]);
  }

  writeFileSync(packPath, JSON.stringify(pack, null, 2) + "\n");
  const cost = estimateCost(usage.inputTokens, usage.outputTokens);
  console.log(
    `${slug}.json — translated ${fields.length} field(s)` +
      ` · ${usage.inputTokens}/${usage.outputTokens} tok` +
      ` · ~$${cost.toFixed(4)}`,
  );

  return {
    fields: fields.length,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };
}

// ── Field collector ─────────────────────────────────────────────────────

/**
 * Walk a pack and return a flat list of `{path, en}` for every
 * LocalisedString field missing `<locale>`. Path uses dot+index notation
 * (e.g. `categories[3].name`, `lists[0].items[2].description`).
 *
 * Recognised LocalisedString fields per types.ts:
 *   - pack.name, pack.description
 *   - category.name
 *   - category.symbols[].label — ONLY for custom-image symbols (no symbolId).
 *     SymbolStix symbols (with symbolId) get their localised label via the
 *     central symbols.words[locale] table at materialisation time and so
 *     are deliberately skipped here.
 *   - list.name
 *   - list.items[].description (legacy string | LocalisedString)
 *   - sentence.name
 *   - sentence.text (legacy string | LocalisedString)
 *
 * Explicitly skipped:
 *   - symbols[].labelOverride — ALWAYS skipped. Only present on SymbolStix
 *     symbols (which have symbolId) where the central fallback applies.
 *   - symbols[].label when the symbol also has symbolId — same reason.
 */
function collectFields(pack, locale) {
  const out = [];

  pushField(out, "name", pack.name, locale);
  pushField(out, "description", pack.description, locale);

  for (const [i, cat] of (pack.categories ?? []).entries()) {
    pushField(out, `categories[${i}].name`, cat.name, locale);
    for (const [si, sym] of (cat.symbols ?? []).entries()) {
      // SymbolStix-backed symbols (have symbolId) get their localised label
      // via symbols.words[locale] at materialisation time — never translate
      // their pack-level label or labelOverride. Custom-image symbols (no
      // symbolId) have no central fallback, so their label must be
      // translated pack-side. See header comment for rationale.
      if (sym.symbolId) continue;
      pushField(out, `categories[${i}].symbols[${si}].label`, sym.label, locale);
    }
  }

  for (const [i, list] of (pack.lists ?? []).entries()) {
    pushField(out, `lists[${i}].name`, list.name, locale);
    for (const [j, item] of (list.items ?? []).entries()) {
      pushField(
        out,
        `lists[${i}].items[${j}].description`,
        item.description,
        locale,
      );
    }
  }

  for (const [i, sentence] of (pack.sentences ?? []).entries()) {
    pushField(out, `sentences[${i}].name`, sentence.name, locale);
    pushField(out, `sentences[${i}].text`, sentence.text, locale);
  }

  return out;
}

/**
 * Add `{path, en}` to `out` if the field has English content and is
 * missing the target locale. Handles both shapes of the migration
 * union: plain string (legacy) and `{en: ...}` (LocalisedString).
 */
function pushField(out, path, value, locale) {
  if (value == null) return;
  if (typeof value === "string") {
    // Legacy plain string — treat as english-only. Worth translating
    // (Phase 8.0 migration window: union of `string | LocalisedString`).
    out.push({ path, en: value });
    return;
  }
  if (typeof value === "object") {
    if (typeof value[locale] === "string" && value[locale].length > 0) return;
    if (typeof value.en !== "string" || value.en.length === 0) return;
    out.push({ path, en: value.en });
  }
}

// ── setByPath ───────────────────────────────────────────────────────────

/**
 * Set `value` at `locale` on the LocalisedString located at `path` in
 * `obj`. If the field is currently a plain string (legacy union shape),
 * upgrade it to `{en: <original>, <locale>: <value>}` in place.
 *
 * Path grammar: dot-separated segments; each segment optionally followed
 * by `[index]` for array indexing. Examples:
 *   - `name`
 *   - `categories[3].name`
 *   - `lists[0].items[2].description`
 */
function setLocalisedAtPath(obj, path, locale, value) {
  const segments = parsePath(path);
  const parentPath = segments.slice(0, -1);
  const leafKey = segments[segments.length - 1];

  let parent = obj;
  for (const seg of parentPath) {
    parent = seg.kind === "index" ? parent[seg.index] : parent[seg.key];
    if (parent == null) {
      throw new Error(`setLocalisedAtPath: nothing at ${path} — parent missing`);
    }
  }

  const current = leafKey.kind === "index" ? parent[leafKey.index] : parent[leafKey.key];
  const writeKey = leafKey.kind === "index" ? leafKey.index : leafKey.key;

  if (typeof current === "string") {
    // Legacy plain string — upgrade to LocalisedString with both en
    // and the new locale.
    parent[writeKey] = { en: current, [locale]: value };
  } else if (current && typeof current === "object") {
    current[locale] = value;
  } else {
    throw new Error(
      `setLocalisedAtPath: ${path} is not a string or object (got ${typeof current})`,
    );
  }
}

/**
 * Parse `categories[3].name` into
 *   [{kind:"key",key:"categories"},{kind:"index",index:3},{kind:"key",key:"name"}]
 */
function parsePath(path) {
  const segments = [];
  for (const part of path.split(".")) {
    const match = part.match(/^([a-zA-Z_][a-zA-Z0-9_]*)((?:\[\d+\])*)$/);
    if (!match) throw new Error(`parsePath: bad segment "${part}" in "${path}"`);
    segments.push({ kind: "key", key: match[1] });
    const bracketed = match[2];
    if (bracketed) {
      for (const idx of bracketed.matchAll(/\[(\d+)\]/g)) {
        segments.push({ kind: "index", index: Number(idx[1]) });
      }
    }
  }
  return segments;
}

// ── Gemini call ─────────────────────────────────────────────────────────

async function callGemini(fields, localeMeta) {
  const vertex = await buildVertexClient();

  const userPrompt =
    `Translate each value into ${localeMeta.label} (${localeMeta.nativeLabel}). ` +
    `Respond with a JSON object where each input key (the dot-notation path) ` +
    `maps to its translation string.\n\nInput:\n` +
    JSON.stringify(
      Object.fromEntries(fields.map((f) => [f.path, f.en])),
      null,
      2,
    );

  const body = {
    systemInstruction: {
      role: "system",
      parts: [{ text: SYSTEM_PROMPT_LATIN }],
    },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: buildStringMapSchema(fields.map((f) => f.path)),
    },
  };

  for (let attempt = 0; ; attempt++) {
    try {
      const json = await vertex.call(body);
      const cand = json.candidates?.[0];
      if (!cand) throw new Error("Gemini returned no candidates");
      if (cand.finishReason && cand.finishReason !== "STOP") {
        throw new Error(
          `Gemini stopped early with reason: ${cand.finishReason}` +
            (cand.finishReason === "MAX_TOKENS"
              ? " — split the pack call into batches."
              : ""),
        );
      }
      const text = cand.content?.parts?.[0]?.text;
      if (!text) throw new Error("Gemini candidate had no text part");

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error(
          `Gemini returned non-JSON. First 200 chars: ${text.slice(0, 200)}`,
        );
      }
      return {
        translations: parsed,
        usage: {
          inputTokens: json.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: json.usageMetadata?.candidatesTokenCount ?? 0,
        },
      };
    } catch (err) {
      if (isRetryable(err) && attempt < BACKOFF_MS.length) {
        const ms = BACKOFF_MS[attempt];
        console.warn(
          `Vertex transient error (attempt ${attempt + 1}), retrying in ${ms}ms: ${err.message}`,
        );
        await sleep(ms);
        continue;
      }
      throw err;
    }
  }
}

async function buildVertexClient() {
  const credJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credJson) fatal("GOOGLE_SERVICE_ACCOUNT_JSON not set");
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  if (!projectId) fatal("GOOGLE_CLOUD_PROJECT_ID not set");
  const location =
    process.env.GEMINI_TRANSLATION_LOCATION ??
    process.env.GOOGLE_CLOUD_LOCATION ??
    "us-central1";

  const auth = new GoogleAuth({
    credentials: JSON.parse(credJson),
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  const url =
    `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}` +
    `/locations/${location}/publishers/google/models/${VERTEX_MODEL}:generateContent`;

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
        const err = new Error(`Vertex AI ${VERTEX_MODEL} ${res.status}: ${text}`);
        err.status = res.status;
        throw err;
      }
      return res.json();
    },
  };
}

function buildStringMapSchema(keys) {
  const properties = {};
  for (const k of keys) properties[k] = { type: "string" };
  return {
    type: "object",
    properties,
    required: keys,
    propertyOrdering: keys,
  };
}

function isRetryable(err) {
  const status = err && typeof err === "object" ? err.status : undefined;
  return status === 429 || status === 500 || status === 503;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Helpers ─────────────────────────────────────────────────────────────

function loadLocaleMeta(locale) {
  const path = join(LANGS_DIR, `${locale}.json`);
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    fatal(`Unknown locale "${locale}" — no ${path}`);
  }
  return JSON.parse(raw);
}

function estimateCost(inputTokens, outputTokens) {
  return (
    (inputTokens / 1_000_000) * PRICE_PER_M_INPUT_USD +
    (outputTokens / 1_000_000) * PRICE_PER_M_OUTPUT_USD
  );
}

function truncate(s, n) {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

function fatal(message) {
  console.error("✖", message);
  process.exit(1);
}
