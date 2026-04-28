import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { searchWikimedia } from "@/lib/image-providers/wikimedia";

export const dynamic = "force-dynamic";

const FEATURE = "imageSearch";
const DAILY_LIMIT = 30;

/**
 * POST /api/image-search/search
 * Body: { query: string, page?: number }
 *
 * Pipeline: auth → tier check → cache lookup → quota increment (only on miss) →
 * provider call → cache write → return.
 *
 * Quota is incremented only when we hit the live provider; cache hits are free.
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

  // ── Cache lookup (free) ──────────────────────────────────────────────────
  const cached = await convex.query(api.imageCache.lookupSearch, { query, page });
  if (cached) {
    const remaining = await convex.query(api.featureQuota.getRemaining, {
      feature: FEATURE,
      limit: DAILY_LIMIT,
    });
    return NextResponse.json({
      results: cached,
      cached: true,
      remaining: remaining?.remaining ?? null,
    });
  }

  // ── Quota check + increment (only counts a live provider call) ───────────
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

  // ── Live provider ────────────────────────────────────────────────────────
  let results;
  try {
    results = await searchWikimedia(query, page);
  } catch (err) {
    console.error("[image-search] Wikimedia error", err);
    return NextResponse.json({ error: "provider_error" }, { status: 502 });
  }

  await convex.mutation(api.imageCache.writeSearch, {
    query,
    page,
    results,
  });

  return NextResponse.json({ results, cached: false, remaining });
}
