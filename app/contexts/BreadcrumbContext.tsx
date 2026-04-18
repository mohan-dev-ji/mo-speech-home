"use client";

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { CategoryMode } from '@/app/components/app/categories/ui/ModeSwitcher';

export type BreadcrumbExtra = { label: string; colour?: string } | null;

export type TopBarModeSwitcher = {
  activeMode: CategoryMode;
  onChange: (mode: CategoryMode) => void;
  listsVisible: boolean;
  firstThensVisible: boolean;
  sentencesVisible: boolean;
};

// Extras pushed up from the current page into the TopBar.
// null when not on a page that needs them.
export type TopBarExtras = {
  modeSwitcher: TopBarModeSwitcher;
  showHeaderToggle: boolean; // only true when activeMode === 'board'
} | null;

type BreadcrumbContextType = {
  breadcrumbExtra: BreadcrumbExtra;
  setBreadcrumbExtra: (extra: BreadcrumbExtra) => void;
  topBarExtras: TopBarExtras;
  setTopBarExtras: (extras: TopBarExtras) => void;
};

const BreadcrumbContext = createContext<BreadcrumbContextType>({
  breadcrumbExtra: null,
  setBreadcrumbExtra: () => {},
  topBarExtras: null,
  setTopBarExtras: () => {},
});

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [breadcrumbExtra, setBreadcrumbExtra] = useState<BreadcrumbExtra>(null);
  const [topBarExtras, setTopBarExtras] = useState<TopBarExtras>(null);
  return (
    <BreadcrumbContext.Provider value={{ breadcrumbExtra, setBreadcrumbExtra, topBarExtras, setTopBarExtras }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumb() {
  return useContext(BreadcrumbContext);
}
