"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { useTheme, THEME_TOKENS, type ThemeSlug } from '@/app/contexts/ThemeContext';

// ─── State flag types ─────────────────────────────────────────────────────────

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
  lists_visible: boolean;
  sentences_visible: boolean;
  student_can_edit: boolean;
};

// Instructor defaults — all navigation/features always on, display prefs standard
const DEFAULT_FLAGS: StateFlags = {
  home_visible: true,
  search_visible: true,
  categories_visible: true,
  settings_visible: true,   // instructor always sees settings
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
  lists_visible: true,
  sentences_visible: true,
  student_can_edit: false,
};

// ─── Context type ─────────────────────────────────────────────────────────────

type ViewMode = 'instructor' | 'student-view';

type ProfileContextValue = {
  // Student profile
  activeProfileId: Id<'studentProfiles'> | null;
  studentProfile: Doc<'studentProfiles'> | null;
  allProfiles: Doc<'studentProfiles'>[];
  profileLoading: boolean;

  // Active flags and language (viewMode-aware)
  stateFlags: StateFlags;
  language: string; // 'eng' | 'hin' — for search index + TTS

  // View mode
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Instructor display setters (save to users table)
  setGridSize: (size: 'large' | 'medium' | 'small') => void;
  setSymbolLabelVisible: (value: boolean) => void;
  setSymbolTextSize: (size: 'large' | 'medium' | 'small' | 'xs') => void;
  setInstructorTheme: (slug: string) => void;

  // Active student profile setters (kept for talker/legacy use)
  setTalkerVisible: (value: boolean) => void;
  setLanguage: (lang: string) => void;
  setActiveProfile: (profileId: Id<'studentProfiles'>) => void;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const ProfileContext = createContext<ProfileContextValue>({
  activeProfileId: null,
  studentProfile: null,
  allProfiles: [],
  profileLoading: true,
  stateFlags: DEFAULT_FLAGS,
  language: 'eng',
  viewMode: 'instructor',
  setViewMode: () => {},
  setGridSize: () => {},
  setSymbolLabelVisible: () => {},
  setSymbolTextSize: () => {},
  setInstructorTheme: () => {},
  setTalkerVisible: () => {},
  setLanguage: () => {},
  setActiveProfile: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

const VIEW_MODE_STORAGE_KEY = 'mo-view-mode';

function readStoredViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'instructor';
  const stored = window.sessionStorage.getItem(VIEW_MODE_STORAGE_KEY);
  return stored === 'student-view' ? 'student-view' : 'instructor';
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  // Lazy initializer reads sessionStorage on first client render; SSR sees 'instructor'
  const [viewMode, setViewModeState] = useState<ViewMode>(readStoredViewMode);

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    }
  };

  const { setTheme } = useTheme();

  // ── Data queries ────────────────────────────────────────────────────────────

  // Instructor/user data — drives instructor view settings
  const userRecord = useQuery(api.users.getMyUser);

  // Student profile data
  const studentProfile = useQuery(api.studentProfiles.getMyStudentProfile);
  const profileLoading = studentProfile === undefined;
  const allProfiles = useQuery(api.studentProfiles.getMyStudentProfiles) ?? [];

  // ── Mutations — instructor (users table) ────────────────────────────────────

  const setMyInstructorGridSizeMutation       = useMutation(api.users.setMyInstructorGridSize);
  const setMyInstructorSymbolTextSizeMutation = useMutation(api.users.setMyInstructorSymbolTextSize);
  const setMyInstructorFlagMutation           = useMutation(api.users.setMyInstructorFlag);
  const setMyThemeSlugMutation                = useMutation(api.users.setMyThemeSlug);

  // ── Mutations — student profiles (studentProfiles table) ───────────────────

  const setStateFlagMutation         = useMutation(api.studentProfiles.setStateFlag);
  const updateStudentProfileMutation = useMutation(api.studentProfiles.updateStudentProfile);
  const setActiveProfileMutation     = useMutation(api.studentProfiles.setActiveProfile);

  // ── Apply theme from Convex — viewMode-aware ────────────────────────────────
  // Instructor view → users.themeSlug; student-view → studentProfile.themeSlug.

  const activeThemeSlug =
    viewMode === 'student-view'
      ? (studentProfile?.themeSlug ?? userRecord?.themeSlug)
      : userRecord?.themeSlug;

  useEffect(() => {
    if (!activeThemeSlug) return;
    const slug = activeThemeSlug as ThemeSlug;
    if (THEME_TOKENS[slug]) {
      setTheme(slug, THEME_TOKENS[slug]);
    }
  }, [activeThemeSlug]);

  // ── Compute active stateFlags ────────────────────────────────────────────────

  // Instructor flags: defaults overridden by anything stored in users.stateFlags
  const instructorFlags: StateFlags = {
    ...DEFAULT_FLAGS,
    grid_size:             userRecord?.stateFlags?.grid_size            ?? DEFAULT_FLAGS.grid_size,
    symbol_label_visible:  userRecord?.stateFlags?.symbol_label_visible ?? DEFAULT_FLAGS.symbol_label_visible,
    symbol_text_size:      userRecord?.stateFlags?.symbol_text_size     ?? DEFAULT_FLAGS.symbol_text_size,
    reduce_motion:         userRecord?.stateFlags?.reduce_motion        ?? DEFAULT_FLAGS.reduce_motion,
    core_dropdown_visible: userRecord?.stateFlags?.core_dropdown_visible ?? DEFAULT_FLAGS.core_dropdown_visible,
    talker_visible:        userRecord?.stateFlags?.talker_visible       ?? DEFAULT_FLAGS.talker_visible,
  };

  // Student flags: from the active student profile
  const studentFlags: StateFlags = studentProfile?.stateFlags
    ? {
        ...studentProfile.stateFlags,
        grid_size:            studentProfile.stateFlags.grid_size            ?? DEFAULT_FLAGS.grid_size,
        symbol_label_visible: studentProfile.stateFlags.symbol_label_visible ?? DEFAULT_FLAGS.symbol_label_visible,
        symbol_text_size:     studentProfile.stateFlags.symbol_text_size     ?? DEFAULT_FLAGS.symbol_text_size,
        lists_visible:        studentProfile.stateFlags.lists_visible        ?? DEFAULT_FLAGS.lists_visible,
        sentences_visible:    studentProfile.stateFlags.sentences_visible    ?? DEFAULT_FLAGS.sentences_visible,
        student_can_edit:     studentProfile.stateFlags.student_can_edit     ?? DEFAULT_FLAGS.student_can_edit,
      }
    : DEFAULT_FLAGS;

  // viewMode-aware stateFlags
  const stateFlags: StateFlags = viewMode === 'instructor' ? instructorFlags : studentFlags;

  // viewMode-aware language ('eng' | 'hin') for search index and TTS
  // Instructor locale is 'en' or 'hi'; map to 3-letter code for Convex search
  const instructorLocale = userRecord?.locale ?? 'en';
  const instructorLanguage = instructorLocale === 'hi' ? 'hin' : 'eng';
  const language = viewMode === 'instructor'
    ? instructorLanguage
    : (studentProfile?.language ?? 'eng');

  // ── Instructor setters ───────────────────────────────────────────────────────

  function setGridSize(size: 'large' | 'medium' | 'small') {
    // Derive text size: large→medium, medium→small, small→xs
    const derived = size === 'large' ? 'medium' : size === 'medium' ? 'small' : 'xs';
    setMyInstructorGridSizeMutation({ gridSize: size });
    setMyInstructorSymbolTextSizeMutation({ textSize: derived });
  }

  function setSymbolLabelVisible(value: boolean) {
    setMyInstructorFlagMutation({ flag: 'symbol_label_visible', value });
  }

  function setSymbolTextSize(size: 'large' | 'medium' | 'small' | 'xs') {
    setMyInstructorSymbolTextSizeMutation({ textSize: size });
  }

  function setInstructorTheme(slug: string) {
    setMyThemeSlugMutation({ themeSlug: slug });
    if (THEME_TOKENS[slug as ThemeSlug]) {
      setTheme(slug, THEME_TOKENS[slug as ThemeSlug]);
    }
  }

  // ── Student setters (active profile) ─────────────────────────────────────────

  function setTalkerVisible(value: boolean) {
    if (viewMode === 'instructor') {
      setMyInstructorFlagMutation({ flag: 'talker_visible', value });
      return;
    }
    if (!studentProfile) return;
    setStateFlagMutation({ profileId: studentProfile._id, flag: 'talker_visible', value });
  }

  function setLanguage(lang: string) {
    if (!studentProfile) return;
    updateStudentProfileMutation({ profileId: studentProfile._id, language: lang });
  }

  function setActiveProfile(profileId: Id<'studentProfiles'>) {
    setActiveProfileMutation({ profileId });
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <ProfileContext.Provider
      value={{
        activeProfileId: studentProfile?._id ?? null,
        studentProfile: studentProfile ?? null,
        allProfiles,
        profileLoading,
        stateFlags,
        language,
        viewMode,
        setViewMode,
        setGridSize,
        setSymbolLabelVisible,
        setSymbolTextSize,
        setInstructorTheme,
        setTalkerVisible,
        setLanguage,
        setActiveProfile,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
