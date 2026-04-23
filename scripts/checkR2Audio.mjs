/**
 * Checks whether SymbolStix audio files exist in the configured R2 bucket.
 *
 * Run with:
 *   node --env-file=.env.local scripts/checkR2Audio.mjs
 */

import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;

if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
  console.error("❌ Missing R2 env vars (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME)");
  process.exit(1);
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

console.log(`🪣 Bucket: ${bucketName}\n`);

const keys = [
  "audio/eng/default/hello.mp3",
  "audio/eng/default/symbol00081951.mp3",
  "audio/eng/default/yes.mp3",
  "audio/eng/default/no.mp3",
];

for (const key of keys) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
    console.log(`  ✅ ${key}`);
  } catch {
    console.log(`  ❌ ${key}  (not found)`);
  }
}
