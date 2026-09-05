/**
 * Regenerate the AI Generate style thumbnails (MOS-47).
 *
 *   node --env-file=.env.local scripts/generate-style-thumbnails.mjs
 *   node --env-file=.env.local scripts/generate-style-thumbnails.mjs storybook
 *   node --env-file=.env.local scripts/generate-style-thumbnails.mjs \
 *     --subject="wooden rocking horse" --out=/tmp/trial-horse
 *
 * Writes 1024px PNGs to public/ai-styles/. Downscale them to 320px webp
 * before committing — the raw PNGs are ~700 KB each and the webps are ~5 KB:
 *
 *   node -e 'const sharp=require("sharp");for(const s of ["photorealistic","iconic","storybook","claymation"])
 *     sharp(`public/ai-styles/${s}.png`).resize(320,320,{fit:"inside"}).webp({quality:82}).toFile(`public/ai-styles/${s}.webp`)'
 *
 * WHY A SCRIPT AND NOT THE APP: these are static assets shipped with the UI,
 * so generating them must never touch a user's 10/day quota. It also bypasses
 * the app's cache entirely, which is what you want — a thumbnail should show
 * what the CURRENT template produces, not whatever is cached.
 *
 * REGENERATE WHENEVER A TEMPLATE CHANGES. A stale thumbnail is worse than
 * none: it actively misrepresents what the style will give you. Same if the
 * model changes — the four templates are only known-good against
 * `gemini-2.5-flash-image` (MOS-40).
 *
 * The templates below are COPIED from lib/ai-style-prompts.ts rather than
 * imported, because that file is TypeScript and this is a plain .mjs one-off.
 * If they drift, the thumbnails lie. Diff them when you regenerate.
 *
 * Vertex rate-limits image requests hard (HTTP 429 after ~4 in quick
 * succession), hence the 20s pause between styles. Pass style names as
 * arguments to redo just those.
 */

import { GoogleAuth } from "google-auth-library";
import { writeFileSync, mkdirSync } from "node:fs";

const MODEL = "gemini-2.5-flash-image";
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
const location = process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";
const auth = new GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});
const client = await auth.getClient();
const { token } = await client.getAccessToken();
const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${MODEL}:generateContent`;

// Mirrors lib/ai-style-prompts.ts exactly (kept in sync by hand here because
// this is a one-off generator, not shipped code).
// Subject and output dir are overridable so a candidate subject can be
// trialled without clobbering the committed set:
//   --subject="wooden rocking horse"  --out=/tmp/trial-horse
// Bare arguments are still style names, so the old invocation is unchanged.
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
// THE DEFAULT SUBJECT IS THE COMMITTED SET'S SUBJECT. Keep them the same, or
// a routine "regenerate because a template changed" silently swaps the subject
// too, and the four thumbnails stop being comparable with each other.
//
// It was "a racing car" until 2026-09-04 (MOS-47). Rejected as AI slop: a
// generic subject gives the model nothing to hold onto, and photorealistic and
// claymation both came back as much the same shiny red 3D car — which defeats
// the point, since these images exist to show that the four styles DIFFER.
// The rocking horse separates them cleanly: real wood grain / flat outlined
// sticker / pastel storybook / soft clay.
const SUBJECT = flag("subject", "wooden rocking horse");
const OUT_DIR = flag("out", "public/ai-styles");
// The subject is the BARE object name ("wooden rocking horse"); the template
// supplies the article, exactly as lib/ai-style-prompts.ts does. Keep these
// four strings byte-identical to that file's templates.
const withArticle = (s) => (/^[aeiou]/i.test(s.trim()) ? `an ${s.trim()}` : `a ${s.trim()}`);
const TEMPLATES = {
  photorealistic: (p) => `studio product shot of ${withArticle(p)}, isolated on a pure white background, single subject only, no ground, no shadow, no scenery, no environment, no text`,
  iconic:         (p) => `a simple flat vector icon of ${withArticle(p)}, with bold black outlines, single subject only, isolated on a pure white background, die-cut sticker style, no ground, no scenery, no text`,
  storybook:      (p) => `a friendly children's storybook illustration of ${withArticle(p)}, as a single subject only, isolated on a pure white background, soft pastel colours, no ground, no scenery, no environment, no text`,
  claymation:     (p) => `a soft 3D claymation render of ${withArticle(p)}, as a single subject only, isolated on a pure white background, cute, no ground, no shadow, no scenery, no text`,
};

const styleArgs = argv.filter((a) => !a.startsWith("--"));
const order = styleArgs.length ? styleArgs : Object.keys(TEMPLATES);
mkdirSync(OUT_DIR, { recursive: true });
console.log(`subject: "${SUBJECT}"  ->  ${OUT_DIR}/`);
for (const style of order) {
  const prompt = TEMPLATES[style](SUBJECT);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { imageConfig: { aspectRatio: "1:1" } } }),
  });
  if (!res.ok) { console.log(`  ${style.padEnd(16)} HTTP ${res.status} — rerun this style later`); continue; }
  const j = await res.json();
  const part = (j.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data);
  if (!part) { console.log(`  ${style.padEnd(16)} REFUSED blockReason=${j.promptFeedback?.blockReason ?? "?"}`); continue; }
  const buf = Buffer.from(part.inlineData.data, "base64");
  const out = `${OUT_DIR}/${style}.png`;
  writeFileSync(out, buf);
  console.log(`  ${style.padEnd(16)} ✅ ${out}  ${(buf.length / 1024).toFixed(0)} KB`);
  await new Promise((r) => setTimeout(r, 20000)); // stay under the per-minute cap
}
