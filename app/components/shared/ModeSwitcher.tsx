"use client";

// Tab switcher for the four category detail modes.
// All props/callbacks only — no context dependency.

export type CategoryMode = 'board' | 'lists' | 'first-thens' | 'sentences';

const MODES: { value: CategoryMode; label: string }[] = [
  { value: 'board',       label: 'Board'       },
  { value: 'lists',       label: 'Lists'       },
  { value: 'first-thens', label: 'First Thens' },
  { value: 'sentences',   label: 'Sentences'   },
];

type ModeSwitcherProps = {
  activeMode: CategoryMode;
  onChange: (mode: CategoryMode) => void;
};

export function ModeSwitcher({ activeMode, onChange }: ModeSwitcherProps) {
  return (
    <div className="flex border-b" style={{ borderColor: 'var(--theme-bg-surface-alt)' }}>
      {MODES.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className="px-4 py-2 text-small font-medium transition-colors relative"
          style={{
            color: activeMode === value
              ? 'var(--theme-brand-primary)'
              : 'var(--theme-text-secondary)',
          }}
        >
          {label}
          {activeMode === value && (
            <span
              className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
              style={{ background: 'var(--theme-brand-primary)' }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
