"use client";

import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SymbolCard } from '@/app/components/app/shared/ui/SymbolCard';
import { IconButton } from '@/app/components/app/shared/ui/IconButton';
import { EditPanel } from '@/app/components/app/shared/ui/EditPanel';

// Figma "Symbol-search" variant (`3178:4483`): a solid `card` panel with the
// symbol card above and a single pencil Icon-button below. Tapping the card body
// behaves like a plain result (play / add-to-talker); the pencil opens the
// Symbol Editor to personalise the symbol and save it into a category.

type Props = {
  symbolId: string;
  imagePath?: string;
  label: string;
  language: string;
  onTap: () => void;
  onEdit: () => void;
};

export function SymbolCardSearch({ symbolId, imagePath, label, language, onTap, onEdit }: Props) {
  const t = useTranslations('search');

  return (
    <div className="relative w-full @container">
      <div className="w-full flex flex-col items-center gap-theme-gap p-theme-general rounded-theme-card bg-theme-card">
        {/* Symbol — full square footprint; keeps the result's tap behaviour */}
        <div className="w-full aspect-square">
          <SymbolCard
            symbolId={symbolId}
            imagePath={imagePath}
            label={label}
            language={language}
            onTap={onTap}
          />
        </div>

        {/* Single pencil — opens the Symbol Editor to personalise + save */}
        <EditPanel>
          <IconButton
            size="sm"
            variant="neutral"
            icon={<Pencil />}
            label={t('personalise')}
            onClick={onEdit}
          />
        </EditPanel>
      </div>
    </div>
  );
}
