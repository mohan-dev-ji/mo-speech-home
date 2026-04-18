import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
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

export async function uploadBuffer(
  key: string,
  buffer: Buffer | Uint8Array,
  contentType: string
): Promise<void> {
  if (!r2Client || !bucketName) throw new Error("R2 not configured");
  await r2Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
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
