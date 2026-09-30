import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

/**
 * Billing is owner-only (MOS-88). Returns a response to send back when the
 * caller may not use billing, or `null` when they may continue. Fails closed:
 * anything other than a confirmed account owner (including a Clerk user with
 * no Convex row) is denied.
 *
 * Uses a per-request client so the caller's token is never shared across
 * requests.
 */
export async function requireBillingOwner(
  getToken: (options: { template: string }) => Promise<string | null>,
): Promise<NextResponse | null> {
  const token = await getToken({ template: "convex" });
  if (!token) {
    return NextResponse.json({ error: "Missing Convex token" }, { status: 401 });
  }
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  client.setAuth(token);
  const access = await client.query(api.users.getMyAccess, {});
  if (access?.role !== "owner") {
    return NextResponse.json({ error: "owner_only" }, { status: 403 });
  }
  return null;
}
