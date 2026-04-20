"use client";

import { useTranslations } from 'next-intl';
import { NavTabButton } from '@/app/components/shared/ui/NavTabButton';

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
};

export function ModeSwitcher({
  activeMode,
  onChange,
  listsVisible = true,
  firstThensVisible = true,
  sentencesVisible = true,
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
    <div className="flex gap-1 overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
      {tabs.map((tab) => (
        <NavTabButton
          key={tab.id}
          active={tab.id === activeMode}
          onClick={() => onChange(tab.id)}
        >
          {t(tab.labelKey)}
        </NavTabButton>
      ))}
    </div>
  );
}
