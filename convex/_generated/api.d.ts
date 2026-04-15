/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountMembers from "../accountMembers.js";
import type * as data_defaultCategorySymbols from "../data/defaultCategorySymbols.js";
import type * as profileCategories from "../profileCategories.js";
import type * as studentProfiles from "../studentProfiles.js";
import type * as symbols from "../symbols.js";
import type * as themes from "../themes.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accountMembers: typeof accountMembers;
  "data/defaultCategorySymbols": typeof data_defaultCategorySymbols;
  profileCategories: typeof profileCategories;
  studentProfiles: typeof studentProfiles;
  symbols: typeof symbols;
  themes: typeof themes;
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
