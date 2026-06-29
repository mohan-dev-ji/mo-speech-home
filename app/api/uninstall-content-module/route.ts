import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";
import { deleteFile, isConfigured } from "@/lib/r2-storage";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Tree = "categories" | "lists" | "sentences";

// Per-tree wiring: the orphan-key query + delete mutation for each module type.
const TREE_FNS = {
  categories: {
    orphanKeys: api.contentModules.categories.getCategoryModuleDeleteOrphanKeys,
    delete: api.contentModules.categories.deleteCategoryModule,
  },
  lists: {
    orphanKeys: api.contentModules.lists.getListModuleDeleteOrphanKeys,
    delete: api.contentModules.lists.deleteListModule,
  },
  sentences: {
    orphanKeys: api.contentModules.sentences.getSentenceModuleDeleteOrphanKeys,
    delete: api.contentModules.sentences.deleteSentenceModule,
  },
} as const;

/**
 * Uninstall an installed content module (ADR-014 §5). Generalises
 * `reload-category-defaults`: collect the module's personal R2 keys, run the
 * per-type delete mutation, then delete the R2 objects (best-effort).
 *
 * Body: { tree: "categories" | "lists" | "sentences", slug: string }
 * Returns: { ...mutationCounts, filesDeleted, filesFailed }
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

  let body: { tree?: string; slug?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const tree = body.tree as Tree | undefined;
  const slug = body.slug;
  if (!tree || !(tree in TREE_FNS) || !slug) {
    return NextResponse.json(
      { error: "Missing or invalid tree/slug" },
      { status: 400 }
    );
  }
  const fns = TREE_FNS[tree];

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  convex.setAuth(token);

  // Step 1: collect personal R2 keys before the mutation deletes the rows.
  let orphanKeys: string[];
  try {
    orphanKeys = await convex.query(fns.orphanKeys, { slug });
  } catch (e) {
    console.error("[uninstall-module] orphan-keys query failed", e);
    return NextResponse.json(
      { error: "Could not read module state" },
      { status: 500 }
    );
  }

  // Step 2: run the delete mutation.
  let mutationResult: Record<string, unknown>;
  try {
    mutationResult = await convex.mutation(fns.delete, { slug });
  } catch (e: unknown) {
    if (
      e instanceof ConvexError &&
      typeof e.data === "object" &&
      e.data !== null &&
      "code" in e.data
    ) {
      const code = (e.data as { code: string }).code;
      const status = code === "NOT_INSTALLED" ? 404 : 500;
      return NextResponse.json({ error: code, code }, { status });
    }
    console.error("[uninstall-module] mutation failed", e);
    return NextResponse.json({ error: "Uninstall failed" }, { status: 500 });
  }

  // Step 3: parallel R2 deletion. Best-effort — log and continue on failure.
  const deleteResults = await Promise.allSettled(
    orphanKeys.map((key) => deleteFile(key))
  );
  let filesDeleted = 0;
  let filesFailed = 0;
  for (const r of deleteResults) {
    if (r.status === "fulfilled") filesDeleted++;
    else {
      filesFailed++;
      console.error("[uninstall-module] R2 delete failed:", r.reason);
    }
  }

  return NextResponse.json({ ...mutationResult, filesDeleted, filesFailed });
}
