"use client";

import { routing } from "@/i18n/routing";

/**
 * First-paint splash for new visitors. Renders BEFORE any locale is established,
 * so its strings are inline bilingual constants rather than next-intl translations
 * (no locale context exists yet — which is the whole point of this screen).
 *
 * On click: writes the NEXT_LOCALE cookie that next-intl reads on subsequent
 * requests, then full-navigates to /<locale> so middleware re-runs cleanly.
 *
 * Mounted only by app/page.tsx, which gates rendering on cookie + auth absence
 * server-side — returning visitors never see this component.
 */

type LocaleCode = (typeof routing.locales)[number];

const LANGUAGES: ReadonlyArray<{ code: LocaleCode; native: string; latin: string }> = [
  { code: "en", native: "English", latin: "English" },
  { code: "hi", native: "हिंदी", latin: "Hindi" },
];

export function WelcomeSplash() {
  const handlePick = (code: LocaleCode) => {
    // eslint-disable-next-line react-hooks/immutability -- document.cookie is the standard browser API for setting cookies
    document.cookie = `NEXT_LOCALE=${code};path=/;max-age=31536000;samesite=lax`;
    window.location.assign(`/${code}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-lg flex flex-col items-center gap-12">
        {/* Brand mark */}
        <div className="text-center space-y-3">
          <h1 className="text-display font-bold text-foreground tracking-tight">
            Mo Speech Home
          </h1>
          <p className="text-subheading text-muted-foreground">
            AAC built for the world
          </p>
        </div>

        {/* Bilingual prompt */}
        <div className="text-center space-y-2">
          <p className="text-body text-foreground">
            Choose your language
          </p>
          <p className="text-body text-foreground" lang="hi">
            अपनी भाषा चुनें
          </p>
        </div>

        {/* Language buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          {LANGUAGES.map(({ code, native, latin }) => (
            <button
              key={code}
              type="button"
              onClick={() => handlePick(code)}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-border bg-card hover:border-primary hover:bg-muted transition-all p-8 cursor-pointer"
              lang={code}
            >
              <span className="text-heading font-semibold text-foreground">
                {native}
              </span>
              {native !== latin && (
                <span className="text-small text-muted-foreground">{latin}</span>
              )}
            </button>
          ))}
        </div>

        {/* Reassurance */}
        <p className="text-caption text-muted-foreground text-center">
          You can change this anytime in the navigation bar or settings.
        </p>
      </div>
    </div>
  );
}
