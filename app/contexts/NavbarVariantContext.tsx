"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/**
 * Navbar variant — Full (default) vs Minimal (icon-only rail), mirroring the
 * Figma Navbar `variant` property. This is a lightweight CLIENT-only test toggle
 * (persisted to localStorage so it survives refresh) — NOT a per-profile Convex
 * setting. Toggled from the Settings → Navigational Side Bar modal; consumed by
 * `Sidebar`. Promote to a stateFlag if/when it becomes a real saved preference.
 */

const STORAGE_KEY = "mo-navbar-minimal";

type NavbarVariantValue = {
  minimal: boolean;
  setMinimal: (next: boolean) => void;
  toggle: () => void;
};

const NavbarVariantContext = createContext<NavbarVariantValue | null>(null);

export function NavbarVariantProvider({ children }: { children: ReactNode }) {
  // Initial render is Full (matches SSR); the saved value is applied in an
  // effect so there's no hydration mismatch on the server-rendered Sidebar.
  const [minimal, setMinimalState] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setMinimalState(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  const setMinimal = useCallback((next: boolean) => {
    setMinimalState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    }
  }, []);

  const toggle = useCallback(() => setMinimal(!minimal), [minimal, setMinimal]);

  return (
    <NavbarVariantContext.Provider value={{ minimal, setMinimal, toggle }}>
      {children}
    </NavbarVariantContext.Provider>
  );
}

export function useNavbarVariant(): NavbarVariantValue {
  const ctx = useContext(NavbarVariantContext);
  if (!ctx) {
    throw new Error("useNavbarVariant must be used within a NavbarVariantProvider");
  }
  return ctx;
}
