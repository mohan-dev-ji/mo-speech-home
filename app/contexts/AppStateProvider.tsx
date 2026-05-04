"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { UserSubscription, UserRecord } from "@/types";

type AppStateContextValue = {
  userRecord: UserRecord | null | undefined;
  subscription: UserSubscription;
  isCollaborator: boolean;
  isLoading: boolean;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const { user: clerkUser, isLoaded } = useUser();
  const hasSynced = useRef(false);
  const params = useParams();
  const router = useRouter();
  // urlLocale is the locale segment in the current path, e.g. 'en' or 'hi'
  const urlLocale = (params?.locale as string) ?? null;

  // ─── Convex queries ──────────────────────────────────────────────────────────

  const userRecord = useQuery(api.users.getMyUser) as UserRecord | null | undefined;
  const accessData = useQuery(api.users.getMyAccess);
  const membership = useQuery(api.accountMembers.getMyMembership);

  // ─── Mutations ───────────────────────────────────────────────────────────────

  const createUser = useMutation(api.users.createUser);
  const updateLastActive = useMutation(api.users.updateLastActive);

  // ─── User sync — runs once when Convex resolves the user record ───────────────

  useEffect(() => {
    if (!isLoaded || !clerkUser) return;
    if (userRecord === undefined) return; // still loading
    if (hasSynced.current) return;

    hasSynced.current = true;

    if (userRecord === null) {
      // First sign-in — create the user record, capture the current URL locale
      createUser({
        clerkUserId: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress ?? "",
        name: clerkUser.fullName ?? undefined,
        locale: urlLocale ?? "en",
      });
    } else {
      // Returning user — update activity timestamp
      updateLastActive({ userId: userRecord._id as any });
    }
  }, [isLoaded, clerkUser, userRecord]);

  // ─── Locale mismatch redirect — returning users only ─────────────────────────
  // If the stored locale differs from the current URL locale, redirect.
  // This handles sign-in which always lands on /en/home regardless of preference.
  // In student-view, StudentViewLocaleSync owns the URL locale, so this skips.

  useEffect(() => {
    if (!userRecord || !urlLocale || !router) return;
    const isStudentView =
      typeof window !== "undefined" &&
      window.sessionStorage.getItem("mo-view-mode") === "student-view";
    if (isStudentView) return;
    const storedLocale = userRecord.locale;
    if (storedLocale && storedLocale !== urlLocale) {
      // Swap the locale segment in the current path so the user stays on the same page.
      // e.g. /en/settings → /hi/settings, /en/home → /hi/home (covers sign-in redirect too).
      const newPath = window.location.pathname.replace(
        new RegExp(`^/${urlLocale}(/|$)`),
        `/${storedLocale}$1`,
      );
      router.replace(newPath);
    }
  }, [userRecord?.locale, urlLocale]);

  // ─── NEXT_LOCALE cookie sync ─────────────────────────────────────────────────
  // Mirror users.locale (the instructor's preference) to the NEXT_LOCALE cookie
  // on every authed page load. Closes the gap where a user signs in on a new
  // device with no cookie set, or where the cookie drifted (e.g. browsed
  // /hi/library while logged out, set cookie=hi via Accept-Language fallback,
  // but their actual users.locale=en). Without this sync, signing out on the
  // new device would route them via the splash dispatcher to the wrong locale.
  // The cookie tracks the INSTRUCTOR locale only — student profile language is
  // a separate concern handled by StudentViewLocaleSync and never touches it.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const storedLocale = userRecord?.locale;
    if (storedLocale !== "en" && storedLocale !== "hi") return;
    const cookieMatch = document.cookie.match(/(?:^|; )NEXT_LOCALE=([^;]+)/);
    if (cookieMatch?.[1] === storedLocale) return;
    document.cookie = `NEXT_LOCALE=${storedLocale};path=/;max-age=31536000;samesite=lax`;
  }, [userRecord?.locale]);

  // ─── Derived subscription status ─────────────────────────────────────────────

  const subscription: UserSubscription = {
    tier: accessData?.tier ?? "free",
    status: accessData?.status ?? "trial",
    hasFullAccess: accessData?.hasFullAccess ?? false,
    plan: accessData?.plan ?? null,
    subscriptionEndsAt: accessData?.subscriptionEndsAt ?? null,
    loading: accessData === undefined,
  };

  const isCollaborator = membership?.status === "active";

  const isLoading =
    userRecord === undefined ||
    accessData === undefined ||
    accessData === null;

  return (
    <AppStateContext.Provider value={{ userRecord, subscription, isCollaborator, isLoading }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
