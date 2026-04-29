"use client";

// Wraps any component that can be a modelling target.
// Reads ModellingSessionContext to highlight/pulse when this componentKey is active.
// This is the ONLY shared component with a context dependency — intentional.
//
// componentKey convention: "symbol-{symbolId}" | "category-tile-{categoryId}" | "categories-nav-button"

import { useModellingSession } from '@/app/contexts/ModellingSessionContext';

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
  const { isHighlighted } = useModellingSession();
  const highlighted = isHighlighted(componentKey);

  return (
    <div className={`relative ${className}`} data-component-key={componentKey}>
      {children}
      {highlighted && (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none modelling-pulse"
          style={{
            boxShadow: `0 0 0 3px var(--theme-brand-primary), 0 0 16px 4px var(--theme-symbol-card-glow)`,
          }}
          aria-hidden
        />
      )}
    </div>
  );
}
