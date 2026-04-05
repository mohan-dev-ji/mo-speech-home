import { Badge } from "@/app/components/shared/ui/Badge";
import type { SubscriptionTier } from "@/types";

const config: Record<SubscriptionTier, { label: string; variant: "default" | "warning" | "success" | "outline" }> = {
  free: { label: "Free", variant: "outline" },
  pro: { label: "Pro", variant: "default" },
  business: { label: "Business", variant: "success" },
};

export function SubscriptionBadge({ tier }: { tier: SubscriptionTier }) {
  const { label, variant } = config[tier];
  return <Badge variant={variant}>{label}</Badge>;
}
