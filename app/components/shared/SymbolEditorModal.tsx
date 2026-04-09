"use client";

// Full-screen modal for creating or editing a symbol.
// Phase 0.9: scaffold only — tab structure and prop interface defined.
// Phase 5: wire image search, AI generation, upload, audio, and Convex save.
//
// All props/callbacks only — no context dependency.

import { X } from 'lucide-react';

// Image source tab identifiers
export type ImageSourceTab = 'symbolstix' | 'google-images' | 'ai-generate' | 'device-upload';

// Matches the profileSymbol audio shape from the schema
export type AudioSourceType = 'default' | 'r2' | 'tts' | 'recorded';

export type SymbolEditorDraft = {
  symbolId?: string;        // set when editing an existing symbol; null for new
  imageSourceTab: ImageSourceTab;
  imagePath?: string;       // resolved after selection/upload
  labelByLanguage: Record<string, string>;   // { eng: "Apple", hin: "सेब" }
  audioSourceType: AudioSourceType;
  showLabel: boolean;
  showImage: boolean;
};

type SymbolEditorModalProps = {
  isOpen: boolean;
  profileId: string;
  categoryId: string;
  language: string;
  initialDraft?: Partial<SymbolEditorDraft>;
  onClose: () => void;
  onSave: (profileSymbolId: string) => void;
};

const IMAGE_TABS: { value: ImageSourceTab; label: string }[] = [
  { value: 'symbolstix',    label: 'SymbolStix' },
  { value: 'google-images', label: 'Google Images' },
  { value: 'ai-generate',   label: 'AI Generate' },
  { value: 'device-upload', label: 'Upload' },
];

export function SymbolEditorModal({
  isOpen,
  language,
  onClose,
}: SymbolEditorModalProps) {
  if (!isOpen) return null;

  // Phase 5: replace with real state, Convex mutations, and R2 upload logic.
  const activeImageTab: ImageSourceTab = 'symbolstix';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'var(--theme-bg-primary)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 shrink-0"
        style={{ background: 'var(--theme-bg-surface-alt)' }}
      >
        <h2
          className="text-subheading font-bold"
          style={{ color: 'var(--theme-nav-text)' }}
        >
          Symbol Editor
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center w-9 h-9 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.15)', color: 'var(--theme-nav-text)' }}
          aria-label="Close editor"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Image source tabs */}
      <div
        className="flex border-b shrink-0"
        style={{ borderColor: 'var(--theme-bg-surface-alt)' }}
      >
        {IMAGE_TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            // Phase 5: onClick={() => setActiveImageTab(value)}
            className="px-4 py-2.5 text-small font-medium relative"
            style={{
              color: activeImageTab === value
                ? 'var(--theme-brand-primary)'
                : 'var(--theme-text-secondary)',
            }}
          >
            {label}
            {activeImageTab === value && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
                style={{ background: 'var(--theme-brand-primary)' }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Content area — Phase 5: render tab-specific search/upload panels */}
      <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
        <p
          className="text-small text-center"
          style={{ color: 'var(--theme-text-secondary)' }}
        >
          Image source panel for <strong>{activeImageTab}</strong> — wired in Phase 5.
          <br />
          Language: {language}
        </p>
      </div>

      {/* Properties panel stub */}
      <div
        className="shrink-0 border-t p-4 flex flex-col gap-3"
        style={{
          background: 'var(--theme-bg-surface)',
          borderColor: 'var(--theme-bg-surface-alt)',
        }}
      >
        <p
          className="text-caption"
          style={{ color: 'var(--theme-text-secondary)' }}
        >
          Label · Audio · Display properties — wired in Phase 5.
        </p>

        {/* Save — disabled until Phase 5 */}
        <button
          type="button"
          disabled
          className="w-full py-3 rounded-xl text-small font-semibold opacity-40"
          style={{ background: 'var(--theme-brand-primary)', color: 'var(--theme-text-on-brand)' }}
        >
          Save to Category
        </button>
      </div>
    </div>
  );
}
