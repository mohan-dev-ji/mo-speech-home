"use client";

import { useEffect, useRef, useState } from "react";
// /post-signup is OUTSIDE the [locale] segment, so no NextIntlClientProvider
// wraps it. Use plain next/navigation router and prefix the locale manually.
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ToastProvider, useToast } from "@/app/components/app/shared/ui/Toast";

const RESUME_KEY = "library:resume";

/**
 * Invisible Clerk redirect target for sign-up completion.
 *
 * Reads `library:resume` from localStorage (written by LoadPackButton when a
 * logged-out visitor clicks "Sign up to load") and the NEXT_LOCALE cookie,
 * then dispatches:
 *   - Resume queued → loadResourcePack → /<locale>/categories
 *   - Otherwise → /<locale>/home
 *
 * User sees a centered spinner for ~200ms before the redirect fires.
 *
 * Wrapped in ToastProvider because the load-success toast must show through to
 * the destination page (the AAC shell's own ToastProvider takes over once the
 * router replaces). For the brief window between mount and redirect, this
 * provider catches any error toast.
 */
function PostSignupDispatch() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const loadPack = useMutation(api.resourcePacks.loadResourcePack);
  const { showToast } = useToast();
  const dispatchedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dispatchedRef.current) return;
    if (!isLoaded || !isSignedIn) return;
    dispatchedRef.current = true;

    let cancelled = false;
    (async () => {
      // Read NEXT_LOCALE cookie (client-side parse — no headers API here).
      const localeMatch = document.cookie.match(/(?:^|; )NEXT_LOCALE=([^;]+)/);
      const locale = localeMatch?.[1] === "hi" ? "hi" : "en";

      // Read library:resume from localStorage.
      let resumePackId: Id<"resourcePacks"> | null = null;
      try {
        const raw = localStorage.getItem(RESUME_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { packId?: string };
          if (parsed.packId) {
            resumePackId = parsed.packId as Id<"resourcePacks">;
          }
        }
      } catch {
        // Malformed entry — ignore and fall through to /home.
      }

      // No resume queued → straight to home (locale-prefixed).
      if (!resumePackId) {
        if (!cancelled) router.replace(`/${locale}/home`);
        return;
      }

      // Resume queued → load + redirect to categories (locale-prefixed).
      try {
        await loadPack({ packId: resumePackId });
        try {
          localStorage.removeItem(RESUME_KEY);
        } catch {
          // Non-fatal — cookie/storage may be partially blocked.
        }
        if (!cancelled) {
          showToast({ tone: "info", title: "Pack loaded into your profile." });
          router.replace(`/${locale}/categories`);
        }
      } catch (e: unknown) {
        // Don't strand the user on /post-signup. Log and route to /home with a toast.
        try { localStorage.removeItem(RESUME_KEY); } catch { /* ignore */ }
        if (cancelled) return;
        if (
          e instanceof ConvexError &&
          typeof e.data === "object" &&
          e.data !== null &&
          "code" in e.data &&
          (e.data as { code: string }).code === "ALREADY_LOADED"
        ) {
          showToast({ tone: "info", title: "This pack is already in your profile." });
          router.replace(`/${locale}/categories`);
        } else {
          setError("We couldn't load the pack — taking you home.");
          showToast({ tone: "warning", title: "Couldn't load this pack. Try again from the library." });
          setTimeout(() => router.replace(`/${locale}/home`), 800);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, loadPack, router, showToast]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
      <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
      {error && (
        <p className="text-small text-muted-foreground">{error}</p>
      )}
    </div>
  );
}

export default function PostSignupPage() {
  return (
    <ToastProvider>
      <PostSignupDispatch />
    </ToastProvider>
  );
}
