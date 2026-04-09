"use client";

import { createContext, useContext, useState, type ReactNode } from 'react';

// State flags stored on studentProfile in Convex — Phase 1 wires these to real data
type StateFlags = {
  home_visible: boolean;
  search_visible: boolean;
  categories_visible: boolean;
  settings_visible: boolean;
  talker_visible: boolean;
  talker_banner_toggle: boolean;
  play_modal_visible: boolean;
  voice_input_enabled: boolean;
  audio_autoplay: boolean;
  modelling_push: boolean;
  core_dropdown_visible: boolean;
  reduce_motion: boolean;
};

const DEFAULT_FLAGS: StateFlags = {
  home_visible: true,
  search_visible: true,
  categories_visible: true,
  settings_visible: false,
  talker_visible: true,
  talker_banner_toggle: true,
  play_modal_visible: true,
  voice_input_enabled: true,
  audio_autoplay: true,
  modelling_push: false,
  core_dropdown_visible: true,
  reduce_motion: false,
};

type ViewMode = 'instructor' | 'student-view';

type ProfileContextValue = {
  activeProfileId: string | null;
  stateFlags: StateFlags;
  language: string;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  setLanguage: (lang: string) => void;
};

const ProfileContext = createContext<ProfileContextValue>({
  activeProfileId: null,
  stateFlags: DEFAULT_FLAGS,
  language: 'eng',
  viewMode: 'instructor',
  setViewMode: () => {},
  setLanguage: () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewMode] = useState<ViewMode>('instructor');
  const [language, setLanguage] = useState('eng');

  // Phase 1: load activeProfile from Convex and subscribe to stateFlags

  return (
    <ProfileContext.Provider
      value={{
        activeProfileId: null,
        stateFlags: DEFAULT_FLAGS,
        language,
        viewMode,
        setViewMode,
        setLanguage,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
