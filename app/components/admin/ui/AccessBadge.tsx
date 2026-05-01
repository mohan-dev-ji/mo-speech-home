import { Badge } from "@/app/components/app/shared/ui/Badge";
import type { SubscriptionTier, SubscriptionStatus } from "@/types";

export function AccessBadge({ tier, status }: { tier: SubscriptionTier; status: SubscriptionStatus }) {
  if (status === "past_due") return <Badge variant="destructive">Past due</Badge>;
  if (status === "cancelled") return <Badge variant="warning">Cancelled</Badge>;
  if (tier === "max") return <Badge variant="success">Max</Badge>;
  if (tier === "pro") return <Badge variant="default">Pro</Badge>;
  return <Badge variant="outline">Free</Badge>;
}
