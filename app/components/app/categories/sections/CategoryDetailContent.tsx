"use client";

import { useState, useRef, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { useTranslations } from 'next-intl';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useProfile } from '@/app/contexts/ProfileContext';
import { useBreadcrumb } from '@/app/contexts/BreadcrumbContext';
import { CategoryBoardGrid } from '@/app/components/shared/CategoryBoardGrid';
import { SymbolCard } from '@/app/components/shared/SymbolCard';
import { Header, type TalkerSymbolItem, type QuickSymbolItem } from '@/app/components/shared/Header';
import { PlayModal } from '@/app/components/shared/PlayModal';

// ─── Types ────────────────────────────────────────────────────────────────────

type PlayModalState = {
  symbolId: string;
  imagePath?: string;
  audioPath?: string;
  label: string;
} | null;

// ─── Audio ────────────────────────────────────────────────────────────────────

function playAudio(audioPath: string) {
  const audio = new Audio(`/api/assets?key=${audioPath}`);
  audio.play().catch(() => {});
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  categoryId: string;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function CategoryDetailContent({ categoryId }: Props) {
  const t = useTranslations('categoryDetail');

  const { language, stateFlags, activeProfileId } = useProfile();
  const { setBreadcrumbExtra } = useBreadcrumb();

  const [talkerSymbols, setTalkerSymbols] = useState<TalkerSymbolItem[]>([]);
  const [headerMode, setHeaderMode] = useState<'talker' | 'banner'>('talker');
  const [playModal, setPlayModal] = useState<PlayModalState>(null);
  const cancelSequenceRef = useRef(false);

  const profileCategoryId = categoryId as Id<'profileCategories'>;

  const category = useQuery(
    api.profileCategories.getProfileCategory,
    { profileCategoryId }
  );

  const symbols = useQuery(
    api.profileCategories.getProfileSymbolsWithImages,
    { profileCategoryId }
  );

  // ─── Talker handlers ─────────────────────────────────────────────────────────

  function addToTalker(symbolId: string, imagePath: string, label: string, audioPath: string) {
    playAudio(audioPath);
    setTalkerSymbols((prev) => [
      ...prev,
      {
        instanceId: crypto.randomUUID(),
        symbolId,
        imagePath: `/api/assets?key=${imagePath}`,
        audioPath,
        label,
      },
    ]);
  }

  function addQuickSymbol(item: QuickSymbolItem) {
    if (item.audioPath) playAudio(item.audioPath);
    setTalkerSymbols((prev) => [
      ...prev,
      {
        instanceId: crypto.randomUUID(),
        symbolId: item.symbolId,
        imagePath: item.imagePath,
        audioPath: item.audioPath,
        label: item.label,
      },
    ]);
  }

  function handleChipTap(item: TalkerSymbolItem) {
    if (item.audioPath) playAudio(item.audioPath);
    setPlayModal({
      symbolId: item.symbolId,
      imagePath: item.imagePath,
      audioPath: item.audioPath,
      label: item.label,
    });
  }

  async function handlePlaySentence() {
    if (talkerSymbols.length === 0) return;
    cancelSequenceRef.current = false;

    for (const symbol of talkerSymbols) {
      if (cancelSequenceRef.current) break;
      setPlayModal({
        symbolId: symbol.symbolId,
        imagePath: symbol.imagePath,
        audioPath: symbol.audioPath,
        label: symbol.label,
      });
      if (symbol.audioPath) {
        const path = symbol.audioPath;
        await new Promise<void>((resolve) => {
          const audio = new Audio(`/api/assets?key=${path}`);
          audio.addEventListener('ended', () => resolve());
          audio.addEventListener('error', () => resolve());
          audio.play().catch(() => resolve());
        });
      } else {
        await new Promise<void>((resolve) => setTimeout(resolve, 600));
      }
    }
    if (!cancelSequenceRef.current) setPlayModal(null);
  }

  // ─── Breadcrumb (must be before conditional returns) ─────────────────────────

  useEffect(() => {
    if (!category) return;
    const name = language === 'hin' && category.name.hin ? category.name.hin : category.name.eng;
    setBreadcrumbExtra({ label: name, colour: category.colour });
    return () => setBreadcrumbExtra(null);
  }, [category, language, setBreadcrumbExtra]);

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const categoryName = category
    ? (language === 'hin' && category.name.hin ? category.name.hin : category.name.eng)
    : '';

  if (!activeProfileId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-body" style={{ color: 'var(--theme-secondary-text)' }}>{t('noProfile')}</p>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full px-theme-mobile-general py-theme-mobile-general md:px-theme-general md:py-theme-general gap-theme-mobile-gap md:gap-theme-gap">

      {/* Board header — talker or banner, togglable */}
      {stateFlags.talker_visible && (
        <div className="shrink-0">
          <Header
            symbols={talkerSymbols}
            language={language}
            onChipTap={handleChipTap}
            onPlaySentence={handlePlaySentence}
            onClear={() => setTalkerSymbols([])}
            onQuickSymbolTap={addQuickSymbol}
            showToggle={true}
            mode={headerMode}
            onToggleMode={() => setHeaderMode((m) => (m === 'talker' ? 'banner' : 'talker'))}
            categoryName={categoryName}
          />
        </div>
      )}

      {/* Symbol grid */}
      <div className="flex-1 overflow-auto mt-8">
        {symbols === undefined && (
          <div className="flex items-center justify-center py-16">
            <div
              className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'var(--theme-primary)', borderTopColor: 'transparent' }}
            />
          </div>
        )}

        {symbols?.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-body" style={{ color: 'var(--theme-secondary-text)' }}>{t('empty')}</p>
          </div>
        )}

        {symbols && symbols.length > 0 && (
          <CategoryBoardGrid>
            {symbols.map((sym) => {
              const label = language === 'hin' && sym.label.hin ? sym.label.hin : sym.label.eng;
              const audioPath = language === 'hin' ? (sym.audioHin ?? sym.audioEng) : sym.audioEng;

              return (
                <SymbolCard
                  key={sym._id}
                  symbolId={sym._id}
                  imagePath={sym.imagePath ? `/api/assets?key=${sym.imagePath}` : undefined}
                  label={label}
                  language={language}
                  onTap={() => {
                    if (!audioPath) return;
                    if (headerMode === 'banner') {
                      playAudio(audioPath);
                    } else if (sym.imagePath) {
                      addToTalker(sym._id, sym.imagePath, label, audioPath);
                    }
                  }}
                />
              );
            })}
          </CategoryBoardGrid>
        )}
      </div>

      {/* Play modal */}
      {playModal && (
        <PlayModal
          isOpen={true}
          symbolId={playModal.symbolId}
          imagePath={playModal.imagePath}
          label={playModal.label}
          language={language}
          onClose={() => { cancelSequenceRef.current = true; setPlayModal(null); }}
        />
      )}
    </div>
  );
}
