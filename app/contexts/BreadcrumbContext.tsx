"use client";

import { createContext, useContext, useState, type ReactNode } from 'react';

export type BreadcrumbExtra = { label: string; colour?: string } | null;

type BreadcrumbContextType = {
  breadcrumbExtra: BreadcrumbExtra;
  setBreadcrumbExtra: (extra: BreadcrumbExtra) => void;
};

const BreadcrumbContext = createContext<BreadcrumbContextType>({
  breadcrumbExtra: null,
  setBreadcrumbExtra: () => {},
});

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [breadcrumbExtra, setBreadcrumbExtra] = useState<BreadcrumbExtra>(null);
  return (
    <BreadcrumbContext.Provider value={{ breadcrumbExtra, setBreadcrumbExtra }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumb() {
  return useContext(BreadcrumbContext);
}
