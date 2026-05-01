"use client";

import { useEffect } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useProfile } from "@/app/contexts/ProfileContext";

// Top-level routes gated by stateFlags in student-view. Order matters — used as
// fallback search order to find the first allowed page when redirecting away
// from a blocked one.
const GATED_SEGMENTS = [
  { segment: "home",       flag: "home_visible"       },
  { segment: "search",     flag: "search_visible"     },
  { segment: "categories", flag: "categories_visible" },
  { segment: "lists",      flag: "lists_visible"      },
  { segment: "settings",   flag: "settings_visible"   },
] as const;

/**
 * Mounted at AppProviders level. In student-view, if the current top-level
 * route segment is gated by a flag that is currently false, redirect to the
 * first allowed page from GATED_SEGMENTS. Instructor view never redirects.
 */
export function StudentViewRouteGuard() {
  const { viewMode, stateFlags, profileLoading } = useProfile();
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const locale = (params?.locale as string) ?? null;

  useEffect(() => {
    if (viewMode !== "student-view") return;
    if (profileLoading) return;
    if (!locale || !pathname) return;

    const stripped = pathname.replace(`/${locale}`, "");
    const currentSegment = stripped.split("/").filter(Boolean)[0];
    if (!currentSegment) return;

    const gated = GATED_SEGMENTS.find((g) => g.segment === currentSegment);
    if (!gated) return;
    if (stateFlags[gated.flag]) return;

    const fallback = GATED_SEGMENTS.find((g) => stateFlags[g.flag]);
    if (!fallback) return;
    if (fallback.segment === currentSegment) return;

    router.replace(`/${locale}/${fallback.segment}`);
  }, [viewMode, pathname, locale, stateFlags, profileLoading, router]);

  return null;
}
