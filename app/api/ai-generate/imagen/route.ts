import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { GoogleAuth } from "google-auth-library";
import { createHash, randomUUID } from "crypto";
import { api } from "@/convex/_generated/api";
import { uploadBuffer, getFile, isConfigured } from "@/lib/r2-storage";
import { R2_PATHS } from "@/lib/r2-paths";
import { STYLE_PRESETS, isStyleId, type StyleId } from "@/lib/ai-style-prompts";
import { AI_IMAGE_MODEL, aiImageCacheHashInput } from "@/lib/cache-identity";
import { trackServer, flushAnalytics } from "@/lib/analytics-server";

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

/**
 * Per-user daily generation cap. Defaults to 10; override with
 * `AI_IMAGE_DAILY_LIMIT` for admin authoring sessions, where a single content
 * module is 12 symbols and so cannot be authored in a day at the default.
 *
 * Parsed defensively: a malformed value must not become NaN, because the
 * quota check is `current >= limit` and `x >= NaN` is always false — a typo
 * would silently grant unlimited generations rather than failing closed.
 */
const DAILY_LIMIT = (() => {
  const raw = process.env.AI_IMAGE_DAILY_LIMIT;
  if (!raw) return 10;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < 1) {
    console.warn(
      `[ai-generate] ignoring invalid AI_IMAGE_DAILY_LIMIT=${raw}; using 10`
    );
    return 10;
  }
  return n;
})();
const MAX_PROMPT_LENGTH = 500;

// The model id — and therefore this cache's identity — now lives in
// lib/cache-identity.ts alongside the image-search cache version, because a
// model swap IS a cache invalidation (MOS-31): it is part of the aiImageCache
// key, so changing it makes every Imagen-era row unreachable. Read that file's
// bump procedure before changing it. Aliased locally so the request code below
// reads the same as before.
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

/**
 * The cache key. The pre-digest string comes from `aiImageCacheHashInput` (the
 * single source of truth for the recipe) so the orphan sweep can re-derive the
 * key a stored row would have today and spot the ones that are unreachable.
 */
function hashPromptStyleModel(style: StyleId, prompt: string): string {
  return createHash("sha256").update(aiImageCacheHashInput(style, prompt)).digest("hex");
}

// ─── Route ────────────────────────────────────────────────────────────────────

/**
 * POST /api/ai-generate/imagen
 * Body: { prompt: string, style: StyleId }
 *
 * Pipeline: auth → Max-tier check → cache lookup (free) → quota increment
 * (only on miss) → Gemini image call → R2 upload → cache write → return.
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

  // ── Cache lookup (free; doesn't decrement quota) ─────────────────────────
  const hash = hashPromptStyleModel(style, rawPrompt);
  const cached = await convex.query(api.imageCache.lookupAi, { hash });
  if (cached) {
    await convex.mutation(api.imageCache.recordAiHit, { hash });
    const remaining = await convex.query(api.featureQuota.getRemaining, {
      feature: FEATURE,
      limit: DAILY_LIMIT,
    });
    const file = await getFile(cached.r2Key);
    const ab = file.buffer.buffer.slice(
      file.buffer.byteOffset,
      file.buffer.byteOffset + file.buffer.byteLength
    ) as ArrayBuffer;
    return new Response(new Blob([ab]), {
      status: 200,
      headers: {
        "Content-Type": file.contentType || "image/png",
        "Cache-Control": "no-store",
        "X-R2-Key": cached.r2Key,
        "X-Cache": "hit",
        "X-Remaining": String(remaining?.remaining ?? ""),
      },
    });
  }

  // ── Quota check + increment (only counts a live Gemini image call) ───────
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
      await convex.mutation(api.featureQuota.refundOne, { feature: FEATURE });
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

  // ── Upload + cache ───────────────────────────────────────────────────────
  const r2Key = R2_PATHS.aiCache(randomUUID());
  await uploadBuffer(r2Key, pngBuffer, "image/png");
  await convex.mutation(api.imageCache.writeAi, {
    hash,
    prompt: rawPrompt,
    style,
    r2Key,
    model: IMAGE_MODEL,
  });

  // Product analytics: cache-miss = real usage signal. See plan §7.4.
  // The prompt text is intentionally NOT included in the payload — privacy
  // hard rule. Style is fine: it's a fixed enum, not user content.
  trackServer(userId, "ai_generate_used", {
    tier: "max",
    cached: false,
    style,
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
      "X-R2-Key": r2Key,
      "X-Cache": "miss",
      "X-Remaining": String(remaining),
    },
  });
}
