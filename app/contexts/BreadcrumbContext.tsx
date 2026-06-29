"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/** A single breadcrumb crumb beyond the section root. */
export type BreadcrumbCrumb = { label: string; colour?: string };

/**
 * What a detail page may set. Accepts a single crumb (back-compat — the common
 * `Section › Item` case) or an ordered trail (`Section › Folder › Item`, the
 * three-tree case from ADR-014). `null` clears it.
 */
export type BreadcrumbExtra = BreadcrumbCrumb | BreadcrumbCrumb[] | null;

type BreadcrumbContextType = {
  /** Normalised ordered trail of crumbs beyond the section root. */
  breadcrumbTrail: BreadcrumbCrumb[];
  /** The deepest crumb, or null — used for the mobile page label. */
  breadcrumbExtra: BreadcrumbCrumb | null;
  setBreadcrumbExtra: (extra: BreadcrumbExtra) => void;
};

const BreadcrumbContext = createContext<BreadcrumbContextType>({
  breadcrumbTrail: [],
  breadcrumbExtra: null,
  setBreadcrumbExtra: () => {},
});

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [extra, setBreadcrumbExtra] = useState<BreadcrumbExtra>(null);

  const value = useMemo<BreadcrumbContextType>(() => {
    const breadcrumbTrail = extra === null ? [] : Array.isArray(extra) ? extra : [extra];
    return {
      breadcrumbTrail,
      breadcrumbExtra: breadcrumbTrail.at(-1) ?? null,
      setBreadcrumbExtra,
    };
  }, [extra]);

  return (
    <BreadcrumbContext.Provider value={value}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumb() {
  return useContext(BreadcrumbContext);
}
