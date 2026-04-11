import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/invite
 * Sends a Clerk invitation email to a collaborator.
 * The Convex accountMember record is created by the client before calling this.
 * When the invited user completes sign-up, createUser in convex/users.ts
 * activates the pending accountMember record by matching their email.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { email } = body as { email?: string };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;

  const client = await clerkClient();
  await client.invitations.createInvitation({
    emailAddress: email,
    redirectUrl: `${origin}/sign-up`,
    ignoreExisting: true, // re-invite is safe — Convex record already guards duplicates
  });

  return NextResponse.json({ ok: true });
}
