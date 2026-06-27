/**
 * List-module catalogue barrel (ADR-014 §1). See `categories/_index.ts` for the
 * conventions. Empty until the Phase 13 migration/curation seeds the first
 * modules.
 */

import type { ListModule } from "../_shared/types";

// ── Module imports ────────────────────────────────────────────────────────────
// 13.2 throwaway fixture — remove once 13.4 curation seeds real modules.
import testBedtime from "./test-bedtime.json";

// ── Catalogue map ─────────────────────────────────────────────────────────────
export const LIST_MODULES: Record<string, ListModule> = {
  "test-bedtime": testBedtime as ListModule,
};
