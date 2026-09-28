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
 *   key  — R2 destination key (must match accounts/{accountId}/(images|audio)/...,
 *          where accountId is the host account for a collaborator)
 *
 * Returns: { key } on success.
 *
 * The key path is locked to the authenticated caller's own account so a client
 * can't write into another user's prefix. `images/` keys require Max and
 * `audio/` keys require any paid plan (FEAT-108); otherwise 403.
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
  // `getMyAccess` resolves the caller from the Clerk token set above, and
  // resolves a collaborator to the HOST account — the same account the client
  // builds its keys under (MOS-53).
  const access = await convex.query(api.users.getMyAccess, {});
  if (!access) {
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

  const allowed = new RegExp(`^accounts/${access.accountId}/(images|audio)/[^/]+$`);
  if (!allowed.test(key)) {
    return NextResponse.json({ error: "Invalid key path" }, { status: 400 });
  }

  const isImage = key.startsWith(`accounts/${access.accountId}/images/`);
  // `tier` alone isn't enough: getMyAccess derives it from the plan whatever the
  // status, so a lapsed Max still reads "max". hasFullAccess folds in billing
  // status and custom grants (which getMyAccess already lifts to tier "max").
  const isMax = access.tier === "max" && access.hasFullAccess;
  if (isImage && !isMax) {
    return NextResponse.json({ error: "max_tier_required" }, { status: 403 });
  }
  if (!isImage && !access.hasFullAccess) {
    // audio recording is a Pro feature (FEAT-108)
    return NextResponse.json({ error: "pro_tier_required" }, { status: 403 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await uploadBuffer(key, buffer, file.type || "application/octet-stream");

  return NextResponse.json({ key });
}
