"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useProfile } from "@/app/contexts/ProfileContext";

// Profile language → next-intl locale segment
const LANG_TO_LOCALE: Record<string, string> = {
  eng: "en",
  hin: "hi",
};

/**
 * In student-view, force the URL locale to match the active student profile's
 * language so next-intl renders the UI in that language. Mounted at the
 * AppProviders level inside ProfileProvider.
 *
 * Instructor view leaves the URL alone — instructor locale is governed by
 * `userRecord.locale` in `AppStateProvider`.
 */
export function StudentViewLocaleSync() {
  const { viewMode, studentProfile } = useProfile();
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();

  const urlLocale = (params?.locale as string) ?? null;
  const profileLang = studentProfile?.language;
  const targetLocale = profileLang ? LANG_TO_LOCALE[profileLang] : undefined;

  useEffect(() => {
    if (viewMode !== "student-view") return;
    if (!urlLocale || !targetLocale) return;
    if (urlLocale === targetLocale) return;
    router.replace(pathname, { locale: targetLocale });
  }, [viewMode, urlLocale, targetLocale, pathname, router]);

  return null;
}
