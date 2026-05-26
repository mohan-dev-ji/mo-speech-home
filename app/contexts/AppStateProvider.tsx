"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import posthog from "posthog-js";
import { api } from "@/convex/_generated/api";
import { track } from "@/lib/analytics";
import { deriveTier } from "@/types";
import type { UserSubscription, UserRecord } from "@/types";
import { LOCALES } from "@/lib/languages/registry";

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
      // First sign-in — create the user record, capture the current URL locale.
      // Fire `signed_up` only when the mutation actually inserted (wasCreated:
      // true). If a race produces wasCreated: false on first sign-in (e.g. two
      // tabs opened together), we'd skip the event — acceptable; the user
      // record exists either way.
      void createUser({
        clerkUserId: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress ?? "",
        name: clerkUser.fullName ?? undefined,
        locale: urlLocale ?? "en",
      }).then((result) => {
        if (result?.wasCreated) {
          track("signed_up", { has_referral_code: false });
        }
      });
    } else {
      // Returning user — update activity timestamp
      updateLastActive({ userId: userRecord._id as any });
    }
  }, [isLoaded, clerkUser, userRecord]);

  // ─── PostHog identify + opt-out respect ──────────────────────────────────────
  // Identify the user to PostHog as soon as both Clerk + Convex have resolved,
  // so all subsequent events land on the right person record. Pre-signup
  // anonymous events are aliased to the Clerk userId automatically when
  // `identify()` is called (preserves the viewed_pricing → signed_up funnel).
  //
  // Opt-out is read from the Convex record so it follows the user across
  // devices, not just the current browser. Re-runs whenever userRecord or
  // accessData changes, so person properties stay current with subscription
  // tier changes.

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    if (!clerkUser || !userRecord) return;

    if (userRecord.analyticsOptOut === true) {
      if (!posthog.has_opted_out_capturing()) {
        posthog.opt_out_capturing();
      }
      return;
    }
    // Idempotency guards — `opt_in_capturing` and `identify` each fire a
    // `$opt_in` / `$identify` event whenever called. Without these guards the
    // identify effect would re-fire those events on every reactive Convex
    // update (plan changes, locale changes, accessData refresh), flooding the
    // activity feed with metadata events and drowning real product events.
    if (!posthog.has_opted_in_capturing()) {
      posthog.opt_in_capturing();
    }
    // `posthog.get_distinct_id()` returns the current identified id, or an
    // auto-generated anonymous one. Only call `identify` if it doesn't match
    // our Clerk userId — same idempotency principle.
    if (posthog.get_distinct_id() !== clerkUser.id) {
      posthog.identify(clerkUser.id);
    }
    // setPersonProperties always emits a `$set` event but it carries genuinely
    // useful payload (tier / plan / locale changes), so leave that one alone.
    posthog.setPersonProperties({
      tier: accessData?.tier ?? deriveTier(userRecord.subscription.plan),
      plan: userRecord.subscription.plan ?? null,
      has_custom_access: !!userRecord.subscription.customAccess?.isActive,
      locale: userRecord.locale ?? null,
    });
  }, [
    clerkUser?.id,
    userRecord?._id,
    userRecord?.analyticsOptOut,
    userRecord?.subscription?.plan,
    userRecord?.locale,
    accessData?.tier,
  ]);

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
    if (!storedLocale || storedLocale === urlLocale) return;
    // Guard against redirecting to a locale that's no longer in the registry
    // (e.g. an admin removed the JSON between sessions). Without this we'd
    // redirect to /<missing>/home and trigger notFound() in [locale]/layout.
    if (!LOCALES.includes(storedLocale)) return;
    // Swap the locale segment in the current path so the user stays on the same page.
    // e.g. /en/settings → /es/settings, /en/home → /hi/home (covers sign-in redirect too).
    const newPath = window.location.pathname.replace(
      new RegExp(`^/${urlLocale}(/|$)`),
      `/${storedLocale}$1`,
    );
    router.replace(newPath);
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
    // Only mirror a locale that's actually in the registry — guards against
    // stale data persisting a locale we no longer ship (e.g. an admin
    // removed a language between sessions).
    if (!storedLocale || !LOCALES.includes(storedLocale)) return;
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
