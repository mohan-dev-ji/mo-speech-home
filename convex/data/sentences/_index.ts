/**
 * Sentence-module catalogue barrel (ADR-014 §1). See `categories/_index.ts` for
 * the conventions. Empty until the Phase 13 migration/curation seeds the first
 * modules.
 */

import type { SentenceModule } from "../_shared/types";

// ── Module imports ────────────────────────────────────────────────────────────
// 13.2 throwaway fixture — remove once 13.4 curation seeds real modules.
import testPhrases from "./test-phrases.json";

// ── Catalogue map ─────────────────────────────────────────────────────────────
export const SENTENCE_MODULES: Record<string, SentenceModule> = {
  "test-phrases": testPhrases as SentenceModule,
};
