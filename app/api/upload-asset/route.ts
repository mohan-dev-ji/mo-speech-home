import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { uploadBuffer, isConfigured } from "@/lib/r2-storage";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Upload a user-content asset to R2.
 * Accepts: multipart/form-data with fields:
 *   file — the binary file
 *   key  — R2 destination key (must match accounts/{callerUsersId}/(images|audio)/...)
 *
 * Returns: { key } on success.
 *
 * The key path is locked to the authenticated caller's own account so a client
 * can't write into another user's prefix.
 */
export async function POST(request: Request) {
  if (!isConfigured()) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await getToken({ template: "convex" });
  if (!token) {
    return NextResponse.json({ error: "Missing Convex token" }, { status: 401 });
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  convex.setAuth(token);
  const user = await convex.query(api.users.getUserByClerkId, { clerkUserId: userId });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
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

  const allowed = new RegExp(`^accounts/${user._id}/(images|audio)/[^/]+$`);
  if (!allowed.test(key)) {
    return NextResponse.json({ error: "Invalid key path" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await uploadBuffer(key, buffer, file.type || "application/octet-stream");

  return NextResponse.json({ key });
}
