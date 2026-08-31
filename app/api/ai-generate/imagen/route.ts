import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { GoogleAuth } from "google-auth-library";
import { api } from "@/convex/_generated/api";
import { isConfigured } from "@/lib/r2-storage";
import { STYLE_PRESETS, isStyleId } from "@/lib/ai-style-prompts";
import { AI_IMAGE_MODEL } from "@/lib/cache-identity";
import { trackServer, flushAnalytics } from "@/lib/analytics-server";
import { resolveAiImageLimits } from "@/lib/ai-image-limits";

export const dynamic = "force-dynamic";
// Gemini image generation calls take ~5–10s; bump from the default 10s.
export const maxDuration = 60;

const FEATURE = "aiImageGenerate";
/**
 * A 200 response that carried no image (MOS-40).
 *
 * Its own type, not a generic Error, because the caller must be able to tell
 * "the provider refused this prompt" from "the provider broke". They need
 * different HTTP statuses, different copy, and — critically — a refusal is
 * deterministic. Telling a user to try again after a refusal invites an
 * identical failure and burns another generation.
 */
export class ProviderRefusalError extends Error {
  readonly finishReason?: string;
  readonly blockReason?: string;
  readonly texts: string[];
  readonly safetyRatings: string[];

  constructor(info: {
    finishReason?: string;
    blockReason?: string;
    texts: string[];
    safetyRatings: string[];
  }) {
    super(
      `${IMAGE_MODEL} returned no image part. ` +
        `finishReason=${info.finishReason ?? "?"} ` +
        `blockReason=${info.blockReason ?? "-"} ` +
        `safety=[${info.safetyRatings.join(", ")}] ` +
        `text=${JSON.stringify(info.texts)}`
    );
    this.name = "ProviderRefusalError";
    this.finishReason = info.finishReason;
    this.blockReason = info.blockReason;
    this.texts = info.texts;
    this.safetyRatings = info.safetyRatings;
  }
}

const MAX_PROMPT_LENGTH = 500;

// The Gemini image model id, aliased locally so the request code below reads
// `IMAGE_MODEL`. It still lives in lib/cache-identity.ts for historical
// reasons — it used to double as the AI image cache's identity — and moves
// next to the style templates it was verified against once that cache is
// removed (ADR-023). Changing it means re-verifying all four style templates
// (MOS-40) and regenerating the style thumbnails.
const IMAGE_MODEL = AI_IMAGE_MODEL;

// ─── Gemini image generation (Vertex AI REST) ────────────────────────────────

async function generateImage(wrappedPrompt: string): Promise<Buffer> {
  const credJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set");
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  if (!projectId) throw new Error("GOOGLE_CLOUD_PROJECT_ID not set");
  // gemini-2.5-flash-image is not available on the `global` endpoint at time
  // of writing (verified 2026-08) — must stay pinned to us-central1. Do NOT
  // use GEMINI_TRANSLATION_LOCATION (europe-west4) here; that's a separate
  // region for the text translation pipeline in lib/llm/vertex.ts.
  const location = process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";

  const googleAuth = new GoogleAuth({
    credentials: JSON.parse(credJson),
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await googleAuth.getClient();
  const { token } = await client.getAccessToken();

  const url =
    `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}` +
    `/locations/${location}/publishers/google/models/${IMAGE_MODEL}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: wrappedPrompt }] }],
      generationConfig: { imageConfig: { aspectRatio: "1:1" } },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${IMAGE_MODEL} API error ${res.status}: ${err}`);
  }

  // The response type carries `text`, `finishReason` and `safetyRatings`
  // alongside `inlineData` (MOS-40). It used to declare ONLY `inlineData`,
  // which is why a refusal was invisible: the model's explanation was sitting
  // in the payload, untyped, unread, and thrown away on the error path.
  const json = (await res.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { data?: string; mimeType?: string };
          text?: string;
        }>;
      };
      finishReason?: string;
      safetyRatings?: Array<{ category?: string; probability?: string }>;
    }>;
    promptFeedback?: { blockReason?: string };
  };

  const candidate = json.candidates?.[0];
  // The image part is not guaranteed to be first — a text part (e.g. a
  // caption or refusal) can precede it, so scan for inlineData rather than
  // indexing [0].
  const parts = candidate?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  const b64 = imagePart?.inlineData?.data;
  if (!b64) {
    // A 200 WITH NO IMAGE IS A REFUSAL, not a malformed response. Gemini
    // declines by returning success plus an explanation — a `finishReason`
    // such as SAFETY / PROHIBITED_CONTENT / IMAGE_SAFETY, and often a text
    // part saying what it objected to.
    //
    // Everything the model told us goes into the error. The previous message
    // named only what was ABSENT ("missing inlineData image part"), so the
    // one fact needed to fix it — why — was discarded at the exact moment it
    // was available. This converts every future occurrence, whatever the
    // style, prompt or model, from a black box into a self-explaining line.
    throw new ProviderRefusalError({
      finishReason: candidate?.finishReason,
      blockReason: json.promptFeedback?.blockReason,
      texts: parts.map((p) => p.text).filter((t): t is string => !!t),
      safetyRatings: (candidate?.safetyRatings ?? [])
        .filter((r) => r.probability && r.probability !== "NEGLIGIBLE")
        .map((r) => `${r.category}=${r.probability}`),
    });
  }
  return Buffer.from(b64, "base64");
}

// ─── Route ────────────────────────────────────────────────────────────────────

/**
 * POST /api/ai-generate/imagen
 * Body: { prompt: string, style: StyleId }
 *
 * Pipeline: auth → Max-tier check → both quota meters reserved → Gemini image
 * call → PNG bytes returned inline. No cache, no R2 write — see ADR-023.
 * Every call is a live generation, which is what makes re-generating give a
 * different image.
 */
export async function POST(request: Request) {
  if (!isConfigured()) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { prompt?: string; style?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawPrompt = body.prompt?.trim();
  if (!rawPrompt) {
    return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
  }
  if (rawPrompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      { error: "prompt_too_long", limit: MAX_PROMPT_LENGTH },
      { status: 400 }
    );
  }
  if (!isStyleId(body.style)) {
    return NextResponse.json({ error: "Invalid style" }, { status: 400 });
  }
  const style = body.style;
  const limits = resolveAiImageLimits();

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
      { error: "max_tier_required", message: "AI image generation is a Max-tier feature" },
      { status: 403 }
    );
  }

  // ── Quota: both meters, one transaction (ADR-023) ────────────────────────
  // Reserved BEFORE the provider call. Incrementing afterwards would let two
  // concurrent requests both pass the check and exceed the limit. The cost of
  // reserving is that a failure has already been charged — hence the refund on
  // every failure path below.
  let dailyRemaining: number;
  let monthlyRemaining: number;
  try {
    const incr = await convex.mutation(api.featureQuota.checkAndIncrementDual, {
      feature: FEATURE,
      dailyLimit: limits.daily,
      monthlyLimit: limits.monthly,
    });
    dailyRemaining = incr.dailyRemaining;
    monthlyRemaining = incr.monthlyRemaining;
  } catch (err) {
    if (err instanceof Error && err.message.includes("QuotaExceeded")) {
      // Which ceiling bit decides the copy: "back tomorrow" and "back on the
      // 1st" are very different things to be told.
      const meter = err.message.endsWith(":month") ? "month" : "day";
      trackServer(userId, "ai_generate_quota_blocked", { meter, tier: "max" });
      await flushAnalytics();
      return NextResponse.json(
        {
          error: "quota_exceeded",
          meter,
          limit: meter === "month" ? limits.monthly : limits.daily,
        },
        { status: 429 }
      );
    }
    throw err;
  }

  // ── Generate ─────────────────────────────────────────────────────────────
  const wrappedPrompt = STYLE_PRESETS[style].template(rawPrompt);
  let pngBuffer: Buffer;
  try {
    pngBuffer = await generateImage(wrappedPrompt);
  } catch (err) {
    // Log what was SENT alongside what came back. The refusal fields say the
    // provider objected, never to what — and during MOS-40 that gap cost
    // several rounds, because a stale dev bundle meant the template being
    // sent was not the template on disk. Printing the outgoing prompt makes
    // that class of confusion impossible to repeat: if the log disagrees with
    // the source, the running build is stale.
    //
    // Server log only. Prompt text is user content and stays out of
    // analytics (see the `ai_generate_used` call below, which deliberately
    // sends style but never the prompt).
    console.error(
      "[ai-generate] Gemini image generation error",
      { style, rawPrompt, wrappedPrompt },
      err
    );

    // REFUND THE RESERVATION (MOS-40). The quota was incremented before the
    // call, so a failure the user did not cause has already cost them one of
    // ten. Best-effort and deliberately swallowed: if the refund itself
    // fails, the generation failure is still the thing worth reporting, and
    // one uncredited unit beats a second error masking the first.
    try {
      await convex.mutation(api.featureQuota.refundOneDual, { feature: FEATURE });
    } catch (refundErr) {
      console.error("[ai-generate] quota refund failed", refundErr);
    }

    // A refusal is not a malfunction. It is deterministic — the same prompt
    // and style will be refused identically — so it gets its own status and
    // its own copy, and must never be presented as "try again".
    if (err instanceof ProviderRefusalError) {
      return NextResponse.json(
        {
          error: "provider_refused",
          finishReason: err.finishReason ?? null,
          blockReason: err.blockReason ?? null,
        },
        { status: 422 }
      );
    }
    return NextResponse.json({ error: "provider_error" }, { status: 502 });
  }

  // ── Return ───────────────────────────────────────────────────────────────
  // NO R2 WRITE. The upload existed only to populate `aiImageCache`; with the
  // cache gone (ADR-023) nothing reads the object, and `X-R2-Key` was never
  // read by any caller. The image reaches R2 only if the user adopts it, at
  // which point SymbolEditorModal uploads a resized webp under
  // accounts/<accountId>/images/.
  trackServer(userId, "ai_generate_used", {
    tier: "max",
    style,
    dailyRemaining,
    monthlyRemaining,
  });
  await flushAnalytics();

  const pngAb = pngBuffer.buffer.slice(
    pngBuffer.byteOffset,
    pngBuffer.byteOffset + pngBuffer.byteLength
  ) as ArrayBuffer;
  return new Response(new Blob([pngAb]), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
      "X-Daily-Remaining": String(dailyRemaining),
      "X-Monthly-Remaining": String(monthlyRemaining),
    },
  });
}
