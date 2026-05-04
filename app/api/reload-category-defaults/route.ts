import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { deleteFile, isConfigured } from "@/lib/r2-storage";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Orchestrates Reload Defaults for a single profileCategory.
 *
 * Flow:
 *   1. Clerk auth gate (401 if no userId).
 *   2. Fetch the personal R2 keys to delete (uploads, recordings, image-search
 *      picks) via getCategoryReloadOrphanKeys. Skips shared caches (ai-cache/,
 *      audio/<voice>/tts/) — these are reusable across users.
 *   3. Run the DB transaction (reloadCategoryFromLibrary): replace symbols,
 *      patch category-level fields back to snapshot. Atomic.
 *   4. Delete R2 objects in parallel via Promise.allSettled. Failures are
 *      logged but don't fail the response — the DB state is already correct
 *      and orphan accumulation is recoverable later.
 *
 * Returns: { symbolsAdded, symbolsSkipped, filesDeleted, filesFailed }
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

  let body: { profileCategoryId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const profileCategoryId = body.profileCategoryId as
    | Id<"profileCategories">
    | undefined;
  if (!profileCategoryId) {
    return NextResponse.json(
      { error: "Missing profileCategoryId" },
      { status: 400 }
    );
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  convex.setAuth(token);

  // Step 1: collect personal R2 keys before the mutation deletes the symbol rows.
  let orphanKeys: string[];
  try {
    orphanKeys = await convex.query(
      api.profileCategories.getCategoryReloadOrphanKeys,
      { profileCategoryId }
    );
  } catch (e) {
    console.error("[reload-defaults] orphan-keys query failed", e);
    return NextResponse.json(
      { error: "Could not read category state" },
      { status: 500 }
    );
  }

  // Step 2: run the DB transaction.
  let mutationResult: { symbolsAdded: number; symbolsSkipped: number };
  try {
    mutationResult = await convex.mutation(
      api.profileCategories.reloadCategoryFromLibrary,
      { profileCategoryId }
    );
  } catch (e: unknown) {
    if (e instanceof ConvexError && typeof e.data === "object" && e.data !== null && "code" in e.data) {
      const code = (e.data as { code: string }).code;
      const status =
        code === "NOT_FOUND"
          ? 404
          : code === "NOT_FROM_LIBRARY"
            ? 400
            : code === "PACK_NOT_FOUND"
              ? 404
              : code === "SNAPSHOT_MISSING"
                ? 404
                : 500;
      return NextResponse.json({ error: code, code }, { status });
    }
    console.error("[reload-defaults] mutation failed", e);
    return NextResponse.json({ error: "Reload failed" }, { status: 500 });
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
      console.error("[reload-defaults] R2 delete failed:", r.reason);
    }
  }

  return NextResponse.json({
    symbolsAdded: mutationResult.symbolsAdded,
    symbolsSkipped: mutationResult.symbolsSkipped,
    filesDeleted,
    filesFailed,
  });
}
