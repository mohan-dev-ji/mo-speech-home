"use client";

import { useState, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { useTranslations, useLocale } from 'next-intl';
import { api } from '@/convex/_generated/api';
import { useProfile } from '@/app/contexts/ProfileContext';
import { useTalker } from '@/app/contexts/TalkerContext';
import { displayString } from '@/lib/languages/displayValue';
import { DEFAULT_LOCALE } from '@/lib/languages/registry';
import { resolveSymbolAudioPath } from '@/lib/audio/resolveAudioPath';
import { CategoryBoardGrid } from '@/app/components/app/shared/ui/CategoryBoardGrid';
import { SymbolCardSearch } from '@/app/components/app/search/ui/SymbolCardSearch';
import { SearchBar } from '@/app/components/app/shared/ui/SearchBar';
import { PageBanner } from '@/app/components/app/shared/ui/PageBanner';
import { VoiceListeningOverlay } from '@/app/components/app/shared/modals/VoiceListeningOverlay';
import { SymbolEditorModal } from '@/app/components/app/shared/modals/symbol-editor/SymbolEditorModal';
import { UpgradeNudge } from '@/app/components/app/shared/ui/UpgradeNudge';
import { useAppState } from '@/app/contexts/AppStateProvider';
import { useVoiceSearch, type VoiceError } from '@/app/hooks/useVoiceSearch';

// Maps a voice-search error code to its translation key.
const VOICE_ERROR_KEY: Record<VoiceError, string> = {
  'not-allowed': 'errMicDenied',
  'no-mic': 'errNoMic',
  'no-speech': 'errNoSpeech',
  network: 'errNetwork',
  unsupported: 'errVoiceUnsupported',
  auth: 'errVoiceFailed',
  failed: 'errVoiceFailed',
};

// ─── Audio ────────────────────────────────────────────────────────────────────

function playAudio(audioPath: string) {
  const audio = new Audio(`/api/assets?key=${audioPath}`);
  audio.play().catch(() => {});
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SearchContent() {
  const t = useTranslations('search');
  const locale = useLocale();
  const { language, stateFlags, voiceId, accountId } = useProfile();
  const { talkerMode, addToTalker } = useTalker();
  const { subscription } = useAppState();
  const isFree = subscription.tier === 'free';

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Voice search — Web Speech (Chrome) / Deepgram fallback. The transcript sets
  // the query, which is already reactive (debounce → Convex query below).
  const voice = useVoiceSearch({ language, onTranscript: setQuery });

  useEffect(() => {
    if (!query.trim()) {
      setDebouncedQuery('');
      return;
    }
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const results = useQuery(
    api.symbols.searchSymbols,
    debouncedQuery ? { searchTerm: debouncedQuery, language } : 'skip'
  );

  // Symbol pending personalise/save (opens the Symbol Editor seeded with it).
  const [editorSymbol, setEditorSymbol] = useState<NonNullable<typeof results>[number] | null>(null);
  const [upgradeNudgeOpen, setUpgradeNudgeOpen] = useState(false);

  // ─── Derived state ─────────────────────────────────────────────────────────

  const isLoading = !!debouncedQuery && results === undefined;
  const hasResults = Array.isArray(results) && results.length > 0;
  const noResults = Array.isArray(results) && results.length === 0 && !!debouncedQuery;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full px-theme-mobile-general py-theme-mobile-general md:px-theme-general md:py-theme-general gap-theme-mobile-gap md:gap-theme-gap">

      {/* Page banner — banner/edit mode only */}
      {stateFlags.talker_visible && talkerMode === 'banner' && (
        <div className="shrink-0">
          <PageBanner title={t('title')} />
        </div>
      )}

      {/* Search input */}
      <div className="shrink-0">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder={t('placeholder')}
          onMic={voice.isListening ? voice.stop : voice.start}
          isListening={voice.isListening}
          autoFocus
        />
        {voice.error && (
          <p className="mt-2 px-2 text-small" style={{ color: 'var(--theme-warning)' }}>
            {t(VOICE_ERROR_KEY[voice.error])}
          </p>
        )}
      </div>

      {/* Listening overlay (Web Speech / Deepgram) */}
      {voice.isListening && (
        <VoiceListeningOverlay
          state={voice.listeningState}
          method={voice.method}
          onCancel={voice.stop}
        />
      )}

      {/* Results area */}
      <div className="flex-1 overflow-auto">

        {!query && (
          <div className="flex items-center justify-center h-full">
            <p className="text-body" style={{ color: 'var(--theme-text-secondary)' }}>
              {t('emptyHint')}
            </p>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div
              className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{
                borderColor: 'var(--theme-brand-primary)',
                borderTopColor: 'transparent',
              }}
            />
          </div>
        )}

        {noResults && (
          <div className="flex items-center justify-center">
            <p className="text-body" style={{ color: 'var(--theme-text-secondary)' }}>
              {t('noResults', { query: debouncedQuery })}
            </p>
          </div>
        )}

        {hasResults && (
          <CategoryBoardGrid>
            {results.map((symbol) => {
              const label = displayString(symbol.words, language, DEFAULT_LOCALE);

              // Per ADR-009 §4 audio paths are convention-resolved from the
              // voice-keyed boolean map; resolver uses the per-symbol
              // `audioBasename` (MVP filename) when present, else the
              // English-word convention.
              const audioMap = (symbol.audio as Record<string, boolean> | undefined) ?? {};
              const audioPath =
                resolveSymbolAudioPath(
                  voiceId,
                  symbol.words.en ?? '',
                  audioMap[voiceId] === true,
                  symbol.audioBasename,
                ) ?? '';

              return (
                <SymbolCardSearch
                  key={symbol._id}
                  symbolId={symbol._id}
                  imagePath={`/api/assets?key=${symbol.imagePath}`}
                  label={label}
                  language={language}
                  onTap={() => {
                    if (talkerMode === 'banner') {
                      playAudio(audioPath);
                    } else {
                      playAudio(audioPath);
                      addToTalker({
                        symbolId: symbol._id,
                        imagePath: `/api/assets?key=${symbol.imagePath}`,
                        audioPath,
                        label,
                      });
                    }
                  }}
                  onEdit={() => {
                    // Personalise + save is Pro-gated (createProfileSymbol).
                    if (isFree) { setUpgradeNudgeOpen(true); return; }
                    setEditorSymbol(symbol);
                  }}
                />
              );
            })}
          </CategoryBoardGrid>
        )}
      </div>

      {/* Personalise + save the picked search symbol via the shared editor.
          No profileCategoryId → the user picks (or creates) a category inside. */}
      {editorSymbol && accountId && (
        <SymbolEditorModal
          isOpen
          accountId={accountId}
          language={language}
          voiceId={voiceId}
          editorMode="categoryBoard"
          initialSymbolstixId={editorSymbol._id}
          initialSymbolstixImagePath={editorSymbol.imagePath}
          initialLabel={editorSymbol.words.en ?? displayString(editorSymbol.words, language, DEFAULT_LOCALE)}
          initialLabelHin={editorSymbol.words.hi}
          initialDefaultAudioPath={
            resolveSymbolAudioPath(
              voiceId,
              editorSymbol.words.en ?? '',
              ((editorSymbol.audio as Record<string, boolean> | undefined) ?? {})[voiceId] === true,
              editorSymbol.audioBasename,
            ) ?? undefined
          }
          initialActiveAudioSource="default"
          onClose={() => setEditorSymbol(null)}
          onSave={() => setEditorSymbol(null)}
        />
      )}

      <UpgradeNudge open={upgradeNudgeOpen} onOpenChange={setUpgradeNudgeOpen} locale={locale} />
    </div>
  );
}
