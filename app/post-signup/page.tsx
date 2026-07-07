"use client";

import { useEffect, useRef } from "react";
// /post-signup is OUTSIDE the [locale] segment, so no NextIntlClientProvider
// wraps it. Use plain next/navigation router and prefix the locale manually.
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

/**
 * Invisible Clerk redirect target for sign-up completion.
 *
 * Reads the NEXT_LOCALE cookie and sends the new user to their locale home.
 * The legacy `library:resume` / `loadResourcePackV2` branch was removed with
 * the resource-pack teardown (Phase 14.5 Stage 2) — there is no longer a
 * logged-out "load pack" flow to resume, so every new sign-up goes to /home.
 *
 * User sees a centered spinner for ~200ms before the redirect fires.
 */
export default function PostSignupPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const dispatchedRef = useRef(false);

  useEffect(() => {
    if (dispatchedRef.current) return;
    if (!isLoaded || !isSignedIn) return;
    dispatchedRef.current = true;

    // Read NEXT_LOCALE cookie (client-side parse — no headers API here).
    const localeMatch = document.cookie.match(/(?:^|; )NEXT_LOCALE=([^;]+)/);
    const locale = localeMatch?.[1] === "hi" ? "hi" : "en";
    router.replace(`/${locale}/home`);
  }, [isLoaded, isSignedIn, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
      <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
    </div>
  );
}
