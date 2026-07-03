/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as accountMembers from "../accountMembers.js";
import type * as admin_overviewStats from "../admin/overviewStats.js";
import type * as contentModules_categories from "../contentModules/categories.js";
import type * as contentModules_detail from "../contentModules/detail.js";
import type * as contentModules_exportModules from "../contentModules/exportModules.js";
import type * as contentModules_lists from "../contentModules/lists.js";
import type * as contentModules_phrases from "../contentModules/phrases.js";
import type * as contentModules_publish from "../contentModules/publish.js";
import type * as contentModules_sentences from "../contentModules/sentences.js";
import type * as contentModules_translate from "../contentModules/translate.js";
import type * as crons from "../crons.js";
import type * as data__shared_types from "../data/_shared/types.js";
import type * as data_categories__index from "../data/categories/_index.js";
import type * as data_defaultCategorySymbols from "../data/defaultCategorySymbols.js";
import type * as data_languages__index from "../data/languages/_index.js";
import type * as data_languages_types from "../data/languages/types.js";
import type * as data_library_packs__index from "../data/library_packs/_index.js";
import type * as data_library_packs_types from "../data/library_packs/types.js";
import type * as data_lists__index from "../data/lists/_index.js";
import type * as data_phrases__index from "../data/phrases/_index.js";
import type * as data_sentences__index from "../data/sentences/_index.js";
import type * as data_starter_backups_index from "../data/starter_backups/index.js";
import type * as data_themes__index from "../data/themes/_index.js";
import type * as data_themes_types from "../data/themes/types.js";
import type * as dropbar from "../dropbar.js";
import type * as featureQuota from "../featureQuota.js";
import type * as imageCache from "../imageCache.js";
import type * as languages from "../languages.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_account from "../lib/account.js";
import type * as lib_contentModuleDelete from "../lib/contentModuleDelete.js";
import type * as lib_contentModuleInstall from "../lib/contentModuleInstall.js";
import type * as lib_contentModules from "../lib/contentModules.js";
import type * as lib_libraryPacks from "../lib/libraryPacks.js";
import type * as lib_themes from "../lib/themes.js";
import type * as migrations from "../migrations.js";
import type * as modellingSessions from "../modellingSessions.js";
import type * as profileCategories from "../profileCategories.js";
import type * as profileFolders from "../profileFolders.js";
import type * as profileLists from "../profileLists.js";
import type * as profilePhrases from "../profilePhrases.js";
import type * as profileSentences from "../profileSentences.js";
import type * as profileSymbols from "../profileSymbols.js";
import type * as resourcePacks from "../resourcePacks.js";
import type * as studentProfiles from "../studentProfiles.js";
import type * as studentViewLock from "../studentViewLock.js";
import type * as studentViewSessions from "../studentViewSessions.js";
import type * as symbols from "../symbols.js";
import type * as themes from "../themes.js";
import type * as translationActions from "../translationActions.js";
import type * as translationJobs from "../translationJobs.js";
import type * as ttsCache from "../ttsCache.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  accountMembers: typeof accountMembers;
  "admin/overviewStats": typeof admin_overviewStats;
  "contentModules/categories": typeof contentModules_categories;
  "contentModules/detail": typeof contentModules_detail;
  "contentModules/exportModules": typeof contentModules_exportModules;
  "contentModules/lists": typeof contentModules_lists;
  "contentModules/phrases": typeof contentModules_phrases;
  "contentModules/publish": typeof contentModules_publish;
  "contentModules/sentences": typeof contentModules_sentences;
  "contentModules/translate": typeof contentModules_translate;
  crons: typeof crons;
  "data/_shared/types": typeof data__shared_types;
  "data/categories/_index": typeof data_categories__index;
  "data/defaultCategorySymbols": typeof data_defaultCategorySymbols;
  "data/languages/_index": typeof data_languages__index;
  "data/languages/types": typeof data_languages_types;
  "data/library_packs/_index": typeof data_library_packs__index;
  "data/library_packs/types": typeof data_library_packs_types;
  "data/lists/_index": typeof data_lists__index;
  "data/phrases/_index": typeof data_phrases__index;
  "data/sentences/_index": typeof data_sentences__index;
  "data/starter_backups/index": typeof data_starter_backups_index;
  "data/themes/_index": typeof data_themes__index;
  "data/themes/types": typeof data_themes_types;
  dropbar: typeof dropbar;
  featureQuota: typeof featureQuota;
  imageCache: typeof imageCache;
  languages: typeof languages;
  "lib/access": typeof lib_access;
  "lib/account": typeof lib_account;
  "lib/contentModuleDelete": typeof lib_contentModuleDelete;
  "lib/contentModuleInstall": typeof lib_contentModuleInstall;
  "lib/contentModules": typeof lib_contentModules;
  "lib/libraryPacks": typeof lib_libraryPacks;
  "lib/themes": typeof lib_themes;
  migrations: typeof migrations;
  modellingSessions: typeof modellingSessions;
  profileCategories: typeof profileCategories;
  profileFolders: typeof profileFolders;
  profileLists: typeof profileLists;
  profilePhrases: typeof profilePhrases;
  profileSentences: typeof profileSentences;
  profileSymbols: typeof profileSymbols;
  resourcePacks: typeof resourcePacks;
  studentProfiles: typeof studentProfiles;
  studentViewLock: typeof studentViewLock;
  studentViewSessions: typeof studentViewSessions;
  symbols: typeof symbols;
  themes: typeof themes;
  translationActions: typeof translationActions;
  translationJobs: typeof translationJobs;
  ttsCache: typeof ttsCache;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
