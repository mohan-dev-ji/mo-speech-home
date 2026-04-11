"use client";

import { ThemeProvider } from '@/app/contexts/ThemeContext';
import { ProfileProvider } from '@/app/contexts/ProfileContext';
import { ModellingSessionProvider } from '@/app/contexts/ModellingSessionContext';
import { ResourceLibraryProvider } from '@/app/contexts/ResourceLibraryContext';
import { AppStateProvider } from '@/app/components/AppStateProvider';
import { StudentOnboardingGate } from '@/app/components/app/onboarding/StudentOnboardingGate';
import type { ReactNode } from 'react';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppStateProvider>
      <ThemeProvider>
        <ProfileProvider>
          <ModellingSessionProvider>
            <ResourceLibraryProvider>
              <StudentOnboardingGate />
              {children}
            </ResourceLibraryProvider>
          </ModellingSessionProvider>
        </ProfileProvider>
      </ThemeProvider>
    </AppStateProvider>
  );
}
