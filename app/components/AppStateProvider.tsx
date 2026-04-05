"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { UserSubscription, UserRecord } from "@/types";

type AppStateContextValue = {
  userRecord: UserRecord | null | undefined;
  subscription: UserSubscription;
  isLoading: boolean;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const { user: clerkUser, isLoaded } = useUser();
  const hasSynced = useRef(false);

  // ─── Convex queries (JWT-verified, real-time via WebSocket) ──────────────────

  const userRecord = useQuery(api.users.getMyUser) as UserRecord | null | undefined;
  const accessData = useQuery(api.users.getMyAccess);

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
      // First sign-in — create the user record
      createUser({
        clerkUserId: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress ?? "",
        name: clerkUser.fullName ?? undefined,
      });
    } else {
      // Returning user — update activity timestamp
      updateLastActive({ userId: userRecord._id as any });
    }
  }, [isLoaded, clerkUser, userRecord]);

  // ─── Derived subscription status ─────────────────────────────────────────────

  const subscription: UserSubscription = {
    tier: accessData?.tier ?? "free",
    status: accessData?.status ?? "free",
    hasFullAccess: accessData?.hasFullAccess ?? false,
    plan: accessData?.plan ?? null,
    subscriptionEndsAt: accessData?.subscriptionEndsAt ?? null,
    loading: accessData === undefined,
  };

  // Both queries return null (not undefined) when the Convex WebSocket connects before
  // the Clerk JWT is delivered — !identity in the handler returns null immediately.
  // null !== undefined so the undefined checks don't catch it. Since null accessData
  // is always transient on an authenticated page, treat it as loading.
  const isLoading =
    userRecord === undefined ||
    accessData === undefined ||
    accessData === null;

  return (
    <AppStateContext.Provider value={{ userRecord, subscription, isLoading }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
