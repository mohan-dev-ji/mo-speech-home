/**
 * Count and list R2 objects under a prefix.
 *
 * WHY THIS EXISTS: the Cloudflare dashboard shows date-modified but no object
 * count, so a newly written object is invisible among a hundred others and a
 * deleted one is impossible to confirm gone. Every delete-path bug in this
 * repo (MOS-44, MOS-50, the phase-31 deleteCategory finding) is only provable
 * by counting before and after.
 *
 * Read-only. There is no delete path in this file, deliberately.
 *
 *   source ~/.nvm/nvm.sh && nvm use 20.17.0
 *   node --env-file=.env.local scripts/count-r2-objects.mjs accounts/<accountId>/images/
 *   node --env-file=.env.local scripts/count-r2-objects.mjs accounts/<accountId>/ --list=20
 *
 * Typical use, proving a delete actually deleted:
 *   1. run it, note the count
 *   2. do the thing in the app
 *   3. run it again — the count must move by exactly what you expect
 */
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const prefix = process.argv[2];
if (!prefix) {
  console.error("usage: node --env-file=.env.local scripts/count-r2-objects.mjs <prefix> [--list=N]");
  process.exit(1);
}
const listArg = process.argv.find((a) => a.startsWith("--list="));
const listN = listArg ? Number(listArg.slice("--list=".length)) : 5;

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// Paginate — ListObjectsV2 caps at 1000 keys per call, and an account with a
// full library will exceed that. A truncated count is worse than no count.
let ContinuationToken;
const all = [];
do {
  const out = await s3.send(
    new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET_NAME, Prefix: prefix, ContinuationToken })
  );
  all.push(...(out.Contents ?? []));
  ContinuationToken = out.IsTruncated ? out.NextContinuationToken : undefined;
} while (ContinuationToken);

const bytes = all.reduce((n, o) => n + (o.Size ?? 0), 0);
console.log(`prefix: ${prefix}`);
console.log(`TOTAL OBJECTS: ${all.length}`);
console.log(`total size:    ${(bytes / 1024 / 1024).toFixed(2)} MB`);

if (all.length > 0) {
  console.log(`\n${Math.min(listN, all.length)} most recently modified:`);
  all
    .sort((a, b) => b.LastModified - a.LastModified)
    .slice(0, listN)
    .forEach((o) => {
      console.log(`  ${o.LastModified.toISOString()}  ${((o.Size ?? 0) / 1024).toFixed(1).padStart(8)} KB  ${o.Key}`);
    });
}
