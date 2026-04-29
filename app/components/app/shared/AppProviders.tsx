"use client";

import { ThemeProvider } from '@/app/contexts/ThemeContext';
import { ProfileProvider } from '@/app/contexts/ProfileContext';
import { TalkerProvider } from '@/app/contexts/TalkerContext';
import { ModellingSessionProvider } from '@/app/contexts/ModellingSessionContext';
import { ResourceLibraryProvider } from '@/app/contexts/ResourceLibraryContext';
import { BreadcrumbProvider } from '@/app/contexts/BreadcrumbContext';
import { AppStateProvider } from '@/app/components/AppStateProvider';
import { StudentOnboardingGate } from '@/app/components/app/onboarding/StudentOnboardingGate';
import { ToastProvider } from '@/app/components/shared/Toast';
import { InstructorPresenceWatcher } from '@/app/components/app/shared/InstructorPresenceWatcher';
import { StudentViewLocaleSync } from '@/app/components/app/shared/StudentViewLocaleSync';
import type { ReactNode } from 'react';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppStateProvider>
      <ThemeProvider>
        <ProfileProvider>
          <TalkerProvider>
            <ModellingSessionProvider>
              <ResourceLibraryProvider>
                <BreadcrumbProvider>
                  <ToastProvider>
                    <StudentOnboardingGate />
                    <InstructorPresenceWatcher />
                    <StudentViewLocaleSync />
                    {children}
                  </ToastProvider>
                </BreadcrumbProvider>
              </ResourceLibraryProvider>
            </ModellingSessionProvider>
          </TalkerProvider>
        </ProfileProvider>
      </ThemeProvider>
    </AppStateProvider>
  );
}
