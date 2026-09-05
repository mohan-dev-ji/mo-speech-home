import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { deleteFile, isConfigured } from "@/lib/r2-storage";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * THE delete route (phase 33 / MOS-41). Replaces `/api/uninstall-content-module`.
 *
 * Two things had to be true at once, and one route is how they both are:
 *
 * 1. **Every** content delete cleans up its personal R2 objects. Four client
 *    surfaces used to call a Convex mutation directly — categories, folders,
 *    lists and student profiles — and a mutation cannot touch R2, so their
 *    uploads, recordings and image-search picks were orphaned in silence.
 *    Wiring each of the four to its own new route would have re-created the
 *    very asymmetry that caused the bug: the next guard added to one route
 *    would silently not apply to the others.
 *
 * 2. **The word "uninstall" is gone.** Owner decision, 2026-08-29: an
 *    installed module can be personalised, so removing it destroys work and is
 *    a delete like any other. There is one verb in the product and one route
 *    behind it. "Uninstalling" an untouched module is just a delete that
 *    happens to lose nothing.
 *
 * THE THREE STEPS ARE ORDER-CRITICAL and are the reason this is a route at all:
 *
 *     1. collect the personal keys the delete will orphan   (query)
 *     2. delete the rows                                    (mutation)
 *     3. delete those objects from R2                       (best-effort)
 *
 * Step 1 must precede step 2: once the rows are gone there is nothing left to
 * read the keys from. Step 3 is best-effort by design — a failed R2 delete
 * leaves a stray object, while failing the whole request after the rows are
 * already deleted would leave the user staring at content that is half gone.
 *
 * WHAT IS NEVER DELETED, part 1: anything outside `accounts/` and `profiles/`.
 * `library_modules/`, `symbols/`, `ai-cache/` and the TTS cache cannot appear
 * in the list this route acts on — see the "PROMOTABLE ≠ PERSONAL" docblock in
 * `convex/lib/contentModuleDelete.ts`.
 *
 * WHAT IS NEVER DELETED, part 2 (phase 36): IMAGES. Every key collector this
 * route calls now filters delete candidates through `isPersonalAudioKey`, so
 * the list is personal voice recordings only. A content delete removes the
 * placement; the image object survives and stays listed in My Images, which
 * owns the single Delete in the product that removes an image from R2. That is
 * cost of recreation, not media type — a recording has no library to be seen
 * in, so leaving one behind would be an invisible leak. The one exception is
 * `studentProfiles.profilePhoto`, which still hard-deletes (owner decision);
 * see the `studentProfile` case in `convex/lib/personalAssetRefs.ts`.
 */

/** Removing everything one published module installed, addressed by slug.
 * Unchanged from the route this replaces. */
const MODULE_KINDS = {
  "category-module": {
    orphanKeys: api.contentModules.categories.getCategoryModuleDeleteOrphanKeys,
    remove: api.contentModules.categories.deleteCategoryModule,
  },
  "list-module": {
    orphanKeys: api.contentModules.lists.getListModuleDeleteOrphanKeys,
    remove: api.contentModules.lists.deleteListModule,
  },
  "sentence-module": {
    orphanKeys: api.contentModules.sentences.getSentenceModuleDeleteOrphanKeys,
    remove: api.contentModules.sentences.deleteSentenceModule,
  },
} as const;

type ModuleKind = keyof typeof MODULE_KINDS;

/** Removing ONE row the user owns, addressed by id. All four are new here;
 * each was previously a direct mutation call with no R2 cleanup at all.
 * `target` builds the discriminated arg for `contentDelete:getDeleteOrphanKeys`;
 * `args` maps the id onto whatever that mutation happens to call its
 * parameter — the names genuinely differ per table. */
const CONTENT_KINDS = {
  category: {
    target: (id: string) => ({
      kind: "category" as const,
      categoryId: id as Id<"profileCategories">,
    }),
    remove: api.profileCategories.deleteCategory,
    args: (id: string) => ({
      profileCategoryId: id as Id<"profileCategories">,
    }),
  },
  folder: {
    target: (id: string) => ({
      kind: "folder" as const,
      folderId: id as Id<"profileFolders">,
    }),
    remove: api.profileFolders.deleteFolder,
    args: (id: string) => ({ folderId: id as Id<"profileFolders"> }),
  },
  list: {
    target: (id: string) => ({
      kind: "list" as const,
      listId: id as Id<"profileLists">,
    }),
    remove: api.profileLists.deleteProfileList,
    args: (id: string) => ({ profileListId: id as Id<"profileLists"> }),
  },
  "student-profile": {
    target: (id: string) => ({
      kind: "studentProfile" as const,
      profileId: id as Id<"studentProfiles">,
    }),
    remove: api.studentProfiles.deleteStudentProfile,
    args: (id: string) => ({ profileId: id as Id<"studentProfiles"> }),
  },
} as const;

type ContentKind = keyof typeof CONTENT_KINDS;

function isModuleKind(k: string): k is ModuleKind {
  return k in MODULE_KINDS;
}
function isContentKind(k: string): k is ContentKind {
  return k in CONTENT_KINDS;
}

/**
 * Body:
 *   { kind: "category-module" | "list-module" | "sentence-module", slug }
 *   { kind: "category" | "folder" | "list" | "student-profile", id }
 *
 * Returns: { ...mutationResult, filesDeleted, filesFailed }
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

  let body: { kind?: string; slug?: string; id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const kind = body.kind;
  if (!kind || (!isModuleKind(kind) && !isContentKind(kind))) {
    return NextResponse.json({ error: "Missing or invalid kind" }, { status: 400 });
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  convex.setAuth(token);

  // ── Step 1: collect the personal keys BEFORE the rows are deleted ────────
  let orphanKeys: string[];
  let runDelete: () => Promise<Record<string, unknown>>;

  if (isModuleKind(kind)) {
    const slug = body.slug;
    if (!slug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }
    const fns = MODULE_KINDS[kind];
    try {
      orphanKeys = await convex.query(fns.orphanKeys, { slug });
    } catch (e) {
      console.error("[delete-content] orphan-keys query failed", kind, e);
      return NextResponse.json(
        { error: "Could not read content state" },
        { status: 500 }
      );
    }
    runDelete = () =>
      convex.mutation(fns.remove, { slug }) as Promise<Record<string, unknown>>;
  } else {
    const id = body.id;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const fns = CONTENT_KINDS[kind];
    try {
      orphanKeys = await convex.query(api.contentDelete.getDeleteOrphanKeys, {
        target: fns.target(id),
      });
    } catch (e) {
      console.error("[delete-content] orphan-keys query failed", kind, e);
      return NextResponse.json(
        { error: "Could not read content state" },
        { status: 500 }
      );
    }
    runDelete = () =>
      // Each mutation has its own arg name and its own return shape; the map
      // owns both so this call site stays uniform.
      convex.mutation(
        fns.remove,
        fns.args(id) as never
      ) as Promise<Record<string, unknown>>;
  }

  // ── Step 2: delete the rows ──────────────────────────────────────────────
  let mutationResult: Record<string, unknown>;
  try {
    mutationResult = (await runDelete()) ?? {};
  } catch (e: unknown) {
    if (
      e instanceof ConvexError &&
      typeof e.data === "object" &&
      e.data !== null &&
      "code" in e.data
    ) {
      const code = (e.data as { code: string }).code;
      const status = code === "NOT_INSTALLED" || code === "NOT_FOUND" ? 404 : 500;
      return NextResponse.json({ error: code, code }, { status });
    }
    console.error("[delete-content] mutation failed", kind, e);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  // ── Step 3: R2 deletion, best-effort ─────────────────────────────────────
  const deleteResults = await Promise.allSettled(
    orphanKeys.map((key) => deleteFile(key))
  );
  let filesDeleted = 0;
  let filesFailed = 0;
  for (const r of deleteResults) {
    if (r.status === "fulfilled") filesDeleted++;
    else {
      filesFailed++;
      console.error("[delete-content] R2 delete failed:", r.reason);
    }
  }

  return NextResponse.json({ ...mutationResult, filesDeleted, filesFailed });
}
