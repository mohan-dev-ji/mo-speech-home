"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const SESSION_ID_STORAGE_KEY = "mo-view-session-id";
const HEARTBEAT_INTERVAL_MS = 15_000;

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = window.sessionStorage.getItem(SESSION_ID_STORAGE_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(SESSION_ID_STORAGE_KEY, id);
  }
  return id;
}

/**
 * Posts a heartbeat to studentViewSessions while viewMode is 'student-view'.
 * Stops + clears the session row when viewMode flips away or component unmounts.
 */
export function useStudentViewPresence({
  active,
  profileId,
}: {
  active: boolean;
  profileId: Id<"studentProfiles"> | null;
}) {
  const heartbeat = useMutation(api.studentViewSessions.heartbeatStudentViewSession);
  const endSession = useMutation(api.studentViewSessions.endStudentViewSession);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!active || !profileId) return;
    const sessionId = getOrCreateSessionId();
    sessionIdRef.current = sessionId;

    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      heartbeat({ profileId, sessionId }).catch(() => {});
    };
    tick();
    const interval = setInterval(tick, HEARTBEAT_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
      endSession({ sessionId }).catch(() => {});
      sessionIdRef.current = null;
    };
  }, [active, profileId, heartbeat, endSession]);
}
