import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { searchWikimedia } from "@/lib/image-providers/wikimedia";
import { searchPixabay } from "@/lib/image-providers/pixabay";
import { searchUnsplash } from "@/lib/image-providers/unsplash";
import { searchPexels } from "@/lib/image-providers/pexels";
import type { ImageProvider, ImageSearchResult, ProviderSearchFn } from "@/lib/image-providers/types";

export const dynamic = "force-dynamic";

const FEATURE = "imageSearch";
const DAILY_LIMIT = 30;

/**
 * Provider registry. Wikimedia is always enabled (no key required). The rest
 * are gated on env vars — a missing key means that provider is skipped, not
 * an error. V1 ships working with any subset of keys configured.
 */
function getEnabledProviders(): Array<[ImageProvider, ProviderSearchFn]> {
  const providers: Array<[ImageProvider, ProviderSearchFn]> = [
    ["wikimedia", searchWikimedia],
  ];
  if (process.env.PIXABAY_API_KEY) providers.push(["pixabay", searchPixabay]);
  if (process.env.UNSPLASH_ACCESS_KEY) providers.push(["unsplash", searchUnsplash]);
  if (process.env.PEXELS_API_KEY) providers.push(["pexels", searchPexels]);
  return providers;
}

/**
 * Round-robin interleave so one heavy provider doesn't push the rest to the
 * bottom of the grid. Each provider returns a flat list; we zip them.
 */
function interleave(groups: ImageSearchResult[][]): ImageSearchResult[] {
  const out: ImageSearchResult[] = [];
  const max = Math.max(0, ...groups.map((g) => g.length));
  for (let i = 0; i < max; i++) {
    for (const g of groups) {
      if (g[i]) out.push(g[i]);
    }
  }
  return out;
}

/**
 * POST /api/image-search/search
 * Body: { query: string, page?: number }
 *
 * Pipeline: auth → tier check → cache lookup → quota increment (only on miss) →
 * parallel provider fan-out → interleave → cache write → return.
 *
 * Quota is incremented once per user-driven search regardless of how many
 * provider calls happen behind the scenes. Cache hits are free.
 */
export async function POST(request: Request) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { query?: string; page?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawQuery = body.query?.trim();
  if (!rawQuery) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }
  const query = rawQuery.toLowerCase();
  const page = Math.max(0, Math.floor(body.page ?? 0));

  const token = await getToken({ template: "convex" });
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  if (token) convex.setAuth(token);

  // ── Tier gate — server-side authoritative ────────────────────────────────
  const access = await convex.query(api.users.getMyAccess, {});
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const isMax =
    (access.tier === "max" && access.hasFullAccess) ||
    (access.customAccess?.isActive ?? false);
  if (!isMax) {
    return NextResponse.json(
      { error: "max_tier_required", message: "Image search is a Max-tier feature" },
      { status: 403 }
    );
  }

  const enabled = getEnabledProviders();
  const providerNames = enabled.map(([name]) => name);

  // ── Cache lookup (free) ──────────────────────────────────────────────────
  const cached = await convex.query(api.imageCache.lookupSearch, { query, page });
  if (cached) {
    const remaining = await convex.query(api.featureQuota.getRemaining, {
      feature: FEATURE,
      limit: DAILY_LIMIT,
    });
    // Re-derive providersUsed from the cached results — a provider that was
    // down when we cached will be absent from the cache, and the UI should
    // know that without us tracking it separately.
    const cachedProvidersUsed = Array.from(new Set(cached.map((r) => r.provider)));
    return NextResponse.json({
      results: cached,
      cached: true,
      providersUsed: cachedProvidersUsed,
      providersEnabled: providerNames,
      remaining: remaining?.remaining ?? null,
    });
  }

  // ── Quota check + increment (only counts a live provider fan-out) ────────
  let remaining: number;
  try {
    const incr = await convex.mutation(api.featureQuota.checkAndIncrement, {
      feature: FEATURE,
      limit: DAILY_LIMIT,
    });
    remaining = incr.remaining;
  } catch (err) {
    if (err instanceof Error && err.message.includes("QuotaExceeded")) {
      return NextResponse.json(
        { error: "quota_exceeded", limit: DAILY_LIMIT },
        { status: 429 }
      );
    }
    throw err;
  }

  // ── Live providers (parallel, graceful per-provider degradation) ─────────
  const settled = await Promise.allSettled(
    enabled.map(([name, fn]) =>
      fn(query, page).then((results) => ({ name, results }))
    )
  );

  const groups: ImageSearchResult[][] = [];
  const providersUsed: ImageProvider[] = [];
  for (const s of settled) {
    if (s.status === "fulfilled" && s.value.results.length > 0) {
      groups.push(s.value.results);
      providersUsed.push(s.value.name);
    }
  }

  const results = interleave(groups);

  await convex.mutation(api.imageCache.writeSearch, {
    query,
    page,
    results,
  });

  return NextResponse.json({
    results,
    cached: false,
    providersUsed,
    providersEnabled: providerNames,
    remaining,
  });
}
