"use client";

// IMPORTANT: This context MUST wrap the entire app from day one.
// ModellingOverlayWrapper components throughout the app require this context to exist
// even before modelling mode is fully built out.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useProfile } from './ProfileContext';

type ModellingStep = { screen: string; highlight: string };

type ModellingSession = {
  sessionId: Id<'modellingSessions'>;
  profileId: Id<'studentProfiles'>;
  symbolPreview: { word: string; imagePath: string };
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
  cancelSession: () => void;
};

const ModellingSessionContext = createContext<ModellingSessionContextValue>({
  activeSession: null,
  isActive: false,
  currentStep: 0,
  isHighlighted: () => false,
  advanceStep: () => {},
  cancelSession: () => {},
});

export function ModellingSessionProvider({ children }: { children: ReactNode }) {
  const { activeProfileId } = useProfile();

  const sessionDoc = useQuery(
    api.modellingSessions.getActiveModellingSession,
    activeProfileId ? { profileId: activeProfileId } : 'skip',
  );

  const advanceStepMutation = useMutation(api.modellingSessions.advanceStep);
  const cancelSessionMutation = useMutation(
    api.modellingSessions.cancelModellingSession,
  );

  const session = useMemo<ModellingSession | null>(() => {
    if (!sessionDoc) return null;
    return {
      sessionId: sessionDoc._id,
      profileId: sessionDoc.profileId,
      symbolPreview: sessionDoc.symbolPreview,
      steps: sessionDoc.steps,
      currentStep: sessionDoc.currentStep,
      status: sessionDoc.status,
    };
  }, [sessionDoc]);

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
    if (!session || session.status !== 'active') return;
    void advanceStepMutation({ sessionId: session.sessionId });
  }, [session, advanceStepMutation]);

  const cancelSession = useCallback(() => {
    if (!session || session.status !== 'active') return;
    void cancelSessionMutation({ sessionId: session.sessionId });
  }, [session, cancelSessionMutation]);

  const value = useMemo<ModellingSessionContextValue>(
    () => ({
      activeSession: session,
      isActive,
      currentStep,
      isHighlighted,
      advanceStep,
      cancelSession,
    }),
    [session, isActive, currentStep, isHighlighted, advanceStep, cancelSession],
  );

  return (
    <ModellingSessionContext.Provider value={value}>
      {children}
    </ModellingSessionContext.Provider>
  );
}

export function useModellingSession() {
  return useContext(ModellingSessionContext);
}
