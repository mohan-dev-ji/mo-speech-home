import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { stripe } from "@/lib/stripe";
import { r2Client, bucketName } from "@/lib/r2-storage";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

const COLLABORATOR_ERROR_PREFIX = "Only the account owner";

export async function POST() {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await getToken({ template: "convex" });
  if (!token) {
    return NextResponse.json({ error: "Missing Convex token" }, { status: 401 });
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  convex.setAuth(token);

  try {
    const user = await convex.query(api.users.getUserByClerkId, { clerkUserId: userId });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const accountId = user._id;

    if (user.subscription.stripeCustomerId) {
      const subs = await stripe.subscriptions.list({
        customer: user.subscription.stripeCustomerId,
        status: "active",
      });
      await Promise.all(subs.data.map((s) => stripe.subscriptions.cancel(s.id)));
      await stripe.customers.del(user.subscription.stripeCustomerId);
    }

    const { profileIds } = await convex.mutation(
      api.account.cascadeDeleteAccount,
      {}
    );

    // BOTH personal prefixes, not just one (MOS-39). `cascadeDeleteAccount`
    // has always returned `profileIds` precisely so this route could wipe the
    // `profiles/<id>/` prefixes — its docblock says so — and this route has
    // always thrown that return value away and deleted only `accounts/<id>/`.
    // Latent so far because `profiles/` is empty (no one has set a student
    // photo yet); it would leak the first time someone did and then deleted
    // their account. `isPersonalAssetKey` treats both prefixes as personal —
    // the two halves of "this account's own bytes" — so both go here.
    if (r2Client && bucketName) {
      const prefixes = [
        `accounts/${accountId}/`,
        ...profileIds.map((id) => `profiles/${id}/`),
      ];
      for (const Prefix of prefixes) {
        let ContinuationToken: string | undefined;
        do {
          const listed = await r2Client.send(
            new ListObjectsV2Command({ Bucket: bucketName, Prefix, ContinuationToken })
          );
          const keys = (listed.Contents ?? []).map((o) => ({ Key: o.Key! }));
          if (keys.length > 0) {
            await r2Client.send(
              new DeleteObjectsCommand({
                Bucket: bucketName,
                Delete: { Objects: keys, Quiet: true },
              })
            );
          }
          ContinuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
        } while (ContinuationToken);
      }
    }

    await (await clerkClient()).users.deleteUser(userId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete account error:", err);
    const message = err instanceof Error ? err.message : "Failed to delete account";
    const status = message.startsWith(COLLABORATOR_ERROR_PREFIX) ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
