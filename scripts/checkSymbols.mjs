/**
 * Quick diagnostic — checks whether the symbols table has been seeded
 * and whether "hello" is findable via the by_words_eng index.
 *
 * Run with:
 *   node --env-file=.env.local scripts/checkSymbols.mjs
 */

import { ConvexHttpClient } from "convex/browser";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  console.error("❌ NEXT_PUBLIC_CONVEX_URL not set");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);
console.log(`🔗 ${CONVEX_URL}\n`);

const words = ["hello", "Hello", "goodbye", "yes", "no"];
const results = await client.query("symbols:getSymbolsByWords", { words });

if (results.length === 0) {
  console.log("❌ No symbols found — table may be empty or seed hasn't run.");
} else {
  console.log(`✅ Found ${results.length} symbol(s):`);
  for (const s of results) {
    console.log(`  word="${s.words.eng}"  audio="${s.audio.eng.default}"`);
  }
}
