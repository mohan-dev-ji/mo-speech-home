"use client";

import { useUser } from "@clerk/nextjs";

/**
 * Client-side admin role check.
 *
 * Reads Clerk `publicMetadata.role`. Returns `false` until Clerk has finished
 * loading (fail closed), and `false` for any user whose role is not exactly
 * `"admin"`. Server-side admin gating uses `sessionClaims.metadata.role`
 * directly via `auth()` — see `app/(admin)/layout.tsx`.
 *
 * This hook is the canonical source of truth for "should this client surface
 * show admin chrome?" — used by the breadcrumb dropdown's Admin entry today,
 * and by the save-to-library / Make-Default buttons in the next Phase 6 chunk.
 *
 * See ADR-008 for why admin is a Clerk role rather than a profile type.
 */
export function useIsAdmin(): boolean {
  const { user, isLoaded } = useUser();
  if (!isLoaded) return false;
  const role = user?.publicMetadata?.role;
  return typeof role === "string" && role === "admin";
}
