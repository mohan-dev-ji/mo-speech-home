import { Badge } from "@/app/components/app/shared/ui/Badge";
import type { PackLifecycleStatus } from "@/app/components/admin/constants";

/**
 * Visual badge for a pack's derived lifecycle status. Status is computed
 * server-side in `listAllPacksForAdmin` from publishedAt/expiresAt, so this
 * component is pure presentation.
 *
 *   draft     — never published (no lifecycle row or null publishedAt)
 *   scheduled — publishedAt is in the future
 *   live      — currently visible at /library
 *   expired   — past expiresAt; admin can republish by clearing expiresAt
 */
export function PackStatusBadge({ status }: { status: PackLifecycleStatus }) {
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
