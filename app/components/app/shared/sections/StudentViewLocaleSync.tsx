"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useProfile } from "@/app/contexts/ProfileContext";
import { LOCALES } from "@/lib/languages/registry";

/**
 * In student-view, force the URL locale to match the active student profile's
 * language so next-intl renders the UI in that language. Mounted at the
 * AppProviders level inside ProfileProvider.
 *
 * Instructor view leaves the URL alone — instructor locale is governed by
 * `userRecord.locale` in `AppStateProvider`.
 *
 * Post Phase 8.0 the `studentProfiles.language` field is stored as an ISO
 * 639-1 code (`en`, `hi`, `es`, `pa`, …) — same shape as the URL locale
 * segment — so no remapping is needed. We still guard against languages
 * that have been removed from the registry between sessions so we never
 * redirect to a non-routable locale.
 */
export function StudentViewLocaleSync() {
  const { viewMode, studentProfile } = useProfile();
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();

  const urlLocale = (params?.locale as string) ?? null;
  const targetLocale = studentProfile?.language;

  useEffect(() => {
    if (viewMode !== "student-view") return;
    if (!urlLocale || !targetLocale) return;
    if (urlLocale === targetLocale) return;
    if (!LOCALES.includes(targetLocale)) return;
    router.replace(pathname, { locale: targetLocale as never });
  }, [viewMode, urlLocale, targetLocale, pathname, router]);

  return null;
}
