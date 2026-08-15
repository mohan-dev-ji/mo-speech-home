/**
 * Verify every symbol flagged seeded for a voice has its modern-convention R2
 * object (audio/<voice>/symbols/<words.en>.mp3). The cutover gate for phase-20.
 *
 * Run (Node 20+):
 *   node --env-file=.env.local scripts/verify-voice-seeded.mjs --voice en-GB-News-M
 *
 * Exit 0 + "0 missing" means it is safe to flip the resolver. Any missing keys
 * are written to scripts/verify-voice-seeded-missing.<voice>.json.
 */
import { ConvexHttpClient } from "convex/browser";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const getOpt = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const VOICE_ID = getOpt("--voice", null);
const CONCURRENCY = Number(getOpt("--concurrency", "8"));
const PAGE_SIZE = 2000;

if (!VOICE_ID) {
  console.error("❌ --voice <ttsVoiceId> required");
  process.exit(1);
}
const r2 = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucketName: process.env.R2_BUCKET_NAME,
};
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL || !r2.accountId || !r2.accessKeyId || !r2.secretAccessKey || !r2.bucketName) {
  console.error("❌ Missing env (NEXT_PUBLIC_CONVEX_URL + R2_*). Run with node --env-file=.env.local");
  process.exit(1);
}
const convex = new ConvexHttpClient(CONVEX_URL);
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
});

// Collect every symbol flagged seeded for VOICE_ID, with its words.en. Several
// symbols can share one words.en (and therefore one R2 object), so the HEAD set
// is deduped by key — the report still names every affected symbol.
const targets = [];
const noWordSymbols = [];
let cursor = null;
let scanned = 0;
while (true) {
  const page = await convex.query("symbols:dumpSymbolsPage", { cursor, pageSize: PAGE_SIZE });
  for (const sym of page.symbols) {
    scanned++;
    const audioMap = sym.audio && typeof sym.audio === "object" ? sym.audio : {};
    if (audioMap[VOICE_ID] !== true) continue;
    const word = (sym.words?.en ?? "").trim();
    if (!word) {
      noWordSymbols.push(sym._id); // flagged but no words.en — reported separately
      continue;
    }
    targets.push({ id: sym._id, key: `audio/${VOICE_ID}/symbols/${word}.mp3`, word });
  }
  if (page.isDone) break;
  cursor = page.nextCursor;
}

const byKey = new Map();
for (const t of targets) {
  if (!byKey.has(t.key)) byKey.set(t.key, []);
  byKey.get(t.key).push(t.id);
}
const keys = [...byKey.keys()];
console.log(
  `scanned ${scanned} · flagged-seeded ${targets.length} · unique keys ${keys.length}` +
    (noWordSymbols.length ? ` · ${noWordSymbols.length} flagged but NO words.en (investigate)` : ""),
);

// HEAD each expected key.
const missing = [];
let idx = 0;
let checked = 0;
async function exists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: r2.bucketName, Key: key }));
    return true;
  } catch {
    return false;
  }
}
async function worker() {
  while (idx < keys.length) {
    const key = keys[idx++];
    if (!(await exists(key))) missing.push({ key, symbolIds: byKey.get(key) });
    if (++checked % 2000 === 0) console.log(`  … ${checked}/${keys.length} (missing so far ${missing.length})`);
  }
}
await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, () => worker()));

if (missing.length || noWordSymbols.length) {
  const p = path.join(__dirname, `verify-voice-seeded-missing.${VOICE_ID}.json`);
  fs.writeFileSync(p, JSON.stringify({ missing, flaggedWithoutEnglishWord: noWordSymbols }, null, 2));
  if (missing.length) {
    console.error(
      `\n❌ ${missing.length} MISSING objects — written to ${p}. Re-run the seed, then re-verify. Do NOT flip the resolver.`,
    );
    process.exit(1);
  }
  console.error(
    `\n❌ ${noWordSymbols.length} symbols are flagged seeded but have no words.en — written to ${p}. They cannot have a modern-convention filename. Resolve before flipping the resolver.`,
  );
  process.exit(1);
}
console.log(
  `\n✅ 0 missing — every flagged-seeded ${VOICE_ID} symbol has its audio/${VOICE_ID}/symbols/… object. Safe to flip the resolver.`,
);
