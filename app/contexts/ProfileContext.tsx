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
  symbol_label_visible: boolean;
  symbol_text_size: 'large' | 'medium' | 'small' | 'xs';
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
  symbol_label_visible: true,
  symbol_text_size: 'small' as const,
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
  setSymbolLabelVisible: (value: boolean) => void;
  setSymbolTextSize: (size: 'large' | 'medium' | 'small' | 'xs') => void;
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
  setSymbolLabelVisible: () => {},
  setSymbolTextSize: () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewMode] = useState<ViewMode>('instructor');

  // undefined = still loading; null = loaded, no profile (onboarding needed)
  const studentProfile = useQuery(api.studentProfiles.getMyStudentProfile);
  const profileLoading = studentProfile === undefined;

  const setStateFlagMutation      = useMutation(api.studentProfiles.setStateFlag);
  const setGridSizeMutation       = useMutation(api.studentProfiles.setGridSize);
  const setSymbolTextSizeMutation = useMutation(api.studentProfiles.setSymbolTextSize);
  const updateStudentProfileMutation = useMutation(api.studentProfiles.updateStudentProfile);

  function setLanguage(lang: string) {
    if (!studentProfile) return;
    updateStudentProfileMutation({ profileId: studentProfile._id, language: lang });
  }

  function setTalkerVisible(value: boolean) {
    if (!studentProfile) return;
    setStateFlagMutation({ profileId: studentProfile._id, flag: 'talker_visible', value });
  }

  function setGridSize(size: 'large' | 'medium' | 'small') {
    if (!studentProfile) return;
    // Derive text size from grid size: large → medium, medium → small, small → xs
    const derivedTextSize = size === 'large' ? 'medium' : size === 'medium' ? 'small' : 'xs';
    setGridSizeMutation({ profileId: studentProfile._id, gridSize: size });
    setSymbolTextSizeMutation({ profileId: studentProfile._id, textSize: derivedTextSize });
  }

  function setSymbolLabelVisible(value: boolean) {
    if (!studentProfile) return;
    setStateFlagMutation({ profileId: studentProfile._id, flag: 'symbol_label_visible', value });
  }

  function setSymbolTextSize(size: 'large' | 'medium' | 'small' | 'xs') {
    if (!studentProfile) return;
    setSymbolTextSizeMutation({ profileId: studentProfile._id, textSize: size });
  }

  return (
    <ProfileContext.Provider
      value={{
        activeProfileId: studentProfile?._id ?? null,
        studentProfile: studentProfile ?? null,
        profileLoading,
        stateFlags: studentProfile?.stateFlags
          ? {
              ...studentProfile.stateFlags,
              grid_size:            studentProfile.stateFlags.grid_size            ?? DEFAULT_FLAGS.grid_size,
              symbol_label_visible: studentProfile.stateFlags.symbol_label_visible ?? DEFAULT_FLAGS.symbol_label_visible,
              symbol_text_size:     studentProfile.stateFlags.symbol_text_size     ?? DEFAULT_FLAGS.symbol_text_size,
            }
          : DEFAULT_FLAGS,
        language: studentProfile?.language ?? 'eng',
        viewMode,
        setViewMode,
        setLanguage,
        setTalkerVisible,
        setGridSize,
        setSymbolLabelVisible,
        setSymbolTextSize,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
