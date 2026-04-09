"use client";

// IMPORTANT: This context MUST wrap the entire app from day one.
// ModellingOverlayWrapper components throughout the app require this context to exist
// even before modelling mode is built in Phase 6.

import { createContext, useContext, useCallback, type ReactNode } from 'react';

type ModellingSession = {
  sessionId: string;
  profileId: string;
  steps: string[];          // componentKeys in order
  currentStep: number;
  status: 'active' | 'completed' | 'cancelled';
};

type ModellingSessionContextValue = {
  activeSession: ModellingSession | null;
  currentStep: number;
  isHighlighted: (componentKey: string) => boolean;
  advanceStep: () => void;
};

const ModellingSessionContext = createContext<ModellingSessionContextValue>({
  activeSession: null,
  currentStep: 0,
  isHighlighted: () => false,
  advanceStep: () => {},
});

export function ModellingSessionProvider({ children }: { children: ReactNode }) {
  // Phase 6: subscribe to getActiveModellingSession(profileId) from Convex
  // and wire advanceStep() to the advanceStep mutation

  const isHighlighted = useCallback((_componentKey: string) => {
    // Phase 6: return activeSession?.steps[currentStep] === componentKey
    return false;
  }, []);

  const advanceStep = useCallback(() => {
    // Phase 6: call Convex advanceStep mutation
  }, []);

  return (
    <ModellingSessionContext.Provider
      value={{
        activeSession: null,
        currentStep: 0,
        isHighlighted,
        advanceStep,
      }}
    >
      {children}
    </ModellingSessionContext.Provider>
  );
}

export function useModellingSession() {
  return useContext(ModellingSessionContext);
}
