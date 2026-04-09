"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

type ThemeTokens = {
  sidebar: string;
  topbar: string;
  navItem: string;
  primary: string;
};

type ThemeContextValue = {
  activeThemeId: string | null;
  tokens: ThemeTokens | null;
  setTheme: (themeId: string) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  activeThemeId: null,
  tokens: null,
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null);

  // Phase 0.8: fetch theme from Convex and apply CSS custom properties
  // For now: CSS defaults in globals.css apply

  function setTheme(themeId: string) {
    setActiveThemeId(themeId);
    // Phase 0.8: apply theme tokens to document.documentElement style
  }

  return (
    <ThemeContext.Provider value={{ activeThemeId, tokens: null, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
