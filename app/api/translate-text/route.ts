/**
 * `/api/translate-text` — translate ONE short string on demand (ADR-016
 * Addendum B/C: MT-assist for variant authoring). The instructor writes/owns
 * the symbol ORDER; MT supplies the target-language TEXT so an author who can't
 * type the target script can still create a native variant. MT is a starting
 * point the human re-orders — never shipped unreviewed.
 *
 * Reuses the shared Vertex/Gemini client (`lib/llm/vertex.ts`) — the same
 * provider as the batch translate pipelines, but a lightweight single-string
 * call. Auth: any signed-in user (Clerk), NOT admin — instructors invoke it.
 *
 * POST `{ texts: string[], targetLang: string }` → `{ translations: string[] }`
 * (aligned by index). Batched so a block sentence's unit labels translate in one
 * call. A single string is just `texts: [one]`.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  buildVertexClient,
  buildStringMapSchema,
  callJsonResponse,
} from "@/lib/llm/vertex";
import { getLanguage } from "@/lib/languages/registry";

const SYSTEM_PROMPT = `You are a professional translator for an AAC (Augmentative and Alternative Communication) app used by families and children. Translate the given short phrase or sentence naturally and simply, as a caregiver would say it. Keep it concise and child-appropriate. Return ONLY the translation of the value, under the same JSON key. Leave proper nouns and interjections ("Mo Speech", "AAC", names) unchanged.`;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  let body: { texts?: unknown; targetLang?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const texts = Array.isArray(body.texts)
    ? body.texts.map((s) => (typeof s === "string" ? s : "")).map((s) => s.trim())
    : [];
  const targetLang = typeof body.targetLang === "string" ? body.targetLang : "";
  if (texts.length === 0 || texts.some((s) => !s) || !targetLang) {
    return NextResponse.json(
      { error: "`texts` (non-empty strings) and `targetLang` are required." },
      { status: 400 },
    );
  }

  const lang = getLanguage(targetLang);
  if (!lang) {
    return NextResponse.json(
      { error: `Unknown target language "${targetLang}".` },
      { status: 400 },
    );
  }

  // Key each string by its index so the model returns a keyed map we can realign.
  const entries: Record<string, string> = {};
  texts.forEach((s, i) => { entries[String(i)] = s; });
  const keys = Object.keys(entries);

  try {
    const vertex = await buildVertexClient();
    const { result } = await callJsonResponse(
      vertex,
      {
        systemInstruction: { role: "system", parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Target language: ${lang.label} (${lang.nativeLabel}, ISO: ${lang.code}).\n\nTranslate every value in this JSON object. Return a JSON object with the SAME keys mapping to the translations.\n\n${JSON.stringify(entries, null, 2)}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: buildStringMapSchema(keys),
          maxOutputTokens: 4096,
        },
      },
      (parsed) => {
        const obj = parsed as Record<string, unknown> | null;
        return keys.map((k) => {
          const v = obj?.[k];
          if (typeof v !== "string" || !v.trim()) {
            throw new Error(`Gemini omitted key "${k}"`);
          }
          return v.trim();
        });
      },
    );
    return NextResponse.json({ translations: result });
  } catch (err) {
    console.error("[translate-text] failed", err);
    return NextResponse.json(
      { error: "Translation failed. Please try again or edit manually." },
      { status: 502 },
    );
  }
}
