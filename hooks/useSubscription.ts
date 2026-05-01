import { useAppState } from "@/app/contexts/AppStateProvider";
import type { SubscriptionTier } from "@/types";

export type SubscriptionCapabilities = {
  tier: SubscriptionTier;
  hasCategories: boolean;
  hasModelling: boolean;
  hasFamilyMembers: boolean;
  hasSchoolConnection: boolean;
  hasPremiumThemes: boolean;
  hasVoiceCloning: boolean;
  maxStudentProfiles: number;
};

/**
 * Returns subscription capability flags for the current user.
 * Use this hook throughout — never check the plan string directly in components.
 * Factors in hasFullAccess so cancelled-but-still-active users retain capabilities.
 */
export function useSubscription(): SubscriptionCapabilities {
  const { subscription } = useAppState();
  const { tier, hasFullAccess } = subscription;

  const isPro = hasFullAccess && (tier === "pro" || tier === "max");
  const isMax = hasFullAccess && tier === "max";

  return {
    tier,
    hasCategories: isPro,
    hasModelling: isPro,
    hasFamilyMembers: isMax,
    hasSchoolConnection: isMax,
    hasPremiumThemes: isMax,
    hasVoiceCloning: isMax,
    maxStudentProfiles: isMax ? Infinity : 1,
  };
}
