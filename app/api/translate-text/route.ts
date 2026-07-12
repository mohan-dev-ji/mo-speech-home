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
 * POST `{ text: string, targetLang: string }` → `{ translated: string }`.
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

  let body: { text?: unknown; targetLang?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const targetLang = typeof body.targetLang === "string" ? body.targetLang : "";
  if (!text || !targetLang) {
    return NextResponse.json(
      { error: "Both `text` and `targetLang` are required." },
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
                text: `Target language: ${lang.label} (${lang.nativeLabel}, ISO: ${lang.code}).\n\nTranslate the value in this JSON object. Return a JSON object with the SAME key mapping to the translation.\n\n${JSON.stringify({ text }, null, 2)}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: buildStringMapSchema(["text"]),
          maxOutputTokens: 1024,
        },
      },
      (parsed) => {
        const v = (parsed as Record<string, unknown> | null)?.text;
        if (typeof v !== "string" || !v.trim()) {
          throw new Error("Gemini returned no translation");
        }
        return v.trim();
      },
    );
    return NextResponse.json({ translated: result });
  } catch (err) {
    console.error("[translate-text] failed", err);
    return NextResponse.json(
      { error: "Translation failed. Please try again or edit manually." },
      { status: 502 },
    );
  }
}
