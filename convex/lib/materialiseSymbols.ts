import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { LibraryPackCategorySymbol } from "../data/_shared/types";

/**
 * Materialise symbols from a content-module category's JSON snapshot into an
 * existing `profileCategory`. Handles two kinds:
 *
 *  - SymbolStix-backed (default when `imageSourceType` is absent or
 *    "symbolstix"): look up the global symbols row by `symbolId`; missing
 *    rows are skipped (partial loads beat no load).
 *  - Custom (upload / imageSearch / aiGenerated): create a profileSymbol with
 *    the snapshot's `imagePath`, attribution where applicable, and a
 *    recorded-voice override if one was published.
 *
 * Audio for custom symbols: only recorded voice is persisted into the module,
 * because TTS audio lives in the global cache and SymbolStix defaults belong
 * to a different image source. For symbols without a recordedAudioPath, the
 * loaded symbol has no audio override and falls back to the runtime
 * synth-the-label playback path.
 *
 * Relocated from the retired `resourcePacks.ts` (Phase 14.5 Stage 2 teardown);
 * the sole live consumer is `lib/contentModuleInstall.ts`.
 */
export async function materialiseSymbolsFromJson(
  ctx: MutationCtx,
  accountId: Id<"users">,
  profileCategoryId: Id<"profileCategories">,
  symbols: LibraryPackCategorySymbol[],
  now: number
): Promise<{ symbolsAdded: number; symbolsSkipped: number }> {
  let symbolsAdded = 0;
  let symbolsSkipped = 0;
  let symbolOrder = 0;

  for (const sym of symbols) {
    const kind = sym.imageSourceType ?? "symbolstix";

    if (kind === "symbolstix") {
      if (!sym.symbolId) {
        symbolsSkipped++;
        continue;
      }
      const symbolDoc = await ctx.db.get(sym.symbolId as Id<"symbols">);
      if (!symbolDoc) {
        symbolsSkipped++;
        continue;
      }

      const label: Record<string, string> = {
        ...symbolDoc.words,
        ...(sym.labelOverride ?? {}),
      };

      await ctx.db.insert("profileSymbols", {
        accountId,
        profileCategoryId,
        order: symbolOrder++,
        imageSource: {
          type: "symbolstix",
          symbolId: symbolDoc._id,
        },
        label,
        ...(sym.display ? { display: sym.display } : {}),
        updatedAt: now,
      });
      symbolsAdded++;
      continue;
    }

    // Custom-image kinds.
    if (!sym.imagePath) {
      symbolsSkipped++;
      continue;
    }

    const label: Record<string, string> =
      sym.label ?? sym.labelOverride ?? { en: "" };

    let imageSource;
    if (kind === "imageSearch") {
      imageSource = {
        type: "imageSearch" as const,
        imagePath: sym.imagePath,
        ...(sym.imageSourceUrl !== undefined
          ? { imageSourceUrl: sym.imageSourceUrl }
          : {}),
        ...(sym.attribution !== undefined ? { attribution: sym.attribution } : {}),
        ...(sym.license !== undefined ? { license: sym.license } : {}),
      };
    } else if (kind === "aiGenerated") {
      imageSource = {
        type: "aiGenerated" as const,
        imagePath: sym.imagePath,
        ...(sym.aiPrompt !== undefined ? { aiPrompt: sym.aiPrompt } : {}),
      };
    } else {
      // "upload" → profileSymbols schema literal is "userUpload"
      imageSource = {
        type: "userUpload" as const,
        imagePath: sym.imagePath,
      };
    }

    const audio = sym.recordedAudioPath
      ? {
          en: {
            type: "recorded" as const,
            path: sym.recordedAudioPath,
          },
        }
      : undefined;

    await ctx.db.insert("profileSymbols", {
      accountId,
      profileCategoryId,
      order: symbolOrder++,
      imageSource,
      label,
      ...(audio ? { audio } : {}),
      ...(sym.display ? { display: sym.display } : {}),
      updatedAt: now,
    });
    symbolsAdded++;
  }

  return { symbolsAdded, symbolsSkipped };
}
