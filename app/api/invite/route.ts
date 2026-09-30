import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

/**
 * POST /api/invite
 * Sends a Clerk invitation email to a collaborator.
 * The Convex accountMember record is created by the client before calling this.
 * MOS-94: the email is sent only if accountMembers.canSendInvite passes: the
 * caller is an account owner on Max and has already invited this address.
 * A brand-new invitee is activated by createUser on sign-up; someone who
 * already has an account is activated by acceptPendingInvite on sign-in.
 */
export async function POST(request: Request) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { email: rawEmail } = body as { email?: string };
  // Trim before the format check so a padded address is normalised, not rejected.
  const trimmed = typeof rawEmail === "string" ? rawEmail.trim() : "";

  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  const email = trimmed.toLowerCase();

  // Per-request client so the caller's token is never shared across requests.
  const token = await getToken({ template: "convex" });
  if (!token) {
    return NextResponse.json({ error: "Missing Convex token" }, { status: 401 });
  }
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  convex.setAuth(token);
  const allowed = await convex.query(api.accountMembers.canSendInvite, { email });
  if (!allowed) {
    return NextResponse.json({ error: "not_allowed" }, { status: 403 });
  }

  const origin = new URL(request.url).origin;

  const client = await clerkClient();
  await client.invitations.createInvitation({
    emailAddress: email,
    redirectUrl: `${origin}/sign-up`,
    // Re-invite is safe: the Convex record already guards duplicates. An
    // existing user joins through acceptPendingInvite on sign-in (MOS-94).
    ignoreExisting: true,
  });

  return NextResponse.json({ ok: true });
}
