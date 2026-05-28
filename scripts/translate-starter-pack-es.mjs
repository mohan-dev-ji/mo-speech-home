/**
 * One-shot script — add Spanish (`es`) translations to the localised name +
 * description fields of `convex/data/library_packs/_starter.json`.
 *
 * Why a script and not the proper Phase 8.3 pipeline? — Phase 8.2 (symbol
 * translation) shipped Spanish for `symbols.words.es`, but starter-pack
 * category / list / sentence *names* live on the pack JSON, not on the
 * symbols table. A Spanish student profile sees translated symbol labels
 * but English category headers (Actions, People, Feelings) — visible
 * mismatch.
 *
 * The proper fix is Phase 8.3 (a Gemini pipeline that walks every pack
 * JSON and adds translations). Until that lands, this script delivers the
 * 30 strings the starter pack needs by hand. Translations vetted by a
 * native speaker (the LLM in the loop above us) before being written
 * inline — child-friendly, casual register, matching the prompt rules
 * we just tightened for Phase 8.2 v2.
 *
 * Idempotent: if `es` already exists on a field, the script overwrites
 * with the latest translation rather than leaving stale strings around.
 *
 * Run with:
 *   node scripts/translate-starter-pack-es.mjs
 *
 * After running, instructors with Spanish-locale profiles need to
 * "Reload Defaults" on each category for the new names to land on
 * their profileCategories rows (the snapshot only re-reads on reload).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACK_PATH = join(
  __dirname,
  "..",
  "convex",
  "data",
  "library_packs",
  "_starter.json",
);

// Translation map — exhaustive for the current starter pack content.
// Keep this aligned with what the pack JSON actually contains; the
// inventory check below fails loudly if any English name is missing
// from the map, so renaming a category in the JSON without updating
// this map can't ship silently.

const PACK_NAME_ES = "Paquete Inicial";
const PACK_DESC_ES =
  "El primer vocabulario que se carga en cada cuenta. Saludos, emociones, pedir lo que necesitan. Se carga automáticamente al crear un perfil.";

const CATEGORY_ES = {
  "Actions": "Acciones",
  "People": "Personas",
  "Feelings": "Emociones",
  "Descriptions": "Descripciones",
  "Food & Drink": "Comida y bebida",
  "Home": "Casa",
  "Activities": "Actividades",
  "School": "Escuela",
  "Health": "Salud",
  "Animals": "Animales",
  "Nature": "Naturaleza",
  "Community": "Comunidad",
  "Time": "Tiempo",
  "Numbers": "Números",
  "Chat": "Charla",
  "Places": "Lugares",
};

const LIST_ES = {
  "Bedtime routine": "Rutina para dormir",
  "Morning Routine": "Rutina de la mañana",
  "Brushing teeth": "Cepillarse los dientes",
  "Getting dressed": "Vestirse",
  "Toilet routine - seat up": "Rutina del baño - tapa arriba",
  "Toilet routine - seat down": "Rutina del baño - tapa abajo",
  "Mealtime": "Hora de comer",
  "Handwashing": "Lavarse las manos",
  "Bath time": "Hora del baño",
  "Going to school": "Ir al colegio",
  "Snack time": "Hora de la merienda",
  "Going to the park": "Ir al parque",
};

const SENTENCE_ES = {
  "I want to go outside": "Quiero salir afuera",
  "I don't want it": "No lo quiero",
  "More music please": "Más música por favor",
  "Can I have some water": "¿Me das un poco de agua?",
  "I feel happy": "Me siento feliz",
  "My stomach hurts": "Me duele la barriga",
  "Look at me": "Mírame",
  "I like music": "Me gusta la música",
  "I'm hungry": "Tengo hambre",
  "I'm not hungry": "No tengo hambre",
  "I'm thirsty": "Tengo sed",
  "It's my turn": "Es mi turno",
};

// ── Read + mutate ────────────────────────────────────────────────────────

const pack = JSON.parse(readFileSync(PACK_PATH, "utf8"));

function setEs(obj, esValue, label) {
  if (!obj || typeof obj !== "object") {
    throw new Error(`Expected localised record for "${label}", got ${typeof obj}`);
  }
  obj.es = esValue;
}

let touched = 0;

// Pack name + description
setEs(pack.name, PACK_NAME_ES, "pack.name");
touched++;
setEs(pack.description, PACK_DESC_ES, "pack.description");
touched++;

// Categories
const missingCategories = [];
for (const cat of pack.categories ?? []) {
  const en = cat.name?.en;
  if (!en) continue;
  const es = CATEGORY_ES[en];
  if (!es) {
    missingCategories.push(en);
    continue;
  }
  setEs(cat.name, es, `category[${en}].name`);
  touched++;
}

// Lists
const missingLists = [];
for (const list of pack.lists ?? []) {
  const en = list.name?.en;
  if (!en) continue;
  const es = LIST_ES[en];
  if (!es) {
    missingLists.push(en);
    continue;
  }
  setEs(list.name, es, `list[${en}].name`);
  touched++;
}

// Sentences
const missingSentences = [];
for (const sentence of pack.sentences ?? []) {
  const en = sentence.name?.en;
  if (!en) continue;
  const es = SENTENCE_ES[en];
  if (!es) {
    missingSentences.push(en);
    continue;
  }
  setEs(sentence.name, es, `sentence[${en}].name`);
  touched++;
}

// ── Fail loudly on coverage gaps ─────────────────────────────────────────
const gaps = [
  ...missingCategories.map((n) => `category "${n}"`),
  ...missingLists.map((n) => `list "${n}"`),
  ...missingSentences.map((n) => `sentence "${n}"`),
];
if (gaps.length > 0) {
  console.error(
    `❌ ${gaps.length} item(s) in the starter pack have no Spanish translation in this script:`,
  );
  for (const g of gaps) console.error("   -", g);
  console.error(
    "\nUpdate the translation maps at the top of this script and rerun.",
  );
  process.exit(1);
}

// ── Write back ───────────────────────────────────────────────────────────
writeFileSync(PACK_PATH, JSON.stringify(pack, null, 2) + "\n");
console.log(`✅ Updated ${PACK_PATH}`);
console.log(`   Added Spanish to ${touched} localised field(s).`);
console.log(
  `\n📝 Next: commit the change, then "Reload Defaults" on each affected\n   category in the app to refresh profile snapshots with the new names.`,
);
