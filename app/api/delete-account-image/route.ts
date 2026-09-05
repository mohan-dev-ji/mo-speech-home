import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";
import { deleteFile, isConfigured } from "@/lib/r2-storage";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * THE ONLY ROUTE IN THE PRODUCT THAT DELETES AN IMAGE OBJECT FROM R2 (MOS-52).
 * Every other delete surface — symbol, category, group, list, sentence, module
 * uninstall — removes the placement and leaves the object alone, so the image
 * stays listed in My Images. This is the deliberate way out of that library.
 *
 * Flow, the same shape as `app/api/delete-profile-symbol/route.ts`:
 *   1. Clerk auth gate (401 without a userId or a Convex token).
 *   2. `accountImages.deleteIfUnused` — ownership check, "is anything still
 *      using this key" check, then the row + its stale credit row. It returns
 *      the key to remove; we never trust the key from the request body for the
 *      R2 delete, only the one the mutation actually de-listed.
 *   3. Delete that one object from R2, best-effort. A failure here is logged
 *      and reported as `fileDeleted: false` but does NOT fail the response:
 *      the row is already gone, the user's view is already correct, and a
 *      leftover object is a recoverable orphan the sweep can find later.
 *      Failing the response would tell the user nothing happened when the
 *      library entry has in fact disappeared.
 *
 * Returns `{ imageKey, fileDeleted }`.
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

  let body: { imageKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const imageKey = body.imageKey;
  if (!imageKey || typeof imageKey !== "string") {
    return NextResponse.json({ error: "Missing imageKey" }, { status: 400 });
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  convex.setAuth(token);

  // ── Step 1: de-list the image (and refuse if anything still uses it) ─────
  let deleted: { imageKey: string };
  try {
    deleted = await convex.mutation(api.accountImages.deleteIfUnused, {
      imageKey,
    });
  } catch (e: unknown) {
    // Same detection as `app/api/delete-content/route.ts`: a ConvexError
    // arrives with its structured `data` intact through ConvexHttpClient, so
    // the code is read from there rather than pattern-matched on a message.
    if (
      e instanceof ConvexError &&
      typeof e.data === "object" &&
      e.data !== null &&
      "code" in e.data
    ) {
      const data = e.data as { code: string; count?: number };
      if (data.code === "IN_USE") {
        // 409, not 403: the request is well-formed and the caller is allowed
        // to make it — it conflicts with the current state, and the count is
        // what the UI needs to say so.
        return NextResponse.json(
          { error: "in_use", count: data.count ?? 0 },
          { status: 409 }
        );
      }
      if (data.code === "NOT_FOUND") {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      // `NOT_PERSONAL` falls through to the 500 below on purpose, unmapped.
      // It is unreachable by construction: the only writers of `accountImages`
      // rows are the backfill and the imagen route, and both write keys under
      // `accounts/`. A `NOT_PERSONAL` here means one of those writers put a
      // non-personal key in the table — an upstream write bug, not a
      // retryable client state — so "try again" (the UI's generic failure
      // copy) is the honest message even though it can't actually help.
    }
    // A plain `Error("Unauthenticated")` (thrown by `requireCallerAccountId`,
    // not a `ConvexError`) also lands here. The repo convention for a plain
    // Convex-thrown error is `includes()`, never `endsWith()` — the message
    // arrives wrapped with a stack frame, so an exact/suffix match misses it.
    if (
      !(e instanceof ConvexError) &&
      e instanceof Error &&
      e.message.includes("Unauthenticated")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[delete-account-image] mutation failed", e);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  // ── Step 2: the R2 object. Best-effort — see the docblock. ───────────────
  let fileDeleted = true;
  try {
    await deleteFile(deleted.imageKey);
  } catch (e) {
    fileDeleted = false;
    console.error("[delete-account-image] R2 delete failed:", e);
  }

  return NextResponse.json({ imageKey: deleted.imageKey, fileDeleted });
}
