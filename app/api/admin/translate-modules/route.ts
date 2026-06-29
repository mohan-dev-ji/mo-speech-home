/**
 * `/api/admin/translate-modules` — module-copy translation (ADR-014 Task E).
 *
 * Translates the COPY of every content module (`libraryModules`) into one target
 * language: module name + description, category names, list names + list-item
 * descriptions, sentence names + sentence text. English is master. Idempotent +
 * additive — a value is (re)translated only when it's missing or its English
 * source changed since the last run (tracked per row in `translationSnapshot`);
 * a good existing translation is never overwritten.
 *
 * Symbol labels are NOT translated here — category symbols resolve labels live
 * from the global `symbols` table (ADR-014 §4), already handled by the symbol
 * pipeline.
 *
 * Reuses the UI-string pipeline's Gemini 2.5 Flash path (`lib/llm/vertex.ts`).
 * Writes go to the Convex table via admin-gated mutations, so this is
 * production-capable (unlike the dev-only file-writing UI-string route), but
 * it's run manually by an admin from the Languages section.
 *
 * POST body: `{ code: string }` — ISO target language (not "en").
 * Returns: `{ ok, code, modules, translated, skipped, model }`.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import {
  buildVertexClient,
  buildStringMapSchema,
  callJsonResponse,
  VERTEX_MODEL,
  type VertexClient,
} from "@/lib/llm/vertex";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MODEL = VERTEX_MODEL;

type LS = Record<string, string>;
type Slot = { key: string; rec: LS };
type ModuleDoc = {
  _id: string;
  tree: "categories" | "lists" | "sentences";
  slug: string;
  name: LS;
  description: LS | null;
  items: unknown;
  translationSnapshot: Record<string, string>;
};

const SYSTEM_PROMPT = `You are translating content for Mo Speech, an AAC (augmentative communication) app for non-verbal children and their families.

You will receive a JSON object whose values are short pieces of content: category names, list/group names, list-item descriptions, and example sentences a child might say or that are said to them.

Rules:
1. Translate naturally and simply — these are read aloud by text-to-speech and shown to children. Prefer the everyday word a parent would use.
2. Sentences are first-person communication ("I want to open my presents") — keep that voice and keep them natural in the target language.
3. Use native script (Devanagari for Hindi, Gurmukhi for Punjabi). Do NOT romanise.
4. Preserve any placeholders, punctuation, and ellipsis (…) exactly.
5. Proper nouns / untranslatable interjections stay as-is ("Mo Speech").
6. Return a JSON object with the SAME keys mapping to the translated strings. Keep keys EXACTLY as given.`;

/** Normalise a string|record|null field to a record (or null when absent). */
function asRecord(v: unknown): LS | null {
  if (typeof v === "string") return { en: v };
  if (v && typeof v === "object") return v as LS;
  return null;
}

/**
 * Collect every translatable copy field of a module as a {key, rec} slot,
 * NORMALISING legacy string fields (list item description, sentence text) into
 * records in place so the translated value persists when written back.
 */
function collectSlots(mod: ModuleDoc): Slot[] {
  const slots: Slot[] = [];
  if (mod.name && typeof mod.name === "object") slots.push({ key: "name", rec: mod.name });
  if (mod.description && typeof mod.description === "object")
    slots.push({ key: "description", rec: mod.description });

  const items = (mod.items as Record<string, unknown>[]) ?? [];
  if (mod.tree === "categories") {
    items.forEach((cat, i) => {
      const rec = asRecord(cat.name);
      if (rec) slots.push({ key: `cat.${i}.name`, rec });
    });
  } else if (mod.tree === "lists") {
    items.forEach((list, i) => {
      const nameRec = asRecord(list.name);
      if (nameRec) slots.push({ key: `list.${i}.name`, rec: nameRec });
      const subItems = (list.items as Record<string, unknown>[]) ?? [];
      subItems.forEach((it, j) => {
        if (it.description === undefined) return;
        const rec = asRecord(it.description);
        if (rec) {
          it.description = rec; // normalise legacy string → record in place
          slots.push({ key: `list.${i}.item.${j}.desc`, rec });
        }
      });
    });
  } else {
    items.forEach((sent, i) => {
      const nameRec = asRecord(sent.name);
      if (nameRec) slots.push({ key: `sent.${i}.name`, rec: nameRec });
      if (sent.text !== undefined) {
        const rec = asRecord(sent.text);
        if (rec) {
          sent.text = rec; // normalise legacy string → record in place
          slots.push({ key: `sent.${i}.text`, rec });
        }
      }
    });
  }
  return slots;
}

async function translateBatch(
  vertex: VertexClient,
  code: string,
  entries: Record<string, string>
): Promise<Record<string, string>> {
  const keys = Object.keys(entries);
  const userPrompt = `Target language ISO code: ${code}.

Translate every value in this JSON object. Return a JSON object with the SAME keys mapping to the translated strings.

${JSON.stringify(entries, null, 2)}`;

  const { result } = await callJsonResponse(
    vertex,
    {
      systemInstruction: { role: "system", parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: buildStringMapSchema(keys),
        maxOutputTokens: 8192,
      },
    },
    (parsed) => {
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("Gemini response was not a JSON object");
      }
      const out: Record<string, string> = {};
      for (const key of keys) {
        const v = (parsed as Record<string, unknown>)[key];
        if (typeof v !== "string") {
          throw new Error(`Gemini omitted/mis-typed key "${key}" (${typeof v})`);
        }
        out[key] = v;
      }
      return out;
    }
  );
  return result;
}

export async function POST(request: Request) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !process.env.GOOGLE_CLOUD_PROJECT_ID) {
    return NextResponse.json(
      { error: "GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_CLOUD_PROJECT_ID must be set." },
      { status: 503 }
    );
  }

  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "Missing Convex token" }, { status: 401 });

  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const code = body.code;
  if (typeof code !== "string" || !/^[a-z]{2,3}(-[A-Z]{2})?$/.test(code)) {
    return NextResponse.json({ error: "`code` must be an ISO language code" }, { status: 400 });
  }
  if (code === "en") {
    return NextResponse.json({ error: "Cannot translate into the source language (en)" }, { status: 400 });
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  convex.setAuth(token);

  let modules: ModuleDoc[];
  try {
    modules = (await convex.query(
      api.contentModules.translate.getModulesForTranslation,
      {}
    )) as ModuleDoc[];
  } catch (e) {
    return NextResponse.json(
      { error: `Could not read modules: ${e instanceof Error ? e.message : e}` },
      { status: 500 }
    );
  }

  // ── Gather work + rebuild each module's snapshot ──────────────────────────
  const SEP = "␟";
  const toTranslate: Record<string, string> = {}; // globalKey → en
  const writeRefs: Record<string, Slot> = {}; // globalKey → slot
  const newSnapshots: Record<number, Record<string, string>> = {};
  let skipped = 0;

  modules.forEach((mod, mi) => {
    const slots = collectSlots(mod);
    const snap: Record<string, string> = {};
    for (const slot of slots) {
      const en = slot.rec.en;
      if (!en) continue; // no English source to translate from
      snap[slot.key] = en; // record the source we've seen (always)
      const existing = slot.rec[code];
      const prev = mod.translationSnapshot[slot.key];
      const sourceChanged = prev !== undefined && prev !== en;
      const missing = existing === undefined || existing === "";
      if (missing || sourceChanged) {
        const gk = `${mi}${SEP}${slot.key}`;
        toTranslate[gk] = en;
        writeRefs[gk] = slot;
      } else {
        skipped++;
      }
    }
    newSnapshots[mi] = snap;
  });

  // ── Translate in batches ──────────────────────────────────────────────────
  const entries = Object.entries(toTranslate);
  let translated = 0;
  if (entries.length > 0) {
    const vertex = await buildVertexClient();
    const BATCH = 100;
    try {
      for (let i = 0; i < entries.length; i += BATCH) {
        const slice = Object.fromEntries(entries.slice(i, i + BATCH));
        const result = await translateBatch(vertex, code, slice);
        for (const [gk, val] of Object.entries(result)) {
          writeRefs[gk].rec[code] = val;
          translated++;
        }
      }
    } catch (e) {
      return NextResponse.json(
        { error: `Translation failed: ${e instanceof Error ? e.message : e}` },
        { status: 502 }
      );
    }
  }

  // ── Write back the modules that changed ───────────────────────────────────
  let modulesWritten = 0;
  for (let mi = 0; mi < modules.length; mi++) {
    const mod = modules[mi];
    const snap = newSnapshots[mi];
    const hadTranslation = Object.keys(toTranslate).some((gk) =>
      gk.startsWith(`${mi}${SEP}`)
    );
    const snapChanged =
      JSON.stringify(snap) !== JSON.stringify(mod.translationSnapshot);
    if (!hadTranslation && !snapChanged) continue;
    try {
      await convex.mutation(api.contentModules.translate.applyModuleTranslation, {
        moduleId: mod._id as never,
        name: mod.name,
        ...(mod.description ? { description: mod.description } : {}),
        items: mod.items,
        translationSnapshot: snap,
      });
      modulesWritten++;
    } catch (e) {
      return NextResponse.json(
        {
          error: `Wrote ${modulesWritten} modules, then failed on ${mod.tree}/${mod.slug}: ${e instanceof Error ? e.message : e}`,
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    code,
    modules: modulesWritten,
    translated,
    skipped,
    model: MODEL,
  });
}
