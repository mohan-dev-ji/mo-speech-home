/**
 * PhraseModule catalogue barrel (ADR-015). Like the other tree barrels, these
 * JSON files are the git backup/restore artifact for the libraryModules table
 * (tree: "phrases") — NOT the live source. The live source is the Convex table;
 * seed via `migrations.seedLibraryModulesFromJSON`.
 */

import type { PhraseModule } from "../_shared/types";

// ── Module imports ────────────────────────────────────────────────────────────
import everyday from "./everyday.json";
import feelings from "./feelings.json";
import social from "./social.json";

// ── Catalogue map ─────────────────────────────────────────────────────────────
export const PHRASE_MODULES: Record<string, PhraseModule> = {
  "everyday": everyday as PhraseModule,
  "feelings": feelings as PhraseModule,
  "social": social as PhraseModule,
};
