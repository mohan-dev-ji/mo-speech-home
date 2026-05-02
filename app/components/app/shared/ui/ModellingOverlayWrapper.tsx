"use client";

// Wraps any component that can be a modelling target.
// Reads ModellingSessionContext to highlight when this componentKey is the active step.
// Dimming is provided by ModellingBackdrop (a single viewport-level fixed div),
// not by per-component overlays — that lets the entire UI dim, not just wrapped cards.
//
// Layering during an active session:
//   page UI            — z-index auto / up to 70 (TopBar)
//   ModellingBackdrop  — z-index 80 (fixed, covers all unwrapped UI incl. TopBar/Sidebar)
//   highlighted target — z-index 90 (this wrapper bumps when isHighlighted)
//   ModellingAnnotation (future) — z-index 95
//   Toasts/Modals/Onboarding — z-index 100+ (always above modelling)
//
// componentKey convention: "symbol-{symbolId}" | "category-tile-{categoryId}" | "categories-nav-button"

import { useModellingSession } from '@/app/contexts/ModellingSessionContext';

const HIGHLIGHTED_Z_INDEX = 90;

type ModellingOverlayWrapperProps = {
  componentKey: string;
  children: React.ReactNode;
  className?: string;
};

export function ModellingOverlayWrapper({
  componentKey,
  children,
  className = '',
}: ModellingOverlayWrapperProps) {
  const { isActive, isHighlighted, advanceStep } = useModellingSession();
  const highlighted = isActive && isHighlighted(componentKey);

  // When the wrapped target is the active step, advancing the session is part
  // of clicking it. The original child handler (e.g. navigation) still runs —
  // both events fire because the click bubbles up to this wrapper.
  const handleClick = highlighted ? () => advanceStep() : undefined;

  return (
    <div
      className={`relative ${className}`}
      data-component-key={componentKey}
      onClick={handleClick}
      style={{
        borderRadius: 'inherit',
        // Bump above the viewport backdrop so the target pokes through the dim.
        // When not highlighted, the wrapper sits in normal flow and is covered by the backdrop.
        zIndex: highlighted ? HIGHLIGHTED_Z_INDEX : undefined,
      }}
    >
      {children}

      {highlighted && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none modelling-pulse"
          style={{
            borderRadius: 'inherit',
            boxShadow:
              '0 0 0 3px var(--theme-brand-primary), 0 0 16px 4px var(--theme-symbol-card-glow)',
          }}
        />
      )}
    </div>
  );
}
