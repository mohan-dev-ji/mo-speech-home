/**
 * `/api/admin/pack-publish` — Phase 6 of ADR-010.
 *
 * Reads pack content (categories / lists / sentences) from the caller's
 * admin profile rows where `packSlug` matches the request body's slug, plus
 * the `packLifecycle` row for metadata (name / description / cover / tier),
 * assembles a `LibraryPack` JSON object, and writes it to
 * `convex/data/library_packs/<slug>.json` on disk. Also regenerates the
 * `_index.ts` barrel so the new (or updated) pack is wired into the
 * catalogue on the next bundle.
 *
 * **Local-dev-only.** Writing to a repo file requires Node `fs/promises`
 * access to the working tree, which only works when `pnpm dev` is running
 * on a developer's machine. Returns 403 in any other environment. See the
 * "Future hooks" section of ADR-010 for the path to extend this to prod
 * authoring via GitHub API.
 *
 * Auth: Clerk-authenticated admin. The Convex query (`getPackContentForPublish`)
 * also enforces admin via its own gate.
 *
 * Returns: `{ ok: true, slug, summary: {...} }` on success, or a 4xx with
 * `{ error: string }` on failure. The client shows a toast and prompts the
 * admin to review + commit the diff.
 */

import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { NextResponse } from "next/server";
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CopyObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, bucketName } from "@/lib/r2-storage";

export const dynamic = "force-dynamic";

/**
 * Copy an account-scoped R2 key to the pack-scoped prefix so the asset
 * survives admin account deletion. Returns the new key, or the original
 * key unchanged for paths that aren't account-scoped (SymbolStix global
 * imagery, TTS cache audio, already-promoted library_packs/<slug>/... keys).
 *
 * Filename is preserved from the source key. UUID-based filenames mean
 * cross-account collisions are vanishingly unlikely; we'd notice in testing.
 *
 * Idempotent: copying an already-copied object is a no-op overwrite. The
 * source object is left in place — the admin's own profile still references
 * it; we duplicate rather than move.
 */
async function promoteAsset(
  path: string | undefined,
  slug: string,
  kind: "images" | "audio",
  stats: { copied: number; skipped: number; failed: number }
): Promise<string | undefined> {
  if (!path) return path;
  if (!path.startsWith("accounts/")) {
    stats.skipped++;
    return path;
  }
  if (!r2Client || !bucketName) {
    // R2 not configured — leave the path alone. The dev environment may not
    // have R2 wired up; we don't want to fail publish in that case.
    stats.skipped++;
    return path;
  }

  const filename = path.split("/").pop();
  if (!filename) {
    stats.failed++;
    return path;
  }
  const newKey = `library_packs/${slug}/${kind}/${filename}`;

  if (path === newKey) {
    stats.skipped++;
    return newKey;
  }

  try {
    await r2Client.send(
      new CopyObjectCommand({
        Bucket: bucketName,
        CopySource: `${bucketName}/${path}`,
        Key: newKey,
      })
    );
    stats.copied++;
    return newKey;
  } catch (e) {
    console.error(`[pack-publish] R2 copy failed: ${path} → ${newKey}`, e);
    stats.failed++;
    return path;
  }
}

/**
 * Walk every R2 path on the publish payload and copy account-scoped keys to
 * `library_packs/<slug>/<kind>/...`. Mutates the payload in place so the JSON
 * we write references the promoted keys, not the admin-scoped originals.
 */
async function promoteAssetsToPackPrefix(
  slug: string,
  payload: Awaited<
    ReturnType<
      typeof import("convex/browser").ConvexHttpClient.prototype.query<
        typeof api.resourcePacks.getPackContentForPublish
      >
    >
  >
): Promise<{ images: number; audio: number; skipped: number; failed: number }> {
  if (!payload) return { images: 0, audio: 0, skipped: 0, failed: 0 };

  const imageStats = { copied: 0, skipped: 0, failed: 0 };
  const audioStats = { copied: 0, skipped: 0, failed: 0 };

  for (const cat of payload.categories) {
    cat.imagePath = await promoteAsset(cat.imagePath, slug, "images", imageStats);
    for (const sym of cat.symbols) {
      const s = sym as Record<string, unknown>;
      if (typeof s.imagePath === "string") {
        s.imagePath = await promoteAsset(s.imagePath, slug, "images", imageStats);
      }
      if (typeof s.recordedAudioPath === "string") {
        s.recordedAudioPath = await promoteAsset(
          s.recordedAudioPath,
          slug,
          "audio",
          audioStats
        );
      }
    }
  }

  for (const list of payload.lists) {
    for (const item of list.items) {
      const i = item as Record<string, unknown>;
      if (typeof i.imagePath === "string") {
        i.imagePath = await promoteAsset(i.imagePath, slug, "images", imageStats);
      }
      if (typeof i.audioPath === "string") {
        i.audioPath = await promoteAsset(i.audioPath, slug, "audio", audioStats);
      }
      if (typeof i.recordedAudioPath === "string") {
        i.recordedAudioPath = await promoteAsset(
          i.recordedAudioPath,
          slug,
          "audio",
          audioStats
        );
      }
      // defaultAudioPath / generatedAudioPath are global paths (SymbolStix /
      // ttsCache) — promoteAsset short-circuits them via the prefix check.
      if (typeof i.defaultAudioPath === "string") {
        i.defaultAudioPath = await promoteAsset(
          i.defaultAudioPath,
          slug,
          "audio",
          audioStats
        );
      }
      if (typeof i.generatedAudioPath === "string") {
        i.generatedAudioPath = await promoteAsset(
          i.generatedAudioPath,
          slug,
          "audio",
          audioStats
        );
      }
    }
  }

  for (const sentence of payload.sentences) {
    const s = sentence as Record<string, unknown>;
    if (typeof s.audioPath === "string") {
      s.audioPath = await promoteAsset(s.audioPath, slug, "audio", audioStats);
    }
    for (const slot of sentence.slots) {
      const sl = slot as Record<string, unknown>;
      if (typeof sl.imagePath === "string") {
        sl.imagePath = await promoteAsset(sl.imagePath, slug, "images", imageStats);
      }
    }
  }

  return {
    images: imageStats.copied,
    audio: audioStats.copied,
    skipped: imageStats.skipped + audioStats.skipped,
    failed: imageStats.failed + audioStats.failed,
  };
}

// Absolute path to the JSON catalogue directory. `process.cwd()` is the
// repo root in `pnpm dev`. In a built / serverless environment this points
// at the deployed function's working directory, which is read-only — the
// dev-only gate below short-circuits before any write would be attempted.
const PACKS_DIR = join(process.cwd(), "convex", "data", "library_packs");
const INDEX_PATH = join(PACKS_DIR, "_index.ts");

function isDevEnvironment(): boolean {
  // Local `pnpm dev` sets NODE_ENV=development. Vercel preview/prod sets
  // NODE_ENV=production. Belt-and-braces: require an explicit env flag so
  // a developer running `next start` locally doesn't accidentally enable it.
  if (process.env.NODE_ENV !== "development") return false;
  // Optional opt-out for devs who really want to disable publish even on
  // their local machine (e.g. running against a shared dev Convex deployment
  // they don't want to publish to).
  if (process.env.DISABLE_PACK_PUBLISH === "true") return false;
  return true;
}

function importVarFor(slug: string): string {
  return slug.replace(/^_+/, "").replace(/[^a-zA-Z0-9]+/g, "_");
}

async function rebuildBarrel(): Promise<{ slugs: string[] }> {
  // Re-scan the directory for *.json files and rebuild _index.ts to match.
  // Pure regen avoids stale state if a file was added or removed by hand
  // between publish runs.
  const fs = await import("node:fs/promises");
  const entries = await fs.readdir(PACKS_DIR);
  const slugs = entries
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort((a, b) => {
      // Starter pack first; then alphabetical.
      if (a === "_starter" && b !== "_starter") return -1;
      if (b === "_starter" && a !== "_starter") return 1;
      return a.localeCompare(b);
    });

  const importLines = slugs.map(
    (slug) => `import ${importVarFor(slug)} from "./${slug}.json";`
  );
  const mapLines = slugs.map(
    (slug) => `  "${slug}": ${importVarFor(slug)} as LibraryPack,`
  );

  const barrel = `/**
 * Library pack catalogue barrel.
 *
 * Imports every \`*.json\` file in this directory and re-exports them as a
 * typed \`LIBRARY_PACKS\` map keyed by slug. Bundlers (Convex + Next.js) treat
 * the JSON imports as compile-time data, so this map ships with every deploy.
 *
 * **When adding a pack**: place the new \`<slug>.json\` file alongside this
 * barrel, then add one import line + one map entry below. Keep the map
 * keys + filenames + the file's \`slug\` field aligned.
 *
 * **When removing a pack**: delete the JSON file, remove the import and
 * the map entry. A pack is treated as "not in the catalogue" the moment
 * it's missing from \`LIBRARY_PACKS\`.
 *
 * Per ADR-010. This file is regenerated by \`scripts/pack-migrate.mjs\` on
 * migration and by the \`/api/admin/pack-publish\` route on every publish.
 */

import type { LibraryPack } from "./types";

// ── Pack imports ────────────────────────────────────────────────────────────
${importLines.join("\n")}

// ── Catalogue map ───────────────────────────────────────────────────────────

export const LIBRARY_PACKS: Record<string, LibraryPack> = {
${mapLines.join("\n")}
};

// ── Re-exports ──────────────────────────────────────────────────────────────

export type { LibraryPack } from "./types";
`;

  await fs.writeFile(INDEX_PATH, barrel);
  return { slugs };
}

export async function POST(request: Request) {
  if (!isDevEnvironment()) {
    return NextResponse.json(
      {
        error:
          "Pack publish is dev-only. Set NODE_ENV=development and unset DISABLE_PACK_PUBLISH to enable.",
      },
      { status: 403 }
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

  let body: { slug?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const slug = body.slug?.trim();
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  // Reject hyphens etc. — Convex path validator would reject the resulting
  // filename inside `convex/`. The mutation that creates lifecycle rows
  // already enforces this; double-check defensively.
  if (!/^[a-z0-9_]+(?:\.[a-z0-9_]+)*$/.test(slug)) {
    return NextResponse.json(
      { error: "Invalid slug — lowercase alphanumeric + underscores only." },
      { status: 400 }
    );
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  convex.setAuth(token);

  let payload: Awaited<
    ReturnType<typeof convex.query<typeof api.resourcePacks.getPackContentForPublish>>
  >;
  try {
    payload = await convex.query(api.resourcePacks.getPackContentForPublish, {
      slug,
    });
  } catch (e: unknown) {
    console.error("[pack-publish] getPackContentForPublish failed", e);
    return NextResponse.json(
      { error: "Could not read pack content from Convex" },
      { status: 500 }
    );
  }

  if (!payload) {
    return NextResponse.json(
      {
        error: `No packLifecycle row for slug "${slug}". Toggle "Save to library" or "Make Default" on at least one row first.`,
      },
      { status: 404 }
    );
  }

  // Pull the JSON for the starter to inherit cover / defaultTier when the
  // lifecycle row doesn't carry them yet (legacy starter loaded before this
  // schema change). Other packs fall through to placeholder defaults.
  const isStarter = slug === "_starter";

  // Build the LibraryPack object. Tier hierarchy: lifecycle.tierOverride
  // wins, then the existing JSON file's defaultTier if we're updating, then
  // a sensible default.
  let existingJson: Record<string, unknown> | null = null;
  const targetPath = join(PACKS_DIR, `${slug}.json`);
  if (existsSync(targetPath)) {
    try {
      const raw = await readFile(targetPath, "utf8");
      existingJson = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // Corrupt file — ignore and overwrite.
    }
  }

  const defaultTier =
    payload.lifecycle.tierOverride ??
    (existingJson?.defaultTier as "free" | "pro" | "max" | undefined) ??
    "free";

  const name =
    payload.lifecycle.name ??
    (existingJson?.name as
      | { eng: string; hin?: string }
      | undefined) ?? { eng: slug };

  const description =
    payload.lifecycle.description ??
    (existingJson?.description as
      | { eng: string; hin?: string }
      | undefined) ?? { eng: "" };

  let coverImagePath =
    payload.lifecycle.coverImagePath ??
    (existingJson?.coverImagePath as string | undefined) ??
    "static/pack-cover-default.webp";

  // ── Promote account-scoped R2 assets into the pack-scoped prefix ─────────
  // Custom images and recorded voice land at `accounts/<admin>/{images,audio}/...`
  // during authoring; without this step, deleting the admin nukes those keys
  // and breaks every test account that loaded the pack. We copy (not move)
  // so the admin's own profile keeps working.
  const promotionSummary = await promoteAssetsToPackPrefix(slug, payload);

  // Cover image too — same rule. Mutate locally so the JSON points at the
  // promoted key.
  if (coverImagePath.startsWith("accounts/") && r2Client && bucketName) {
    const filename = coverImagePath.split("/").pop();
    if (filename) {
      const newKey = `library_packs/${slug}/images/${filename}`;
      try {
        await r2Client.send(
          new CopyObjectCommand({
            Bucket: bucketName,
            CopySource: `${bucketName}/${coverImagePath}`,
            Key: newKey,
          })
        );
        coverImagePath = newKey;
        promotionSummary.images += 1;
      } catch (e) {
        console.error("[pack-publish] cover R2 copy failed", e);
      }
    }
  }

  const libraryPack = {
    slug,
    name,
    description,
    coverImagePath,
    defaultTier,
    ...(isStarter ? { isStarter: true } : {}),
    ...(payload.categories.length > 0
      ? { categories: payload.categories }
      : {}),
    lists: payload.lists,
    sentences: payload.sentences,
  };

  if (!existsSync(PACKS_DIR)) {
    await mkdir(PACKS_DIR, { recursive: true });
  }

  try {
    await writeFile(
      targetPath,
      JSON.stringify(libraryPack, null, 2) + "\n",
      "utf8"
    );
  } catch (e: unknown) {
    console.error("[pack-publish] writeFile failed", e);
    return NextResponse.json(
      { error: "Could not write JSON file — is the dev server's filesystem writable?" },
      { status: 500 }
    );
  }

  let barrelSummary: { slugs: string[] };
  try {
    barrelSummary = await rebuildBarrel();
  } catch (e: unknown) {
    console.error("[pack-publish] rebuildBarrel failed", e);
    return NextResponse.json(
      { error: "Wrote JSON but failed to regenerate _index.ts" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    slug,
    summary: {
      categories: payload.categories.length,
      lists: payload.lists.length,
      sentences: payload.sentences.length,
      assetsPromoted: promotionSummary,
      barrelSlugs: barrelSummary.slugs,
    },
  });
}
