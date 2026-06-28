// Module display "class" (ADR-014 Task C) — the single, mutually-exclusive
// classification shown on a module card / detail and used by the library tab
// filters: Default · Free · Pro · Max. A Default ("core") module is
// auto-installed + free, so its badge replaces the access-tier badge.

import type { Badge } from "@/app/components/app/shared/ui/Badge";

export type ModuleClass = "default" | "free" | "pro" | "max";

export const MODULE_CLASSES: ModuleClass[] = ["default", "free", "pro", "max"];

/** Derive the display class from a module's `isDefault` flag + access tier. */
export function moduleClass(
  isDefault: boolean | undefined,
  tier: "free" | "pro" | "max"
): ModuleClass {
  return isDefault ? "default" : tier;
}

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];

/** Distinct badge look per class; tiers keep their existing colours. */
export const MODULE_CLASS_BADGE: Record<ModuleClass, BadgeVariant> = {
  default: "outline",
  free: "success",
  pro: "default",
  max: "warning",
};

/** i18n key (in the `library` namespace) for each class label. */
export const MODULE_CLASS_LABEL_KEY: Record<ModuleClass, string> = {
  default: "tierBadgeDefault",
  free: "tierBadgeFree",
  pro: "tierBadgePro",
  max: "tierBadgeMax",
};
