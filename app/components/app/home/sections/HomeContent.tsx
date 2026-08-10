"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation, useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useProfile } from "@/app/contexts/ProfileContext";
import { useAppState } from "@/app/contexts/AppStateProvider";
import { useCreateCategory } from "@/app/lib/categories/useCreateCategory";
import { ResourceLibraryBanner } from "@/app/components/app/home/sections/ResourceLibraryBanner";
import { HomeNavCards } from "@/app/components/app/home/sections/HomeNavCards";
import { HomeCreateCards } from "@/app/components/app/home/sections/HomeCreateCards";
import { CreateCategoryModal } from "@/app/components/app/categories/modals/CreateCategoryModal";
import { CreateListModal } from "@/app/components/app/lists/modals/CreateListModal";
import { CreateSentenceModal } from "@/app/components/app/sentences/modals/CreateSentenceModal";
import { SymbolEditorModal } from "@/app/components/app/shared/modals/symbol-editor/SymbolEditorModal";
import { UpgradeNudge } from "@/app/components/app/shared/ui/UpgradeNudge";

/**
 * In-app Home (Figma `1391:20546`) — a links-and-library landing page:
 *   1. Resource-library banner → quick link to /library/modules (future carousel)
 *   2. Nav cards → Categories / Lists / Sentences / Search
 *   3. Create cards → the matching create modals
 *
 * Owns the create-modal state + mutations; the create handlers mirror the
 * Categories / Lists / Sentences listings so a Home-created item lands in the
 * same place with the same edit-mode hand-off.
 */
export function HomeContent() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { accountId, language, voiceId } = useProfile();
  const { subscription } = useAppState();
  const isFree = subscription.tier === "free";

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [sentenceOpen, setSentenceOpen] = useState(false);
  const [symbolOpen, setSymbolOpen] = useState(false);
  const [upgradeNudgeOpen, setUpgradeNudgeOpen] = useState(false);

  // The four create mutations are all Pro-gated server-side. Intercept free
  // users at the entry point with the upgrade nudge — same as the feature
  // pages — instead of letting them hit a raw server error on submit.
  function gated(open: () => void) {
    return () => {
      if (isFree) {
        setUpgradeNudgeOpen(true);
        return;
      }
      open();
    };
  }

  // Needed by the Create-a-Symbol flow: the editor's category picker can only
  // gate save when categories exist. With none, send the user to /categories.
  const categories = useQuery(api.profileCategories.getProfileCategories, {});

  const createCategory = useCreateCategory();
  const convex = useConvex();
  const createList = useMutation(api.profileLists.createProfileList);
  const updateListItems = useMutation(api.profileLists.updateProfileListItems);
  const createSentence = useMutation(api.profileSentences.createProfileSentence);

  async function handleCreateCategory(name: string, rows: Array<{ label: string; autoMatch: boolean }>) {
    const id = await createCategory(name, rows);
    router.push(`/${locale}/categories/${id}?edit=1`);
  }

  async function handleCreateList(name: string, rows: Array<{ label: string; autoMatch: boolean }>) {
    const id = await createList({ name: { en: name } });
    const kept = rows
      .map((r) => ({ description: r.label.trim(), autoMatch: r.autoMatch }))
      .filter((r) => r.description.length > 0);
    if (kept.length > 0) {
      // Auto-match rows resolve each step's top symbol IMAGE; the description
      // stays the typed step (text + audio are authored on the row).
      const items = await Promise.all(
        kept.map(async ({ description, autoMatch }, i) => {
          let imagePath: string | undefined;
          if (autoMatch) {
            const hits = await convex.query(api.symbols.searchSymbols, {
              searchTerm: description, language, limit: 1,
            });
            imagePath = hits?.[0]?.imagePath;
          }
          // Tag the source so the imageOnly editor reopens on the SymbolStix tab
          // (not Upload) — an auto-matched image is a SymbolStix image.
          return {
            order: i,
            description,
            ...(imagePath ? { imagePath, imageSourceType: 'symbolstix' as const } : {}),
          };
        }),
      );
      await updateListItems({ profileListId: id, items });
    }
    router.push(`/${locale}/lists/${id}?edit=1`);
  }

  async function handleCreateSentence(name: string) {
    // Key the name by the CURRENT board language (you're authoring in it) and
    // stamp authoredLanguage — consistent with the Sentences-page + talker saves
    // (ADR-016). Hardcoding `en` mislabelled every quick-created sentence.
    await createSentence({ name: { [language]: name }, authoredLanguage: language });
    router.push(`/${locale}/sentences`);
  }

  function handleCreateSymbol() {
    // No categories yet → the picker would be empty; route to where the user
    // can make one instead of opening an unusable editor.
    if (categories && categories.length === 0) {
      router.push(`/${locale}/categories`);
      return;
    }
    setSymbolOpen(true);
  }

  return (
    <div className="flex flex-col h-full px-theme-mobile-general py-theme-mobile-general md:px-theme-general md:py-theme-general gap-theme-mobile-gap md:gap-theme-gap overflow-auto">
      <ResourceLibraryBanner />

      <HomeNavCards />

      <HomeCreateCards
        onCreateSymbol={gated(handleCreateSymbol)}
        onCreateCategory={gated(() => setCategoryOpen(true))}
        onCreateList={gated(() => setListOpen(true))}
        onCreateSentence={gated(() => setSentenceOpen(true))}
      />

      {/* Create modals — reused as-is from each feature. */}
      <CreateCategoryModal
        isOpen={categoryOpen}
        onClose={() => setCategoryOpen(false)}
        onCreate={handleCreateCategory}
      />
      <CreateListModal
        isOpen={listOpen}
        onClose={() => setListOpen(false)}
        onCreate={handleCreateList}
      />
      <CreateSentenceModal
        isOpen={sentenceOpen}
        onClose={() => setSentenceOpen(false)}
        onCreate={handleCreateSentence}
      />

      {/* Create-a-Symbol — categoryBoard mode with no preset category; the
          editor's built-in category picker gates Save until one is chosen. */}
      {symbolOpen && accountId && (
        <SymbolEditorModal
          isOpen
          accountId={accountId}
          language={language}
          voiceId={voiceId}
          editorMode="categoryBoard"
          onClose={() => setSymbolOpen(false)}
          onSave={() => setSymbolOpen(false)}
        />
      )}

      {/* Free-tier upgrade nudge — fires from the gated create handlers. */}
      <UpgradeNudge open={upgradeNudgeOpen} onOpenChange={setUpgradeNudgeOpen} locale={locale} />
    </div>
  );
}
