"use client";

import { createContext, useContext, type ReactNode } from 'react';

type ResourcePackMeta = {
  packId: string;
  name: string;
  description: string;
  isFeatured: boolean;
  isSeasonal: boolean;
  seasonStart?: number;
  seasonEnd?: number;
  imageUrl?: string;
};

type ResourceLibraryContextValue = {
  featuredPacks: ResourcePackMeta[];
  seasonalPacks: ResourcePackMeta[];
  isLoading: boolean;
};

const ResourceLibraryContext = createContext<ResourceLibraryContextValue>({
  featuredPacks: [],
  seasonalPacks: [],
  isLoading: false,
});

export function ResourceLibraryProvider({ children }: { children: ReactNode }) {
  // Phase 5: subscribe to featured/seasonal pack metadata from Convex
  // Lightweight — only metadata, not full pack content

  return (
    <ResourceLibraryContext.Provider
      value={{
        featuredPacks: [],
        seasonalPacks: [],
        isLoading: false,
      }}
    >
      {children}
    </ResourceLibraryContext.Provider>
  );
}

export function useResourceLibrary() {
  return useContext(ResourceLibraryContext);
}
