"use client";

import { ThemeProvider } from '@/app/contexts/ThemeContext';
import { ProfileProvider } from '@/app/contexts/ProfileContext';
import { ModellingSessionProvider } from '@/app/contexts/ModellingSessionContext';
import { ResourceLibraryProvider } from '@/app/contexts/ResourceLibraryContext';
import type { ReactNode } from 'react';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ProfileProvider>
        <ModellingSessionProvider>
          <ResourceLibraryProvider>
            {children}
          </ResourceLibraryProvider>
        </ModellingSessionProvider>
      </ProfileProvider>
    </ThemeProvider>
  );
}
