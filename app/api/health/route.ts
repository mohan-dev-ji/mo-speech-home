import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, boolean> = {
    convex: !!process.env.NEXT_PUBLIC_CONVEX_URL,
    clerk: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    stripe: !!process.env.STRIPE_SECRET_KEY,
    r2: !!process.env.R2_ACCOUNT_ID,
  };

  const allHealthy = Object.values(checks).every(Boolean);

  return NextResponse.json(
    { status: allHealthy ? "ok" : "degraded", checks },
    { status: allHealthy ? 200 : 503 }
  );
}
