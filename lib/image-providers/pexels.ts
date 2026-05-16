/**
 * Pexels image search provider.
 *
 * Docs: https://www.pexels.com/api/documentation/
 * Free tier: 200 req/hour, 20,000/month. Auth via `Authorization: <key>` header
 * (no scheme prefix per Pexels docs).
 *
 * Sizes used: Pexels exposes named sizes only, no arbitrary widths. `medium`
 * is ~350px wide (good for grid thumbs); `large` is ~940px wide (good for
 * the saved image).
 *
 * Licence: Pexels License — free for any use; attribution appreciated.
 */

import type { ImageSearchResult, ProviderSearchFn } from "./types";

const PEXELS_API = "https://api.pexels.com/v1/search";
const PAGE_SIZE = 20;

type PexelsPhoto = {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  alt: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
};

type PexelsResponse = {
  total_results: number;
  page: number;
  per_page: number;
  photos: PexelsPhoto[];
};

export const searchPexels: ProviderSearchFn = async (
  query: string,
  page = 0
): Promise<ImageSearchResult[]> => {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];

  const params = new URLSearchParams({
    query,
    page: String(page + 1), // Pexels is 1-indexed
    per_page: String(PAGE_SIZE),
  });

  let res: Response;
  try {
    res = await fetch(`${PEXELS_API}?${params}`, {
      headers: { Authorization: key },
    });
  } catch (err) {
    console.error("[image-providers/pexels] fetch failed", err);
    return [];
  }
  if (!res.ok) {
    console.error(`[image-providers/pexels] API error: ${res.status}`);
    return [];
  }

  const json = (await res.json()) as PexelsResponse;
  const photos = json.photos ?? [];

  return photos.map((p): ImageSearchResult => ({
    providerId: String(p.id),
    provider: "pexels",
    title: p.alt || "Pexels photo",
    thumbnailUrl: p.src.medium,
    fullImageUrl: p.src.large,
    sourceUrl: p.url,
    attribution: p.photographer || "Unknown",
    license: "Pexels License",
    width: p.width,
    height: p.height,
    mime: "image/jpeg",
  }));
};
