"use client";

// Renders in the app layout shell above all pages.
// Owns the block play modal (CompositionPlayModal) for talker sentence playback.

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery, useMutation } from 'convex/react';
import { useTranslations } from 'next-intl';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useProfile } from '@/app/contexts/ProfileContext';
import { useTalker, type TalkerSymbolItem } from '@/app/contexts/TalkerContext';
import { useBreadcrumb } from '@/app/contexts/BreadcrumbContext';
import { Header } from '@/app/components/app/shared/ui/Header';
import type { QuickSymbolItem } from '@/app/components/app/shared/ui/Header';
import { CompositionPlayModal } from '@/app/components/app/shared/modals/CompositionPlayModal';
import { blocksFromTalker } from '@/app/components/app/shared/ui/composition/blocks';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/app/components/app/shared/ui/Dialog';
import { displayString } from '@/lib/languages/displayValue';
import { DEFAULT_LOCALE } from '@/lib/languages/registry';
import { playTts } from '@/lib/audio/playTts';

// Strip the /api/assets URL wrapper so saved compositions store RAW R2 keys
// (the render layer re-adds `/api/assets?key=`). Idempotent for already-raw keys.
function rawKey(path?: string): string | undefined {
  if (!path) return undefined;
  const prefix = '/api/assets?key=';
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

// Route segments where the talker is allowed to replace the page banner.
// Everywhere else (lists, sentences, settings, home) keeps its own permanent
// header, so the talker bar never appears there. Pathname shape is
// `/<locale>/<segment>/...`, so segment is index 2. `categories` covers both
// the listing and the `/categories/[id]` detail page.
const TALKER_SEGMENTS = ['search', 'categories'];

// ─── Audio ────────────────────────────────────────────────────────────────────

function playAudio(audioPath: string) {
  const audio = new Audio(`/api/assets?key=${audioPath}`);
  audio.play().catch(() => {});
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PersistentTalker() {
  const t = useTranslations('talker');
  const { stateFlags, language, voiceId } = useProfile();
  const { talkerSymbols, talkerMode, addToTalker, removeFromTalker, reorderTalker, clearTalker } = useTalker();
  const { breadcrumbExtra } = useBreadcrumb();
  const pathname = usePathname();

  const [playing, setPlaying] = useState(false);

  // Talker Save (ADR-015 Slice 6) — folder picker + smart default.
  const sentenceFolders = useQuery(api.profileFolders.getProfileFolders, { tree: 'sentences' });
  const createProfileSentence = useMutation(api.profileSentences.createProfileSentence);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveSelection, setSaveSelection] = useState<Id<'profileFolders'> | 'ungrouped' | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Only render in sentence-builder mode; banner mode shows page-level banners instead
  if (!stateFlags.talker_visible || talkerMode !== 'talker') return null;

  // Only on talker-capable pages — lists/sentences/settings keep a permanent
  // banner and home owns its own header, so the talker never appears there.
  const segment = pathname.split('/')[2] ?? '';
  if (!TALKER_SEGMENTS.includes(segment)) return null;

  // Play a talker item's clip. A clip-less phrase (no recorded/generated audio)
  // speaks its name via TTS so adding or tapping a phrase is never silent —
  // mirrors the block modal's fallback and matches how word symbols always sound.
  function playItem(item: { audioPath?: string; kind?: 'word' | 'phrase'; phraseName?: string; label: string }) {
    if (item.audioPath) { playAudio(item.audioPath); return; }
    if (item.kind === 'phrase') void playTts(item.phraseName ?? item.label, voiceId);
  }

  // Single chip tap plays that chip's own clip (whole-composition playback is the
  // block modal, opened by Play).
  function handleChipTap(item: TalkerSymbolItem) {
    playItem(item);
  }

  // Play opens the block modal, which owns the stepped-glow sequence playback.
  function handlePlaySentence() {
    if (talkerSymbols.length > 0) setPlaying(true);
  }

  // Smart default (ADR-014 §7): if working inside a category, default the save
  // target to the sentence folder whose name matches it. Otherwise Ungrouped.
  function computeDefaultFolder(): Id<'profileFolders'> | 'ungrouped' {
    const label = breadcrumbExtra?.label?.trim().toLowerCase();
    if (label) {
      const match = (sentenceFolders ?? []).find(
        (f) => displayString(f.name, language, DEFAULT_LOCALE).trim().toLowerCase() === label
      );
      if (match) return match._id;
    }
    return 'ungrouped';
  }

  function handleSaveOpen() {
    if (talkerSymbols.length === 0) return;
    setSaveSelection(computeDefaultFolder());
    setSaveDialogOpen(true);
  }

  async function handleSaveConfirm() {
    if (talkerSymbols.length === 0 || !saveSelection) return;
    setIsSaving(true);
    try {
      // units[] — retains phrase decomposition + per-unit clips (ADR-015).
      const units = talkerSymbols.map((s, i) => {
        // Phase 15 (Task 6): prefer the source's full localised record so text is
        // keyed by its true language; fall back to the board language for freshly
        // typed text that has no record.
        if (s.kind === 'phrase') {
          return {
            kind: 'phrase' as const,
            order: i,
            name: s.phraseNameRecord ?? { [language]: s.phraseName ?? s.label },
            ...(rawKey(s.audioPath) ? { audioPath: rawKey(s.audioPath)! } : {}),
            words: (s.words ?? []).map((w, wi) => ({
              order: wi,
              ...(rawKey(w.imagePath) ? { imagePath: rawKey(w.imagePath)! } : {}),
              ...(rawKey(w.audioPath) ? { audioPath: rawKey(w.audioPath)! } : {}),
              ...(w.labelRecord ? { label: w.labelRecord } : w.label ? { label: { [language]: w.label } } : {}),
            })),
          };
        }
        return {
          kind: 'word' as const,
          order: i,
          ...(rawKey(s.imagePath) ? { imagePath: rawKey(s.imagePath)! } : {}),
          ...(rawKey(s.audioPath) ? { audioPath: rawKey(s.audioPath)! } : {}),
          ...(s.labelRecord ? { label: s.labelRecord } : s.label ? { label: { [language]: s.label } } : {}),
        };
      });

      // slots[] — flat rendered source: expand each phrase unit to its words.
      const slots: { order: number; imagePath?: string }[] = [];
      for (const s of talkerSymbols) {
        if (s.kind === 'phrase') {
          for (const w of s.words ?? []) {
            slots.push({ order: slots.length, ...(rawKey(w.imagePath) ? { imagePath: rawKey(w.imagePath) } : {}) });
          }
        } else {
          slots.push({ order: slots.length, ...(rawKey(s.imagePath) ? { imagePath: rawKey(s.imagePath) } : {}) });
        }
      }

      const nameText = talkerSymbols
        .map((s) => (s.kind === 'phrase' ? (s.phraseName ?? s.label) : s.label))
        .join(' ');

      const folderId = saveSelection === 'ungrouped' ? undefined : saveSelection;
      await createProfileSentence({
        name: { [language]: nameText },
        kind: 'sentence',
        playback: 'sequence',
        // Phase 15 (3b): stamp the language this sentence is authored in (the board
        // language at save time). Block sentences resolve their text + voice against
        // this forever, never a later board language — structure isn't translatable.
        authoredLanguage: language,
        units,
        slots,
        ...(folderId ? { folderId } : {}),
      });
      clearTalker();
      setSaveDialogOpen(false);
    } finally {
      setIsSaving(false);
    }
  }

  function handleQuickSymbolTap(item: QuickSymbolItem) {
    playItem(item);
    addToTalker({
      symbolId: item.symbolId,
      label: item.label,
      imagePath: item.imagePath,
      audioPath: item.audioPath,
      // Phase 15 (Task 6): carry full localised records so the saved sentence keys
      // text by its true language.
      ...(item.labelRecord ? { labelRecord: item.labelRecord } : {}),
      // Phrase units carry their kind + name + decomposition through to the bar
      // (ADR-015). Word units leave these undefined and behave as before.
      ...(item.kind ? { kind: item.kind } : {}),
      ...(item.phraseName ? { phraseName: item.phraseName } : {}),
      ...(item.phraseNameRecord ? { phraseNameRecord: item.phraseNameRecord } : {}),
      ...(item.words ? { words: item.words } : {}),
    });
  }

  return (
    <>
      {/* No bottom padding — the page content below owns the gap via its own top
          padding, so the talker doesn't double up the space under it. */}
      <div className="shrink-0 px-theme-mobile-general md:px-theme-general pt-theme-mobile-general md:pt-theme-general">
        <Header
          symbols={talkerSymbols}
          language={language}
          onChipTap={handleChipTap}
          onPlaySentence={handlePlaySentence}
          onClear={clearTalker}
          onQuickSymbolTap={handleQuickSymbolTap}
          onRemove={removeFromTalker}
          onReorder={reorderTalker}
          onSave={handleSaveOpen}
        />
      </div>

      {/* Save-to-sentences folder picker (smart default preselected). */}
      <Dialog open={saveDialogOpen} onOpenChange={(o) => { if (!o) setSaveDialogOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('saveModalTitle')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 max-h-[50vh] overflow-auto">
            {(sentenceFolders ?? []).map((f) => {
              const isSelected = saveSelection === f._id;
              return (
                <button
                  key={f._id}
                  type="button"
                  onClick={() => setSaveSelection(f._id)}
                  className="text-left px-3 py-2.5 rounded-theme-sm text-theme-s font-medium transition-colors"
                  style={{
                    background: isSelected ? 'var(--theme-primary)' : 'var(--theme-symbol-bg)',
                    color: isSelected ? 'var(--theme-alt-text)' : 'var(--theme-text)',
                    border: `2px solid ${isSelected ? 'var(--theme-primary)' : 'transparent'}`,
                  }}
                >
                  {displayString(f.name, language, DEFAULT_LOCALE)}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setSaveSelection('ungrouped')}
              className="text-left px-3 py-2.5 rounded-theme-sm text-theme-s font-medium transition-colors"
              style={{
                background: saveSelection === 'ungrouped' ? 'var(--theme-primary)' : 'var(--theme-symbol-bg)',
                color: saveSelection === 'ungrouped' ? 'var(--theme-alt-text)' : 'var(--theme-text)',
                border: `2px solid ${saveSelection === 'ungrouped' ? 'var(--theme-primary)' : 'transparent'}`,
              }}
            >
              {t('saveUngrouped')}
            </button>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <button type="button" className="px-4 py-2 rounded-theme-sm text-theme-s font-medium" style={{ background: 'var(--theme-symbol-bg)', color: 'var(--theme-text)' }}>
                {t('saveCancel')}
              </button>
            </DialogClose>
            <button
              type="button"
              onClick={handleSaveConfirm}
              disabled={!saveSelection || isSaving}
              className="px-4 py-2 rounded-theme-sm text-theme-s font-semibold transition-opacity disabled:opacity-40"
              style={{ background: 'var(--theme-create)', color: '#fff' }}
            >
              {isSaving ? t('saveSaving') : t('saveConfirm')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {playing && (
        <CompositionPlayModal
          isOpen
          blocks={blocksFromTalker(talkerSymbols)}
          voiceId={voiceId}
          onClose={() => setPlaying(false)}
        />
      )}
    </>
  );
}
