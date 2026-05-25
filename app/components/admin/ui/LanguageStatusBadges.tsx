import { Badge } from "@/app/components/app/shared/ui/Badge";
import type {
  LanguagePublishStatus,
  LanguageTranslationStatus,
} from "@/app/components/admin/constants";

/**
 * Visual badge for a language's derived publish-window status. Computed
 * server-side in `listAllLanguagesForAdmin` from publishedAt/expiresAt.
 * Same axis as the Library equivalent — orthogonal to translation status.
 */
export function LanguagePublishStatusBadge({
  status,
}: {
  status: LanguagePublishStatus;
}) {
  switch (status) {
    case "live":
      return <Badge variant="success">Live</Badge>;
    case "scheduled":
      return <Badge variant="default">Scheduled</Badge>;
    case "expired":
      return <Badge variant="warning">Expired</Badge>;
    case "draft":
    default:
      return <Badge variant="outline">Draft</Badge>;
  }
}

/**
 * Visual badge for translation maturity per ADR-009 §3:
 *
 *   machine-translated — AI-generated, hidden in prod pickers by default
 *   beta              — reviewed, shown with a "preview" pill
 *   stable            — fully reviewed, no pill
 *
 * Distinct from the publish-window status above. A language can be `beta`
 * while still `scheduled` to go live next week.
 */
export function LanguageTranslationStatusBadge({
  status,
}: {
  status: LanguageTranslationStatus;
}) {
  switch (status) {
    case "stable":
      return <Badge variant="success">Stable</Badge>;
    case "beta":
      return <Badge variant="default">Beta</Badge>;
    case "machine-translated":
    default:
      return <Badge variant="outline">Machine</Badge>;
  }
}
