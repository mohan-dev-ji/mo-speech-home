/**
 * Seed script — transforms MVP symbolstix-metadata.json to the new schema
 * and inserts all symbols into the mo-speech-home Convex project.
 *
 * Run with:
 *   node --env-file=.env.local scripts/seedSymbols.mjs
 *
 * Source: mo-speech-mvp-2.0/scripts/symbolstix-metadata.json
 *
 * Schema differences vs MVP:
 *   word          → words.eng
 *   synonyms[]    → synonyms.eng[]
 *   audioPath     → audio.eng.default
 *   categories[]  → categories[] + tags[] (same values)
 */

import { ConvexHttpClient } from "convex/browser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  console.error("❌ NEXT_PUBLIC_CONVEX_URL not set — run with: node --env-file=.env.local scripts/seedSymbols.mjs");
  process.exit(1);
}

const METADATA_PATH = path.join(
  __dirname,
  "../../Mo_Speech/_code/mo-speech-mvp-2.0/scripts/symbolstix-metadata.json"
);

if (!fs.existsSync(METADATA_PATH)) {
  console.error(`❌ Metadata file not found at: ${METADATA_PATH}`);
  process.exit(1);
}

const BATCH_SIZE = 300;

const client = new ConvexHttpClient(CONVEX_URL);

console.log(`🔗 Convex: ${CONVEX_URL}\n`);
console.log("📖 Reading metadata...");

const raw = JSON.parse(fs.readFileSync(METADATA_PATH, "utf8"));
console.log(`✅ Loaded ${raw.length} symbols\n`);

// Transform to new schema
const symbols = raw.map((item) => ({
  words: { eng: item.word.trim() },
  synonyms: item.synonyms?.length ? { eng: item.synonyms } : undefined,
  imagePath: item.imagePath,
  audio: { eng: { default: item.audioPath } },
  tags: item.categories ?? [],
  categories: item.categories ?? [],
  priority: item.priority ?? undefined,
}));

console.log(`📦 Inserting in batches of ${BATCH_SIZE}...`);

let total = 0;
const batchCount = Math.ceil(symbols.length / BATCH_SIZE);

for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
  const batch = symbols.slice(i, i + BATCH_SIZE);
  const batchNum = Math.floor(i / BATCH_SIZE) + 1;

  try {
    const result = await client.mutation("symbols:batchInsertSymbols", { symbols: batch });
    total += result.count;
    console.log(`  ✓ Batch ${batchNum}/${batchCount}: ${result.count} inserted (total: ${total})`);
  } catch (err) {
    console.error(`  ❌ Batch ${batchNum} failed:`, err.message);
    throw err;
  }
}

console.log(`\n🎉 Done — ${total} symbols seeded.`);
