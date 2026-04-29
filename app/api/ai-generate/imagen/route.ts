import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { GoogleAuth } from "google-auth-library";
import { createHash, randomUUID } from "crypto";
import { api } from "@/convex/_generated/api";
import { uploadBuffer, getFile, isConfigured } from "@/lib/r2-storage";
import { R2_PATHS } from "@/lib/r2-paths";
import { STYLE_PRESETS, isStyleId, type StyleId } from "@/lib/ai-style-prompts";

export const dynamic = "force-dynamic";
// Imagen calls take ~5–10s; bump from the default 10s.
export const maxDuration = 60;

const FEATURE = "aiImageGenerate";
const DAILY_LIMIT = 10;
const MAX_PROMPT_LENGTH = 500;

// ─── Imagen 4 Fast (Vertex AI REST) ──────────────────────────────────────────

async function generateImage(wrappedPrompt: string): Promise<Buffer> {
  const credJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set");
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  if (!projectId) throw new Error("GOOGLE_CLOUD_PROJECT_ID not set");
  // Imagen 4 Fast is us-central1-only at time of writing (verified 2026-04-28).
  const location = process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";

  const googleAuth = new GoogleAuth({
    credentials: JSON.parse(credJson),
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await googleAuth.getClient();
  const { token } = await client.getAccessToken();

  const url =
    `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}` +
    `/locations/${location}/publishers/google/models/imagen-4.0-fast-generate-001:predict`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      instances: [{ prompt: wrappedPrompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: "1:1",
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Imagen API error ${res.status}: ${err}`);
  }

  const json = (await res.json()) as {
    predictions?: Array<{ bytesBase64Encoded?: string }>;
  };
  const b64 = json.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) {
    throw new Error("Imagen response missing bytesBase64Encoded");
  }
  return Buffer.from(b64, "base64");
}

function hashPromptStyle(style: StyleId, prompt: string): string {
  return createHash("sha256")
    .update(`${style}|${prompt.toLowerCase().trim()}`)
    .digest("hex");
}

// ─── Route ────────────────────────────────────────────────────────────────────

/**
 * POST /api/ai-generate/imagen
 * Body: { prompt: string, style: StyleId }
 *
 * Pipeline: auth → Max-tier check → cache lookup (free) → quota increment
 * (only on miss) → Imagen call → R2 upload → cache write → return.
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
  const hash = hashPromptStyle(style, rawPrompt);
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

  // ── Quota check + increment (only counts a live Imagen call) ─────────────
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
    console.error("[ai-generate] Imagen error", err);
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
  });

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
