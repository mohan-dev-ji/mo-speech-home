import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { deleteFile, isConfigured } from "@/lib/r2-storage";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Orchestrates deletion of a single profileSymbol with R2 cleanup.
 *
 * Flow:
 *   1. Clerk auth gate (401 if no userId).
 *   2. Fetch the personal R2 keys to delete (uploads, image-search picks,
 *      recorded audio) via getProfileSymbolDeleteOrphanKeys. Skips
 *      shared caches (ai-cache/ and audio/<voice>/tts/) — those are
 *      reusable across users.
 *   3. Run the DB mutation (deleteProfileSymbol). The mutation also
 *      handles pack-snapshot syncing when `propagateToPack` is true.
 *   4. Delete the R2 objects in parallel via Promise.allSettled.
 *      Failures are logged but don't fail the response — the DB state is
 *      already correct and orphan accumulation is recoverable later.
 *
 * Returns: { filesDeleted, filesFailed }
 */
export async function POST(request: Request) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Storage not configured" },
      { status: 503 }
    );
  }

  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await getToken({ template: "convex" });
  if (!token) {
    return NextResponse.json({ error: "Missing Convex token" }, { status: 401 });
  }

  let body: { profileSymbolId?: string; propagateToPack?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const profileSymbolId = body.profileSymbolId as
    | Id<"profileSymbols">
    | undefined;
  if (!profileSymbolId) {
    return NextResponse.json(
      { error: "Missing profileSymbolId" },
      { status: 400 }
    );
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  convex.setAuth(token);

  // Step 1: collect personal R2 keys before the mutation deletes the row.
  let orphanKeys: string[];
  try {
    orphanKeys = await convex.query(
      api.profileSymbols.getProfileSymbolDeleteOrphanKeys,
      { profileSymbolId }
    );
  } catch (e) {
    console.error("[delete-profile-symbol] orphan-keys query failed", e);
    return NextResponse.json(
      { error: "Could not read symbol state" },
      { status: 500 }
    );
  }

  // Step 2: delete the row.
  try {
    await convex.mutation(api.profileSymbols.deleteProfileSymbol, {
      profileSymbolId,
      propagateToPack: body.propagateToPack ?? false,
    });
  } catch (e) {
    console.error("[delete-profile-symbol] mutation failed", e);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  // Step 3: parallel R2 deletion. Best-effort — log and continue on failure.
  const deleteResults = await Promise.allSettled(
    orphanKeys.map((key) => deleteFile(key))
  );
  let filesDeleted = 0;
  let filesFailed = 0;
  for (const r of deleteResults) {
    if (r.status === "fulfilled") {
      filesDeleted++;
    } else {
      filesFailed++;
      console.error("[delete-profile-symbol] R2 delete failed:", r.reason);
    }
  }

  return NextResponse.json({ filesDeleted, filesFailed });
}
