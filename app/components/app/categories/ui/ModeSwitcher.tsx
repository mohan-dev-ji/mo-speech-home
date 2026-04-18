"use client";

import { useTranslations } from 'next-intl';

export type CategoryMode = 'board' | 'lists' | 'first-thens' | 'sentences';

type Tab = {
  id: CategoryMode;
  labelKey: 'modeBoard' | 'modeLists' | 'modeFirstThens' | 'modeSentences';
};

const ALL_TABS: Tab[] = [
  { id: 'board',       labelKey: 'modeBoard' },
  { id: 'lists',       labelKey: 'modeLists' },
  { id: 'first-thens', labelKey: 'modeFirstThens' },
  { id: 'sentences',   labelKey: 'modeSentences' },
];

type ModeSwitcherProps = {
  activeMode: CategoryMode;
  onChange: (mode: CategoryMode) => void;
  listsVisible?: boolean;
  firstThensVisible?: boolean;
  sentencesVisible?: boolean;
  // small=true: used in the TopBar — tighter padding, smaller radius
  small?: boolean;
};

export function ModeSwitcher({
  activeMode,
  onChange,
  listsVisible = true,
  firstThensVisible = true,
  sentencesVisible = true,
  small = false,
}: ModeSwitcherProps) {
  const t = useTranslations('categoryDetail');

  const visible: Record<CategoryMode, boolean> = {
    board:         true,
    lists:         listsVisible,
    'first-thens': firstThensVisible,
    sentences:     sentencesVisible,
  };

  const tabs = ALL_TABS.filter((tab) => visible[tab.id]);

  if (tabs.length <= 1) return null;

  return (
    <div
      className="flex gap-1 overflow-x-auto shrink-0"
      style={{ scrollbarWidth: 'none' }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeMode;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={[
              'shrink-0 text-small font-medium transition-colors',
              small ? 'px-3 py-1 rounded-md' : 'px-4 py-2 rounded-lg',
            ].join(' ')}
            style={{
              background: isActive
                ? 'var(--theme-button-highlight)'
                : 'rgba(255,255,255,0.07)',
              color: isActive
                ? 'var(--theme-text)'
                : 'var(--theme-secondary-alt-text)',
            }}
          >
            {t(tab.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
