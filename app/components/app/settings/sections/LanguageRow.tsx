"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { api } from "@/convex/_generated/api";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const LANGUAGES: ReadonlyArray<{ code: (typeof routing.locales)[number]; label: string }> = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिंदी" },
];

/**
 * Top-of-Settings language switcher. Always visible (not buried in a modal),
 * signalling that locale change is one tap. Writes the same triad as the
 * marketing LocaleSwitcher: setMyLocale mutation + NEXT_LOCALE cookie + URL
 * locale swap. Instant apply, no save button.
 */
export function LanguageRow() {
  const t = useTranslations("settings.language");
  const locale = useLocale() as (typeof routing.locales)[number];
  const router = useRouter();
  const pathname = usePathname();
  const setMyLocale = useMutation(api.users.setMyLocale);

  const handlePick = async (next: (typeof routing.locales)[number]) => {
    if (next === locale) return;
    // eslint-disable-next-line react-hooks/immutability -- document.cookie is the standard browser API for setting cookies
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000;samesite=lax`;
    void setMyLocale({ locale: next });
    router.replace(pathname, { locale: next });
  };

  return (
    <section className="rounded-theme bg-theme-card p-theme-general flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <p className="text-theme-p font-semibold text-theme-alt-text">{t("title")}</p>
        <p className="text-theme-s text-theme-secondary-text">{t("helperText")}</p>
      </div>
      <div className="flex gap-2">
        {LANGUAGES.map(({ code, label }) => (
          <button
            key={code}
            type="button"
            onClick={() => handlePick(code)}
            className={cn(
              "px-5 py-2 rounded-theme text-theme-s font-medium border transition-colors",
              locale === code
                ? "bg-theme-button-highlight text-theme-text border-transparent"
                : "bg-theme-primary text-theme-alt-text border-theme-line hover:opacity-90"
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
