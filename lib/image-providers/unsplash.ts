/**
 * Unsplash image search provider.
 *
 * Docs: https://unsplash.com/documentation
 * Free demo tier: 50 req/hour (tight). Production tier: 5,000/hour, requires
 * approval. Auth via `Authorization: Client-ID <key>` header.
 *
 * Sizes used: Unsplash serves photos through Imgix; we append `?w=...&fit=clip`
 * to `urls.raw` to request a specific width server-side.
 *
 * Tracking ping: Unsplash API ToS requires us to call /photos/:id/download
 * when a user "uses" (saves) an image. We fire-and-forget from the proxy
 * route when a user picks an Unsplash result.
 *
 * Licence: Unsplash License — free for any use; attribution appreciated.
 */

import type { ImageSearchResult, ProviderSearchFn } from "./types";

const UNSPLASH_API = "https://api.unsplash.com/search/photos";
const UNSPLASH_DOWNLOAD = "https://api.unsplash.com/photos";
const PAGE_SIZE = 20;
const THUMB_WIDTH = 320;
const FULL_WIDTH = 640;

type UnsplashPhoto = {
  id: string;
  urls: { raw: string; full: string; regular: string; small: string; thumb: string };
  description: string | null;
  alt_description: string | null;
  links: { html: string; download: string; download_location: string };
  user: { name: string; username: string };
  width: number;
  height: number;
};

type UnsplashResponse = {
  total: number;
  total_pages: number;
  results: UnsplashPhoto[];
};

function widthVariant(rawUrl: string, width: number): string {
  const sep = rawUrl.includes("?") ? "&" : "?";
  return `${rawUrl}${sep}w=${width}&fit=clip`;
}

export const searchUnsplash: ProviderSearchFn = async (
  query: string,
  page = 0
): Promise<ImageSearchResult[]> => {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];

  const params = new URLSearchParams({
    query,
    page: String(page + 1), // Unsplash is 1-indexed
    per_page: String(PAGE_SIZE),
    content_filter: "high",
  });

  let res: Response;
  try {
    res = await fetch(`${UNSPLASH_API}?${params}`, {
      headers: { Authorization: `Client-ID ${key}` },
    });
  } catch (err) {
    console.error("[image-providers/unsplash] fetch failed", err);
    return [];
  }
  if (!res.ok) {
    console.error(`[image-providers/unsplash] API error: ${res.status}`);
    return [];
  }

  const json = (await res.json()) as UnsplashResponse;
  const photos = json.results ?? [];

  return photos.map((p): ImageSearchResult => ({
    providerId: p.id,
    provider: "unsplash",
    title: p.description || p.alt_description || "Unsplash photo",
    thumbnailUrl: widthVariant(p.urls.raw, THUMB_WIDTH),
    fullImageUrl: widthVariant(p.urls.raw, FULL_WIDTH),
    sourceUrl: p.links.html,
    attribution: p.user.name || p.user.username || "Unknown",
    license: "Unsplash License",
    width: p.width,
    height: p.height,
    mime: "image/jpeg",
  }));
};

/**
 * Fire-and-forget tracking ping required by Unsplash API ToS when a user
 * "uses" (saves) an image. Doesn't return the image — just notifies Unsplash.
 * Errors are logged but never thrown; failing to ping shouldn't break the
 * user-facing save flow.
 */
export async function recordUnsplashDownload(providerId: string): Promise<void> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return;

  try {
    const res = await fetch(`${UNSPLASH_DOWNLOAD}/${providerId}/download`, {
      headers: { Authorization: `Client-ID ${key}` },
    });
    if (!res.ok) {
      console.error(`[image-providers/unsplash] download ping ${res.status}`);
    }
  } catch (err) {
    console.error("[image-providers/unsplash] download ping failed", err);
  }
}
