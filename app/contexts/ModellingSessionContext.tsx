"use client";

// IMPORTANT: This context MUST wrap the entire app from day one.
// ModellingOverlayWrapper components throughout the app require this context to exist
// even before modelling mode is built in Phase 6.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type ModellingStep = { screen: string; highlight: string };

type ModellingSession = {
  sessionId: string;
  profileId: string;
  steps: ModellingStep[];
  currentStep: number;
  status: 'active' | 'completed' | 'cancelled';
};

type ModellingSessionContextValue = {
  activeSession: ModellingSession | null;
  isActive: boolean;
  currentStep: number;
  isHighlighted: (componentKey: string) => boolean;
  advanceStep: () => void;
  // Dev-only escape hatch — drives the visual layer before Convex is wired.
  // No-op in production builds. Removed in Phase 5.1.
  __setFakeSession: (steps: ModellingStep[] | null) => void;
};

const ModellingSessionContext = createContext<ModellingSessionContextValue>({
  activeSession: null,
  isActive: false,
  currentStep: 0,
  isHighlighted: () => false,
  advanceStep: () => {},
  __setFakeSession: () => {},
});

export function ModellingSessionProvider({ children }: { children: ReactNode }) {
  // Phase 5.1: replace this state with a Convex subscription to
  // getActiveModellingSession(profileId).
  const [session, setSession] = useState<ModellingSession | null>(null);

  const isActive = session?.status === 'active';
  const currentStep = session?.currentStep ?? 0;

  const isHighlighted = useCallback(
    (componentKey: string) => {
      if (!session || session.status !== 'active') return false;
      const step = session.steps[session.currentStep];
      return step?.highlight === componentKey;
    },
    [session],
  );

  const advanceStep = useCallback(() => {
    // Phase 5.1: call the Convex advanceStep mutation.
    setSession((prev) => {
      if (!prev || prev.status !== 'active') return prev;
      const next = prev.currentStep + 1;
      if (next >= prev.steps.length) {
        return { ...prev, status: 'completed', currentStep: prev.steps.length - 1 };
      }
      return { ...prev, currentStep: next };
    });
  }, []);

  const __setFakeSession = useCallback((steps: ModellingStep[] | null) => {
    if (process.env.NODE_ENV === 'production') return;
    if (!steps) {
      setSession(null);
      return;
    }
    setSession({
      sessionId: 'fake',
      profileId: 'fake',
      steps,
      currentStep: 0,
      status: 'active',
    });
  }, []);

  const value = useMemo<ModellingSessionContextValue>(
    () => ({
      activeSession: session,
      isActive,
      currentStep,
      isHighlighted,
      advanceStep,
      __setFakeSession,
    }),
    [session, isActive, currentStep, isHighlighted, advanceStep, __setFakeSession],
  );

  // Dev-only: expose the helpers on window for console-driven testing.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    (window as unknown as Record<string, unknown>).__modelling = {
      setFake: __setFakeSession,
      advance: advanceStep,
      session,
    };
  }, [__setFakeSession, advanceStep, session]);

  return (
    <ModellingSessionContext.Provider value={value}>
      {children}
    </ModellingSessionContext.Provider>
  );
}

export function useModellingSession() {
  return useContext(ModellingSessionContext);
}
