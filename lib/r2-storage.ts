import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
export const bucketName = process.env.R2_BUCKET_NAME;

export const r2Client =
  accountId && accessKeyId && secretAccessKey
    ? new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      })
    : null;

export function isConfigured(): boolean {
  return !!(r2Client && bucketName);
}

export async function fileExists(key: string): Promise<boolean> {
  if (!r2Client || !bucketName) return false;
  try {
    await r2Client.send(
      new HeadObjectCommand({ Bucket: bucketName, Key: key })
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns a pre-signed URL for private R2 assets.
 * Default expiry: 5 minutes.
 *
 * For audio/playback: use a 302 redirect (see app/api/assets/route.ts)
 * to preserve the browser user-gesture chain for audio.play().
 */
export async function getSignedFileUrl(
  key: string,
  expiresIn = 300
): Promise<string> {
  if (!r2Client || !bucketName) throw new Error("R2 not configured");
  const command = new GetObjectCommand({ Bucket: bucketName, Key: key });
  return getSignedUrl(r2Client, command, { expiresIn });
}

/**
 * Every key we write is UUID-based and content-addressed — a given key's bytes
 * never change once written (symbol images, TTS clips, the AI image cache).
 * So the object can be cached by the browser indefinitely, which is what stops
 * a board re-downloading every tile and clip on each visit.
 *
 * `private`, not `public`: these are fetched through pre-signed URLs and are
 * per-user data under licence (SymbolStix) — a shared proxy must never store
 * them. `private` still allows the requesting browser to cache.
 *
 * Objects written before this was added carry no Cache-Control and will keep
 * re-downloading until they are rewritten.
 */
const IMMUTABLE_CACHE_CONTROL = "private, max-age=31536000, immutable";

export async function uploadBuffer(
  key: string,
  buffer: Buffer | Uint8Array,
  contentType: string,
  cacheControl: string = IMMUTABLE_CACHE_CONTROL
): Promise<void> {
  if (!r2Client || !bucketName) throw new Error("R2 not configured");
  await r2Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: cacheControl,
    })
  );
}

export async function getFile(
  key: string
): Promise<{ buffer: Uint8Array; contentType: string }> {
  if (!r2Client || !bucketName) throw new Error("R2 not configured");
  const response = await r2Client.send(
    new GetObjectCommand({ Bucket: bucketName, Key: key })
  );
  const buffer = await response.Body!.transformToByteArray();
  return { buffer, contentType: response.ContentType ?? "application/octet-stream" };
}

/**
 * Delete an R2 object. Used by reload-category-defaults to clean up an
 * instructor's personal uploads/recordings/image-search picks. Shared caches
 * (ai-cache/, audio/<voice>/tts/) are NEVER passed here — they're reusable
 * across users and represent real regen cost.
 */
export async function deleteFile(key: string): Promise<void> {
  if (!r2Client || !bucketName) throw new Error("R2 not configured");
  await r2Client.send(
    new DeleteObjectCommand({ Bucket: bucketName, Key: key })
  );
}
