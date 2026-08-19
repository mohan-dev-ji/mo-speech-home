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
import { buildSentenceSlots } from "@/lib/sentences/autoMatchSlots";
import { useAutoMatchDeps } from "@/app/lib/symbols/useAutoMatchDeps";
import { SymbolEditorModal } from "@/app/components/app/shared/modals/symbol-editor/SymbolEditorModal";
import { UpgradeNudge } from "@/app/components/app/shared/ui/UpgradeNudge";
import { useResolveGroupSelection } from '@/app/lib/folders/useResolveGroupSelection';
import type { GroupSelection } from '@/app/components/app/shared/ui/GroupPicker';

/**
 * In-app Home (Figma `1391:20546`) — a links-and-library landing page:
 *   1. Resource-library banner → quick link to /library/modules (future carousel)
 *   2. Nav cards → Categories / Lists / Sentences / Search
 *   3. Create cards → the matching create modals
 *
 * Owns the create-modal state + mutations. Every create handler ends by routing
 * to the CONTAINER the user filed the new item into — the chosen group for a
 * list or sentence, the chosen category for a symbol, the new board for a
 * category — so you land looking at where it went, with the destination's Edit
 * toggle one click away. Deliberately no `?edit=1`: Home's cards drop you at the
 * module, not inside edit mode (the feature pages' own create buttons still do
 * the straight-into-edit hand-off, which is right when you're already there).
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
  // MOS-13 — search resolver for the create-sentence card's auto-match checkbox.
  const autoMatchDeps = useAutoMatchDeps();
  // MOS-13 — Home's quick-create cards used to file nothing, stranding every
  // list and sentence in Drafts. One resolver per tree.
  const resolveListGroup = useResolveGroupSelection('lists');
  const resolveSentenceGroup = useResolveGroupSelection('sentences');

  async function handleCreateCategory(name: string, rows: Array<{ label: string; autoMatch: boolean }>) {
    const id = await createCategory(name, rows);
    router.push(`/${locale}/categories/${id}`);
  }

  async function handleCreateList(
    name: string,
    { rows, group }: { rows: Array<{ label: string; autoMatch: boolean }>; group?: GroupSelection },
  ) {
    // Resolve BEFORE the list create: if this makes a folder and then throws,
    // nothing is written. See useResolveGroupSelection.
    const folderId = group ? await resolveListGroup(group) : undefined;
    // Key the name under the ACTIVE board language, not a hardcoded `en` — else
    // non-English lists are mislabelled "Made in EN" (variant state is derived
    // from which language keys the record holds). Mirrors createSentence below.
    const id = await createList({
      name: { [language]: name },
      authoredLanguage: language,
      ...(folderId ? { folderId } : {}),
    });
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
            // Key under the active board language too (a plain string hydrates
            // under DEFAULT_LOCALE `en`).
            description: { [language]: description },
            ...(imagePath ? { imagePath, imageSourceType: 'symbolstix' as const } : {}),
          };
        }),
      );
      await updateListItems({ profileListId: id, items });
    }
    router.push(`/${locale}/lists/folder/${folderId ?? 'ungrouped'}`);
  }

  async function handleCreateSentence(
    name: string,
    { autoMatch, group }: { autoMatch: boolean; group?: GroupSelection },
  ) {
    // Resolve BEFORE the sentence create — see useResolveGroupSelection.
    const folderId = group ? await resolveSentenceGroup(group) : undefined;
    // MOS-13 — auto-match: one image-only slot per word, resolved BEFORE the
    // create so the sentence is never persisted half-filled. Brings this card
    // in line with the create-a-list and create-a-category cards beside it,
    // which already auto-match.
    const slots = autoMatch
      ? await buildSentenceSlots(name, language, autoMatchDeps)
      : undefined;
    // Key the name by the CURRENT board language (you're authoring in it) and
    // stamp authoredLanguage — consistent with the Sentences-page + talker saves
    // (ADR-016). Hardcoding `en` mislabelled every quick-created sentence.
    await createSentence({
      name: { [language]: name },
      authoredLanguage: language,
      ...(slots ? { slots } : {}),
      ...(folderId ? { folderId } : {}),
    });
    router.push(`/${locale}/sentences/folder/${folderId ?? 'ungrouped'}`);
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
        showGroupPicker
      />
      <CreateSentenceModal
        isOpen={sentenceOpen}
        onClose={() => setSentenceOpen(false)}
        onCreate={handleCreateSentence}
        showAutoMatch
        showGroupPicker
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
          onSave={(_id, profileCategoryId) => {
            setSymbolOpen(false);
            router.push(`/${locale}/categories/${profileCategoryId}`);
          }}
        />
      )}

      {/* Free-tier upgrade nudge — fires from the gated create handlers. */}
      <UpgradeNudge open={upgradeNudgeOpen} onOpenChange={setUpgradeNudgeOpen} locale={locale} />
    </div>
  );
}
