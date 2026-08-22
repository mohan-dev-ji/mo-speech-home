/**
 * `/api/admin/promote-module-assets` — ADR-022.
 *
 * Copies the personal R2 assets a publish source references into the shared
 * module-scoped prefix `library_modules/<tree>/<slug>/<kind>/<filename>`, and
 * returns the old→new key mapping for the caller to pass into the publish
 * mutation as `assetPathMap`.
 *
 * Exists because Convex mutations cannot perform R2 I/O. Mirrors the retired
 * `promoteAssetsToPackPrefix` (git: 7083f1a^:app/api/admin/pack-publish/route.ts).
 *
 * Copy, don't move: the authoring account still references the originals.
 * Idempotent: re-publishing overwrites the same destination key.
 */

import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { CopyObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, bucketName } from "@/lib/r2-storage";

export const dynamic = "force-dynamic";

/** `accounts/<id>/images/<file>` → "images"; audio keys → "audio". */
function kindOf(key: string): "images" | "audio" {
  return key.includes("/audio/") ? "audio" : "images";
}

/**
 * Admin role, same source of truth as `requireCallerIsAdmin` (ADR-008):
 * Clerk `publicMetadata.role`. The default Next.js session token does not
 * necessarily carry `publicMetadata` — only the `convex` JWT template is
 * guaranteed to — so fall back to the Clerk backend API rather than 403-ing a
 * real admin.
 */
async function callerIsAdmin(
  userId: string,
  sessionClaims: Record<string, unknown> | null,
): Promise<boolean> {
  const claimed = (sessionClaims?.publicMetadata as { role?: string } | undefined)
    ?.role;
  if (claimed === "admin") return true;
  try {
    const user = await (await clerkClient()).users.getUser(userId);
    return (user.publicMetadata as { role?: string } | undefined)?.role === "admin";
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const { sessionClaims, userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!(await callerIsAdmin(userId, sessionClaims))) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = (await req.json()) as {
    tree?: string;
    slug?: string;
    keys?: string[];
  };
  const { tree, slug, keys } = body;
  if (!tree || !slug || !Array.isArray(keys)) {
    return NextResponse.json(
      { error: "Expected { tree, slug, keys[] }" },
      { status: 400 }
    );
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "Bad slug" }, { status: 400 });
  }
  if (!/^(categories|lists|sentences|phrases)$/.test(tree)) {
    return NextResponse.json({ error: "Bad tree" }, { status: 400 });
  }

  const mapping: Record<string, string> = {};
  const stats = { copied: 0, skipped: 0, failed: 0 };

  if (!r2Client || !bucketName) {
    // R2 unconfigured — publish must still succeed with paths left in place.
    console.warn("[promote-module-assets] R2 not configured; skipping promotion");
    return NextResponse.json({ mapping, stats: { ...stats, skipped: keys.length } });
  }

  for (const key of keys) {
    if (!key.startsWith("accounts/") && !key.startsWith("profiles/")) {
      stats.skipped++;
      continue;
    }
    const filename = key.split("/").pop();
    if (!filename) { stats.failed++; continue; }

    const newKey = `library_modules/${tree}/${slug}/${kindOf(key)}/${filename}`;
    if (key === newKey) { stats.skipped++; continue; }

    try {
      await r2Client.send(
        new CopyObjectCommand({
          Bucket: bucketName,
          CopySource: `${bucketName}/${key}`,
          Key: newKey,
        })
      );
      mapping[key] = newKey;
      stats.copied++;
    } catch (e) {
      console.error(`[promote-module-assets] copy failed: ${key} → ${newKey}`, e);
      stats.failed++;
    }
  }

  return NextResponse.json({ mapping, stats });
}
