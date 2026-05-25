"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { ChevronDown } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { usePathname } from "@/i18n/navigation";
import { LANGUAGES } from "@/lib/languages/registry";
import { cn } from "@/lib/utils";

/**
 * Locale dropdown for the public Navbar. Trigger shows the current locale
 * code; dropdown lists every other visible locale per ADR-011 §3.
 *
 * Visibility is gated by `languages.getVisibleLanguages` (Phase 8.1) —
 * only languages with a live `languageLifecycle` row whose status is
 * `beta` or `stable` show in production. Beta languages render with a
 * "preview" pill so users know the translations may be rough.
 *
 * Falls back to the static registry while the Convex query loads so the
 * first paint isn't blank. The fallback hides nothing — once the live
 * data arrives, draft / machine-translated languages disappear.
 *
 * Selecting a locale calls `router.replace(pathname, { locale })` so the
 * URL segment swaps and the rest of the path is preserved
 * (`/en/library → /es/library`).
 */
export function LocaleSwitcher() {
  const currentLocale = useLocale();
  // `pathname` is locale-stripped (next-intl's nav helper), so we can splice
  // any new locale segment in front of it.
  const pathname = usePathname();
  const { isSignedIn } = useUser();
  const setMyLocale = useMutation(api.users.setMyLocale);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Beta languages are visible in production with a "preview" pill.
  // Machine-translated languages stay hidden — admin promotes to beta
  // explicitly when reviewers sign off.
  const visible = useQuery(api.languages.getVisibleLanguages, {
    includeBeta: true,
  });

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

  // Fallback to the static registry until the Convex query hydrates. The
  // fallback shows every registered language; once the query resolves it
  // filters to just the visible ones.
  const entries =
    visible ??
    LANGUAGES.map((l) => ({
      code: l.code,
      label: l.label,
      nativeLabel: l.nativeLabel,
      dir: l.dir,
      // Optimistic — treat as stable so nothing shows a preview pill before hydration.
      status: "stable" as const,
    }));

  const current = entries.find((l) => l.code === currentLocale);
  const others = entries.filter((l) => l.code !== currentLocale);

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
        {(current?.code ?? currentLocale).toUpperCase()}
        <ChevronDown className={cn("w-3 h-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 mt-1 min-w-[10rem] rounded-md border border-border bg-card shadow-lg overflow-hidden z-50"
        >
          {others.map((locale) => (
            <li key={locale.code}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  setOpen(false);
                  // Persist via NEXT_LOCALE cookie so future visits to bare `/`
                  // skip the splash and respect this choice.
                  document.cookie = `NEXT_LOCALE=${locale.code};path=/;max-age=31536000;samesite=lax`;
                  // If signed in, also write the choice to users.locale so
                  // AppStateProvider's mismatch redirect respects it on the
                  // next app-route visit. Without this, the user's stored
                  // locale stays as the old one and bounces them back.
                  // Fire-and-forget — the hard nav below is the load-bearing
                  // path; the mutation is the durability tail.
                  if (isSignedIn) {
                    setMyLocale({ locale: locale.code }).catch((e) =>
                      // eslint-disable-next-line no-console
                      console.error("[LocaleSwitcher] setMyLocale failed", e)
                    );
                  }
                  // Hard navigation — guarantees the `[locale]` layout
                  // re-renders with new messages. Soft `router.replace` works
                  // for locales bundled at first build (en/hi) but flakes for
                  // locales added mid-session because Next sometimes preserves
                  // the parallel-route boundary instead of re-rendering the
                  // layout that carries the NextIntlClientProvider. The flash
                  // is invisible on a fast page.
                  const search =
                    typeof window !== "undefined"
                      ? window.location.search
                      : "";
                  window.location.assign(`/${locale.code}${pathname}${search}`);
                }}
                className="w-full text-left px-3 py-2 text-small text-foreground hover:bg-muted transition-colors flex items-center justify-between gap-2"
              >
                <span>
                  {locale.nativeLabel}
                  <span className="text-muted-foreground font-mono ml-2 text-caption">
                    {locale.code.toUpperCase()}
                  </span>
                </span>
                {locale.status === "beta" && (
                  <span className="inline-flex items-center rounded-full bg-primary/10 text-primary text-caption px-2 py-0.5">
                    preview
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
