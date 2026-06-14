"use client";

import { ThemeProvider } from '@/app/contexts/ThemeContext';
import { ProfileProvider } from '@/app/contexts/ProfileContext';
import { TalkerProvider } from '@/app/contexts/TalkerContext';
import { ModellingSessionProvider } from '@/app/contexts/ModellingSessionContext';
import { ResourceLibraryProvider } from '@/app/contexts/ResourceLibraryContext';
import { BreadcrumbProvider } from '@/app/contexts/BreadcrumbContext';
import { AppStateProvider } from '@/app/contexts/AppStateProvider';
import { PostHogProvider } from '@/app/contexts/PostHogProvider';
import { StudentOnboardingGate } from '@/app/components/app/onboarding/StudentOnboardingGate';
import { ToastProvider } from '@/app/components/app/shared/ui/Toast';
import { ModellingBackdrop } from '@/app/components/app/shared/ui/ModellingBackdrop';
import { ModellingAnnotation } from '@/app/components/app/shared/ui/ModellingAnnotation';
import { ModellingExitButton } from '@/app/components/app/shared/ui/ModellingExitButton';
import { ModellingProgressIndicator } from '@/app/components/app/shared/ui/ModellingProgressIndicator';
import { ModellingMirrorSync } from '@/app/components/app/shared/sections/ModellingMirrorSync';
import { InstructorPresenceWatcher } from '@/app/components/app/shared/sections/InstructorPresenceWatcher';
import { StudentViewLocaleSync } from '@/app/components/app/shared/sections/StudentViewLocaleSync';
import { StudentViewRouteGuard } from '@/app/components/app/shared/sections/StudentViewRouteGuard';
import type { ReactNode } from 'react';

export function AppProviders({
  children,
  initialHeaderInBannerMode,
}: {
  children: ReactNode;
  // Forwarded to ProfileProvider as the first-paint talker-vs-banner seed,
  // read from the mo-header-mode cookie by the app-shell layout (server).
  initialHeaderInBannerMode?: boolean;
}) {
  return (
    <PostHogProvider>
      <AppStateProvider>
        <ThemeProvider>
        <ProfileProvider initialHeaderInBannerMode={initialHeaderInBannerMode}>
          <TalkerProvider>
            <ModellingSessionProvider>
              <ResourceLibraryProvider>
                <BreadcrumbProvider>
                  <ToastProvider>
                    <StudentOnboardingGate />
                    <InstructorPresenceWatcher />
                    <StudentViewLocaleSync />
                    <StudentViewRouteGuard />
                    <ModellingMirrorSync />
                    <ModellingBackdrop />
                    <ModellingAnnotation />
                    <ModellingProgressIndicator />
                    <ModellingExitButton />
                    {children}
                  </ToastProvider>
                </BreadcrumbProvider>
                </ResourceLibraryProvider>
              </ModellingSessionProvider>
            </TalkerProvider>
          </ProfileProvider>
        </ThemeProvider>
      </AppStateProvider>
    </PostHogProvider>
  );
}
