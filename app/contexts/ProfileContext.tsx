"use client";

import { createContext, useContext, useState, type ReactNode } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';

// State flags stored on studentProfile in Convex
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
  grid_size: 'large' | 'medium' | 'small';
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
  grid_size: 'large',
};

type ViewMode = 'instructor' | 'student-view';

type ProfileContextValue = {
  activeProfileId: string | null;
  studentProfile: Doc<'studentProfiles'> | null;
  profileLoading: boolean;
  stateFlags: StateFlags;
  language: string;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  setLanguage: (lang: string) => void;
  setTalkerVisible: (value: boolean) => void;
  setGridSize: (size: 'large' | 'medium' | 'small') => void;
};

const ProfileContext = createContext<ProfileContextValue>({
  activeProfileId: null,
  studentProfile: null,
  profileLoading: true,
  stateFlags: DEFAULT_FLAGS,
  language: 'eng',
  viewMode: 'instructor',
  setViewMode: () => {},
  setLanguage: () => {},
  setTalkerVisible: () => {},
  setGridSize: () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewMode] = useState<ViewMode>('instructor');
  const [language, setLanguage] = useState('eng');

  // undefined = still loading; null = loaded, no profile (onboarding needed)
  const studentProfile = useQuery(api.studentProfiles.getMyStudentProfile);
  const profileLoading = studentProfile === undefined;

  const setStateFlagMutation = useMutation(api.studentProfiles.setStateFlag);
  const setGridSizeMutation  = useMutation(api.studentProfiles.setGridSize);

  function setTalkerVisible(value: boolean) {
    if (!studentProfile) return;
    setStateFlagMutation({ profileId: studentProfile._id, flag: 'talker_visible', value });
  }

  function setGridSize(size: 'large' | 'medium' | 'small') {
    if (!studentProfile) return;
    setGridSizeMutation({ profileId: studentProfile._id, gridSize: size });
  }

  return (
    <ProfileContext.Provider
      value={{
        activeProfileId: studentProfile?._id ?? null,
        studentProfile: studentProfile ?? null,
        profileLoading,
        stateFlags: studentProfile?.stateFlags ?? DEFAULT_FLAGS,
        // Profile language takes precedence; fallback to locally selected language
        language: studentProfile?.language ?? language,
        viewMode,
        setViewMode,
        setLanguage,
        setTalkerVisible,
        setGridSize,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
