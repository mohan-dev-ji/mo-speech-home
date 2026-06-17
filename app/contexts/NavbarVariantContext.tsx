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
 * Navbar preferences — `minimal` (Full vs Minimal icon-only rail, Figma Navbar
 * `variant`) and `side` (left vs right placement, for tablet handedness). These
 * are lightweight CLIENT-only toggles (persisted to localStorage so they survive
 * refresh) — NOT per-profile Convex settings. Toggled from the Settings →
 * Navigational Side Bar modal; consumed by `Sidebar`. Promote to stateFlags
 * if/when they become real saved preferences.
 */

const MINIMAL_KEY = "mo-navbar-minimal";
const SIDE_KEY = "mo-navbar-side";

type NavbarSide = "left" | "right";

type NavbarVariantValue = {
  minimal: boolean;
  setMinimal: (next: boolean) => void;
  toggle: () => void;
  side: NavbarSide;
  setSide: (next: NavbarSide) => void;
};

const NavbarVariantContext = createContext<NavbarVariantValue | null>(null);

export function NavbarVariantProvider({ children }: { children: ReactNode }) {
  // Initial render is the default (Full, left) to match SSR; saved values are
  // applied in an effect so there's no hydration mismatch on the SSR'd Sidebar.
  const [minimal, setMinimalState] = useState(false);
  const [side, setSideState] = useState<NavbarSide>("left");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setMinimalState(window.localStorage.getItem(MINIMAL_KEY) === "1");
    setSideState(window.localStorage.getItem(SIDE_KEY) === "right" ? "right" : "left");
  }, []);

  const setMinimal = useCallback((next: boolean) => {
    setMinimalState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MINIMAL_KEY, next ? "1" : "0");
    }
  }, []);

  const setSide = useCallback((next: NavbarSide) => {
    setSideState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SIDE_KEY, next);
    }
  }, []);

  const toggle = useCallback(() => setMinimal(!minimal), [minimal, setMinimal]);

  return (
    <NavbarVariantContext.Provider value={{ minimal, setMinimal, toggle, side, setSide }}>
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
