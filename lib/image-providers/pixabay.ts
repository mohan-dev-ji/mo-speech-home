/**
 * Pixabay image search provider.
 *
 * Docs: https://pixabay.com/api/docs/
 * Free tier: 5,000 req/hour. Auth via `key` query param.
 *
 * Sizes used:
 *  - `webformatURL` — up to 640px wide. Used for both thumb and full; saves
 *    a second call and keeps grid sharp on retina. Pixabay doesn't support
 *    arbitrary widths, so we accept the bytes it serves.
 *
 * Licence: Pixabay License (commercial use, no attribution required, but we
 * record it anyway for the audit trail).
 */

import type { ImageSearchResult, ProviderSearchFn } from "./types";

const PIXABAY_API = "https://pixabay.com/api/";
const PAGE_SIZE = 20;

type PixabayHit = {
  id: number;
  pageURL: string;
  type: string;
  tags: string;
  previewURL: string;
  webformatURL: string;
  webformatWidth: number;
  webformatHeight: number;
  largeImageURL: string;
  imageWidth: number;
  imageHeight: number;
  user: string;
};

type PixabayResponse = {
  total: number;
  totalHits: number;
  hits: PixabayHit[];
};

export const searchPixabay: ProviderSearchFn = async (
  query: string,
  page = 0
): Promise<ImageSearchResult[]> => {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return [];

  const params = new URLSearchParams({
    key,
    q: query,
    image_type: "photo",
    safesearch: "true",
    per_page: String(PAGE_SIZE),
    page: String(page + 1), // Pixabay is 1-indexed
  });

  let res: Response;
  try {
    res = await fetch(`${PIXABAY_API}?${params}`);
  } catch (err) {
    console.error("[image-providers/pixabay] fetch failed", err);
    return [];
  }
  if (!res.ok) {
    console.error(`[image-providers/pixabay] API error: ${res.status}`);
    return [];
  }

  const json = (await res.json()) as PixabayResponse;
  const hits = json.hits ?? [];

  return hits.map((hit): ImageSearchResult => ({
    providerId: String(hit.id),
    provider: "pixabay",
    title: hit.tags || "Pixabay image",
    thumbnailUrl: hit.webformatURL,
    fullImageUrl: hit.webformatURL,
    sourceUrl: hit.pageURL,
    attribution: hit.user || "Unknown",
    license: "Pixabay License",
    width: hit.webformatWidth || hit.imageWidth,
    height: hit.webformatHeight || hit.imageHeight,
    mime: "image/jpeg",
  }));
};
