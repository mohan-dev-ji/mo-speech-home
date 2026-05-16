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
import type * as data_defaultCategorySymbols from "../data/defaultCategorySymbols.js";
import type * as data_library_packs__index from "../data/library_packs/_index.js";
import type * as data_library_packs_types from "../data/library_packs/types.js";
import type * as data_starter_backups_index from "../data/starter_backups/index.js";
import type * as featureQuota from "../featureQuota.js";
import type * as imageCache from "../imageCache.js";
import type * as lib_account from "../lib/account.js";
import type * as lib_libraryPacks from "../lib/libraryPacks.js";
import type * as migrations from "../migrations.js";
import type * as modellingSessions from "../modellingSessions.js";
import type * as profileCategories from "../profileCategories.js";
import type * as profileLists from "../profileLists.js";
import type * as profileSentences from "../profileSentences.js";
import type * as profileSymbols from "../profileSymbols.js";
import type * as resourcePacks from "../resourcePacks.js";
import type * as studentProfiles from "../studentProfiles.js";
import type * as studentViewLock from "../studentViewLock.js";
import type * as studentViewSessions from "../studentViewSessions.js";
import type * as symbols from "../symbols.js";
import type * as themes from "../themes.js";
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
  "data/defaultCategorySymbols": typeof data_defaultCategorySymbols;
  "data/library_packs/_index": typeof data_library_packs__index;
  "data/library_packs/types": typeof data_library_packs_types;
  "data/starter_backups/index": typeof data_starter_backups_index;
  featureQuota: typeof featureQuota;
  imageCache: typeof imageCache;
  "lib/account": typeof lib_account;
  "lib/libraryPacks": typeof lib_libraryPacks;
  migrations: typeof migrations;
  modellingSessions: typeof modellingSessions;
  profileCategories: typeof profileCategories;
  profileLists: typeof profileLists;
  profileSentences: typeof profileSentences;
  profileSymbols: typeof profileSymbols;
  resourcePacks: typeof resourcePacks;
  studentProfiles: typeof studentProfiles;
  studentViewLock: typeof studentViewLock;
  studentViewSessions: typeof studentViewSessions;
  symbols: typeof symbols;
  themes: typeof themes;
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
