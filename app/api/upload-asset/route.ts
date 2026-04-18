import { auth } from "@clerk/nextjs/server";
import { uploadBuffer, isConfigured } from "@/lib/r2-storage";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Upload a profile asset to R2.
 * Accepts: multipart/form-data with fields:
 *   file — the binary file
 *   key  — R2 destination key (must start with "profiles/")
 *
 * Returns: { key } on success.
 *
 * Key is validated to start with "profiles/" to prevent path traversal.
 * Auth required — only logged-in users may upload.
 */
export async function POST(request: Request) {
  if (!isConfigured()) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  const key = formData.get("key");

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (!key || typeof key !== "string") {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }
  if (!key.startsWith("profiles/")) {
    return NextResponse.json({ error: "Invalid key path" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await uploadBuffer(key, buffer, file.type || "application/octet-stream");

  return NextResponse.json({ key });
}
