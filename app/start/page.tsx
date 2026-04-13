"use client";

import { useRouter } from "next/navigation";
import { Suspense } from "react";

const languages = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi",   native: "हिंदी"   },
];

function StartPageContent() {
  const router = useRouter();

  const handlePick = (code: string) => {
    // Navigate to the app — AppStateProvider will save this locale to users.locale
    // on first sign-up, or the locale mismatch redirect handles returning users.
    router.replace(`/${code}/home`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-10 p-6">
      <div className="text-center space-y-2">
        <h1 className="text-heading font-bold text-foreground">Choose your language</h1>
        <p className="text-small text-muted-foreground">You can change this later in Settings.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
        {languages.map(({ code, label, native }) => (
          <button
            key={code}
            onClick={() => handlePick(code)}
            className="flex-1 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-border bg-card hover:border-primary hover:bg-muted transition-all p-8 cursor-pointer"
          >
            <span className="text-subheading font-semibold text-foreground">{native}</span>
            {native !== label && (
              <span className="text-small text-muted-foreground">{label}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function StartPage() {
  return (
    <Suspense>
      <StartPageContent />
    </Suspense>
  );
}
