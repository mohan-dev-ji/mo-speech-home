import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { deleteFile, isConfigured } from "@/lib/r2-storage";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Delete composed content (sentence/phrase) with personal-recording R2 cleanup.
 * scope "group"   → the whole logical item across all languages (Stage 4).
 * scope "variant" → just this board's variant row (Stage 3, Revert).
 * The mutation returns the personal R2 keys to delete; shared TTS is never touched.
 */
export async function POST(request: Request) {
  if (!isConfigured()) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "Missing Convex token" }, { status: 401 });

  let body: { kind?: string; id?: string; scope?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { kind, id, scope } = body;
  if ((kind !== "sentence" && kind !== "phrase") || !id || (scope !== "group" && scope !== "variant")) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  convex.setAuth(token);

  let orphanKeys: string[];
  try {
    if (kind === "sentence") {
      const sid = id as Id<"profileSentences">;
      orphanKeys =
        scope === "group"
          ? await convex.mutation(api.profileSentences.deleteSentenceGroup, { profileSentenceId: sid })
          : await convex.mutation(api.profileSentences.deleteProfileSentence, { profileSentenceId: sid });
    } else {
      const pid = id as Id<"profilePhrases">;
      orphanKeys =
        scope === "group"
          ? await convex.mutation(api.profilePhrases.deletePhraseGroup, { profilePhraseId: pid })
          : await convex.mutation(api.profilePhrases.deleteProfilePhrase, { profilePhraseId: pid });
    }
  } catch (e) {
    console.error("[delete-composed] mutation failed", e);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  const results = await Promise.allSettled(orphanKeys.map((k) => deleteFile(k)));
  let filesDeleted = 0;
  let filesFailed = 0;
  for (const r of results) {
    if (r.status === "fulfilled") filesDeleted++;
    else { filesFailed++; console.error("[delete-composed] R2 delete failed:", r.reason); }
  }
  return NextResponse.json({ filesDeleted, filesFailed });
}
