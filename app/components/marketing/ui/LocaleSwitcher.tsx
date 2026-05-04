"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { ChevronDown } from "lucide-react";
import { routing } from "@/i18n/routing";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const LOCALE_LABELS: Record<(typeof routing.locales)[number], string> = {
  en: "EN",
  hi: "HI",
};

/**
 * Locale dropdown for the public Navbar. Trigger shows the current locale code;
 * dropdown lists every other locale. Selecting a locale calls
 * `router.replace(pathname, { locale })` so the URL segment swaps and the rest
 * of the path is preserved (e.g. /en/library → /hi/library).
 *
 * Auto-grows when more locales are added to routing.locales.
 */
export function LocaleSwitcher() {
  const currentLocale = useLocale() as (typeof routing.locales)[number];
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const otherLocales = routing.locales.filter((l) => l !== currentLocale);

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1 px-2 py-1 rounded-md text-small font-medium",
          "text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
          "border border-border"
        )}
        aria-label="Switch language"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {LOCALE_LABELS[currentLocale]}
        <ChevronDown className={cn("w-3 h-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 mt-1 min-w-[5rem] rounded-md border border-border bg-card shadow-lg overflow-hidden z-50"
        >
          {otherLocales.map((locale) => (
            <li key={locale}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  setOpen(false);
                  // Persist via NEXT_LOCALE cookie so future visits to bare `/`
                  // skip the splash and respect this choice.
                  document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=31536000;samesite=lax`;
                  router.replace(pathname, { locale });
                }}
                className="w-full text-left px-3 py-2 text-small text-foreground hover:bg-muted transition-colors"
              >
                {LOCALE_LABELS[locale]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
