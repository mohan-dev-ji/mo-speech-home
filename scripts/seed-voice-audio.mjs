/**
 * Phase 8.4 — bulk pre-generate per-voice SymbolStix audio.
 *
 * For one voice, synthesises every symbol's word (in that voice's language)
 * via Google Cloud TTS and uploads the MP3 to R2 under the voice-first
 * convention, then flips `symbols.audio[voiceId] = true` so playback resolves
 * the seeded path instead of falling through to on-demand TTS.
 *
 * Run with (Node 20+):
 *   node --env-file=.env.local scripts/seed-voice-audio.mjs --voice en-GB-News-G --dry-run
 *   node --env-file=.env.local scripts/seed-voice-audio.mjs --voice en-GB-News-G
 *
 * Flags:
 *   --voice <ttsVoiceId>   (required) e.g. en-GB-News-G
 *   --dry-run              count symbols + estimate cost; no TTS / R2 / DB writes
 *   --limit <n>            process only the first n symbols (smoke test)
 *   --concurrency <n>      parallel synth+upload workers (default 4)
 *   --delay <ms>           pause between starting workers (default 0)
 *
 * ── Path convention (MUST match lib/audio/resolveAudioPath.ts) ──
 *   Key:    audio/<voiceId>/symbols/<words.en>.mp3
 *   The R2 FILENAME is ALWAYS the English word (`words.en`) — the stable
 *   cross-language identifier. The SPOKEN TEXT is `words[lang]` for the voice's
 *   language. For an English voice these are identical; for a future Spanish
 *   voice the file `.../symbols/dog.mp3` would contain the audio "perro".
 *
 * ── Idempotent / resumable ──
 *   Skips any symbol whose R2 file already exists. Re-run to resume after an
 *   interruption. Only flips the DB flag for symbols whose file is present and
 *   whose flag isn't already set.
 *
 * ── NOT for en-GB-News-M ──
 *   The legacy male voice lives at audio/eng/default/<basename>.mp3 and the
 *   resolver routes it there — a new-convention upload would never be read.
 *   The script refuses that voice.
 *
 * Backup BEFORE running (per CLAUDE.md — this flips a field on ~58k rows):
 *   node --env-file=.env.local scripts/backup-symbols.mjs "phase-8-4-en-female"
 *   npx convex export --path backups/<date>-phase-8-4.zip
 */

import { ConvexHttpClient } from "convex/browser";
import { S3Client, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { GoogleAuth } from "google-auth-library";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Voice → language map. Mirrors TTS_VOICES in lib/r2-paths.ts. Voice-id
//    parsing is forbidden (ADR-009 §4), so the mapping is explicit here too.
const VOICE_LANG = {
  "en-GB-News-M": { languageCode: "en-GB", lang: "en", legacy: true },
  "en-GB-News-G": { languageCode: "en-GB", lang: "en" },
  // Phase 8.4 (Spanish) — synthesise words.es; filename stays words.en.
  "es-US-Wavenet-C": { languageCode: "es-US", lang: "es" }, // male
  "es-US-Wavenet-A": { languageCode: "es-US", lang: "es" }, // female
};

const LEGACY_VOICE_ID = "en-GB-News-M";

// ── Args ──
const argv = process.argv.slice(2);
const hasFlag = (n) => argv.includes(n);
const getOpt = (n, def) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};

const VOICE_ID = getOpt("--voice", null);
const DRY_RUN = hasFlag("--dry-run");
// Flags-only: skip all TTS/R2 work and just set audio[voiceId]=true for symbols
// that aren't flagged yet. Use to repair the DB flag after a run where the
// uploads succeeded but the flag-flip failed. Assumes the R2 files exist.
const FLAGS_ONLY = hasFlag("--flags-only");
const LIMIT = getOpt("--limit", null) ? Number(getOpt("--limit")) : null;
const CONCURRENCY = Number(getOpt("--concurrency", "4"));
const DELAY_MS = Number(getOpt("--delay", "0"));
const PAGE_SIZE = 2000;
// Convex caps array args at 8192; keep batches well under that AND small enough
// that each setVoiceSeededBatch transaction (1 get + 1 patch per id) stays light.
const FLAG_BATCH = 1000;
const NEEDS_AUDIO_DEPS = !DRY_RUN && !FLAGS_ONLY; // GCP + R2 only needed for real synth/upload

// ── Validation ──
if (!VOICE_ID) {
  console.error("❌ --voice <ttsVoiceId> is required (e.g. --voice en-GB-News-G)");
  process.exit(1);
}
if (VOICE_ID === LEGACY_VOICE_ID) {
  console.error(
    `❌ ${LEGACY_VOICE_ID} is the legacy voice — its audio lives at audio/eng/default/ and the resolver reads it there. Do not re-seed it under the new convention.`,
  );
  process.exit(1);
}
const voiceMeta = VOICE_LANG[VOICE_ID];
if (!voiceMeta) {
  console.error(`❌ Unknown voice "${VOICE_ID}". Add it to VOICE_LANG (and TTS_VOICES in lib/r2-paths.ts) first.`);
  process.exit(1);
}
const { languageCode, lang } = voiceMeta;

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const credJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const r2 = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucketName: process.env.R2_BUCKET_NAME,
};

if (!CONVEX_URL) {
  console.error("❌ NEXT_PUBLIC_CONVEX_URL not set — run with: node --env-file=.env.local ...");
  process.exit(1);
}
if (NEEDS_AUDIO_DEPS && !credJson) {
  console.error("❌ GOOGLE_SERVICE_ACCOUNT_JSON not set (required for synthesis).");
  process.exit(1);
}
if (NEEDS_AUDIO_DEPS && (!r2.accountId || !r2.accessKeyId || !r2.secretAccessKey || !r2.bucketName)) {
  console.error("❌ Missing R2 env vars (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME).");
  process.exit(1);
}

// ── Clients ──
const convex = new ConvexHttpClient(CONVEX_URL);

const s3 = !NEEDS_AUDIO_DEPS
  ? null
  : new S3Client({
      region: "auto",
      endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
    });

const googleAuth = !NEEDS_AUDIO_DEPS
  ? null
  : new GoogleAuth({
      credentials: JSON.parse(credJson),
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
let googleClient = null;

// ── Helpers ──

/** R2 key — MUST match resolveSymbolAudioPath for non-legacy voices. */
const symbolKey = (englishWord) => `audio/${VOICE_ID}/symbols/${englishWord}.mp3`;

async function fileExists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: r2.bucketName, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function synthesise(text) {
  if (!googleClient) googleClient = await googleAuth.getClient();
  const { token } = await googleClient.getAccessToken(); // cached + auto-refreshed
  const res = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode, name: VOICE_ID },
      audioConfig: { audioEncoding: "MP3", speakingRate: 1.0 },
    }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}: ${await res.text()}`);
  const { audioContent } = await res.json();
  return Buffer.from(audioContent, "base64");
}

async function uploadMp3(key, buffer) {
  await s3.send(
    new PutObjectCommand({ Bucket: r2.bucketName, Key: key, Body: buffer, ContentType: "audio/mpeg" }),
  );
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Load all symbols (paginated) ──
console.log(`🔗 Convex: ${CONVEX_URL}`);
console.log(`🎙️  Voice: ${VOICE_ID} (languageCode=${languageCode}, words.${lang})${DRY_RUN ? "  [DRY RUN]" : ""}\n`);
console.log("📖 Loading symbols...");

/** @type {{ id: string, englishWord: string, spoken: string, seededFlag: boolean }[]} */
const items = [];
let cursor = null;
let scanned = 0;
let skippedNoWord = 0;

while (true) {
  const page = await convex.query("symbols:dumpSymbolsPage", { cursor, pageSize: PAGE_SIZE });
  for (const sym of page.symbols) {
    scanned += 1;
    const englishWord = (sym.words?.en ?? "").trim(); // filename basis (stable key)
    const spoken = (sym.words?.[lang] ?? "").trim(); // spoken text in the voice's language
    if (!englishWord || !spoken) {
      skippedNoWord += 1;
      continue;
    }
    const audioMap = sym.audio && typeof sym.audio === "object" ? sym.audio : {};
    items.push({
      id: sym._id,
      englishWord,
      spoken,
      seededFlag: audioMap[VOICE_ID] === true,
    });
    if (LIMIT && items.length >= LIMIT) break;
  }
  if (LIMIT && items.length >= LIMIT) break;
  if (page.isDone) break;
  cursor = page.nextCursor;
}

console.log(`✅ Scanned ${scanned} symbols — ${items.length} have words.${lang}, ${skippedNoWord} skipped (no word).\n`);

// ── Dry run: report estimate and stop ──
if (DRY_RUN) {
  const totalChars = items.reduce((sum, it) => sum + it.spoken.length, 0);
  // WaveNet/News tier ≈ $16 / 1M chars.
  const estUsd = (totalChars / 1_000_000) * 16;
  console.log("🧪 DRY RUN — no audio generated.");
  console.log(`   would synthesise : ${items.length} clips`);
  console.log(`   total characters : ${totalChars.toLocaleString()}`);
  console.log(`   est. TTS cost    : ~$${estUsd.toFixed(2)} (at ~$16/M chars; existing files would be skipped on a real run)`);
  console.log(`   already flagged  : ${items.filter((i) => i.seededFlag).length}`);
  process.exit(0);
}

// ── Real run: synth + upload + flip flag (concurrency-limited, resumable) ──
let uploaded = 0;
let skippedExisting = 0;
let failed = 0;
const errors = [];
const flagBuffer = []; // symbol ids whose file is present but flag not yet set

// Drains the flag buffer in FLAG_BATCH-sized chunks (each well under Convex's
// 8192 array-arg limit). `force` drains it completely; otherwise it only sends
// while at least one full batch is queued, so the buffer can't grow unbounded.
async function flushFlags(force = false) {
  while (flagBuffer.length > 0 && (force || flagBuffer.length >= FLAG_BATCH)) {
    const batch = flagBuffer.splice(0, FLAG_BATCH);
    try {
      await convex.mutation("symbols:setVoiceSeededBatch", { symbolIds: batch, voiceId: VOICE_ID });
    } catch (err) {
      errors.push({ kind: "flag-batch", size: batch.length, message: err.message });
      console.error(`  ❌ flag batch (${batch.length}) failed: ${err.message}`);
    }
  }
}

// ── Flags-only repair: mark every not-yet-flagged symbol seeded, no R2/TTS ──
if (FLAGS_ONLY) {
  const need = items.filter((it) => !it.seededFlag);
  console.log(`🏷️  Flags-only — setting audio[${VOICE_ID}]=true for ${need.length} symbol(s) (${items.length - need.length} already flagged). No R2/TTS.\n`);
  for (const it of need) flagBuffer.push(it.id);
  await flushFlags(true);
  if (errors.length) {
    console.error(`\n❌ ${errors.length} flag batch(es) failed — re-run --flags-only to retry.`);
    process.exit(1);
  }
  console.log(`✅ Flagged ${need.length} symbol(s) for ${VOICE_ID}.`);
  process.exit(0);
}

async function processOne(it) {
  const key = symbolKey(it.englishWord);
  try {
    if (await fileExists(key)) {
      skippedExisting += 1;
      if (!it.seededFlag) flagBuffer.push(it.id); // file present but flag missing → set it
      return;
    }
    const buffer = await synthesise(it.spoken);
    await uploadMp3(key, buffer);
    uploaded += 1;
    if (!it.seededFlag) flagBuffer.push(it.id);
  } catch (err) {
    failed += 1;
    errors.push({ id: it.id, word: it.englishWord, message: err.message });
    if (failed <= 20) console.error(`  ❌ ${it.englishWord}: ${err.message}`);
  }
}

console.log(`🚀 Processing ${items.length} symbols (concurrency=${CONCURRENCY})...\n`);

let cursorIdx = 0;
async function worker() {
  while (cursorIdx < items.length) {
    const i = cursorIdx++;
    await processOne(items[i]);
    if (DELAY_MS) await sleep(DELAY_MS);
    const done = uploaded + skippedExisting + failed;
    if (done % 500 === 0) {
      console.log(`  … ${done}/${items.length}  (uploaded ${uploaded}, skipped ${skippedExisting}, failed ${failed})`);
      await flushFlags(); // periodic flush keeps the buffer bounded
    }
  }
}

await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, () => worker()));
await flushFlags(true);

// ── Report ──
console.log(`\n🎉 Done — voice ${VOICE_ID}`);
console.log(`   uploaded        : ${uploaded}`);
console.log(`   skipped (exists): ${skippedExisting}`);
console.log(`   failed          : ${failed}`);

if (errors.length) {
  const errPath = path.join(__dirname, `seed-voice-audio-errors.${VOICE_ID}.json`);
  fs.writeFileSync(errPath, JSON.stringify(errors, null, 2));
  console.log(`   ⚠️  ${errors.length} errors written to ${errPath} — re-run to retry (idempotent).`);
  process.exit(1);
}
