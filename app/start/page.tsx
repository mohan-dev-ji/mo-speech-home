"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const languages = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिंदी" },
];

const LOCALE_KEY = "mo-speech-locale";

export default function StartPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [savedLocale, setSavedLocale] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(LOCALE_KEY);
    if (saved === "en" || saved === "hi") {
      setSavedLocale(saved);
    }
    // ?pick=true forces the picker regardless of saved locale (e.g. coming from marketing page)
    if (searchParams.get("pick") === "true") {
      setReady(true);
      return;
    }
    if (saved === "en" || saved === "hi") {
      router.replace(`/${saved}/home`);
      // keep ready=false so nothing renders while the redirect happens
    } else {
      setReady(true);
    }
  }, [router, searchParams]);

  if (!ready) return null;

  const handlePick = (code: string) => {
    localStorage.setItem(LOCALE_KEY, code);
    router.replace(`/${code}/home`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-10 p-6">
      <div className="text-center space-y-2">
        <h1 className="text-heading font-bold text-foreground">Choose your language</h1>
        <p className="text-small text-muted-foreground">You can change this later in Settings.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
        {languages.map(({ code, label, native }) => {
          const isCurrent = savedLocale === code;
          return (
            <button
              key={code}
              onClick={() => handlePick(code)}
              className={`flex-1 flex flex-col items-center justify-center gap-2 rounded-xl border-2 transition-all p-8 cursor-pointer ${
                isCurrent
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary hover:bg-muted"
              }`}
            >
              <span className="text-subheading font-semibold text-foreground">{native}</span>
              {native !== label && (
                <span className="text-small text-muted-foreground">{label}</span>
              )}
              {isCurrent && (
                <span className="text-caption text-primary font-medium">Current</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
