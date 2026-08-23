/**
 * Wikimedia Commons image search provider.
 *
 * Public MediaWiki API — no key, no auth. Server-rendered thumbnails via
 * `iiurlwidth` mean we never resize locally.
 *
 * Etiquette: send a descriptive User-Agent per
 * https://meta.wikimedia.org/wiki/User-Agent_policy
 */

import type { ImageSearchResult, ProviderSearchFn } from "./types";

const WIKIMEDIA_API = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT =
  "mo-speech (https://mospeech.com; support@mospeech.com)";
const PAGE_SIZE = 20;
/**
 * Width we ASK the API for. Wikimedia decides what we actually get — see
 * `iiurlwidth` handling below. 640 matches the save width Unsplash and Pixabay
 * use, so stored symbol images are consistent across providers.
 */
const REQUEST_WIDTH = 640;

type ApiPage = {
  pageid: number;
  title: string;
  imageinfo?: Array<{
    url: string;
    descriptionurl: string;
    mime: string;
    width: number;
    height: number;
    thumburl?: string;
    thumbwidth?: number;
    thumbheight?: number;
    extmetadata?: Record<string, { value: string } | undefined>;
  }>;
};

type SearchResponse = {
  query?: { pages?: ApiPage[] };
};

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function readMeta(
  meta: Record<string, { value: string } | undefined> | undefined,
  key: string
): string {
  const v = meta?.[key]?.value;
  return v ? stripHtml(String(v)) : "";
}

/**
 * NEVER construct or rewrite a Wikimedia thumbnail URL (MOS-8).
 *
 * Wikimedia restricts thumbnail generation to a per-file allowlist of widths.
 * Asking for one outside it returns **400 "Use thumbnail sizes listed on
 * https://w.wiki/GHai"** — which is what this provider used to do: it took the
 * API's valid `thumburl` and rewrote the `/<N>px-` token to a hard-coded 640,
 * so every result whose file did not happen to permit 640 failed on select.
 *
 * The allowlist is not predictable from the outside. Measured on one file:
 *
 *   iiurlwidth=320 → URL says 330px   iiurlwidth=512 → URL says 960px
 *   iiurlwidth=500 → URL says 500px   iiurlwidth=640 → URL says 960px
 *
 * `thumbwidth` in the response echoes what you ASKED for, so it does not
 * predict the URL either. Only the returned `thumburl` is authoritative, and
 * every returned `thumburl` fetches.
 *
 * The API also handles the no-upscale case itself: request a width above the
 * original and it returns the original file URL (tagged `thumbnail_unscaled`),
 * still on `upload.wikimedia.org` so the proxy allowlist passes. That makes the
 * old "small original" guard redundant — small originals need no special case.
 *
 * So: pass the width we want as `iiurlwidth`, then use `thumburl` verbatim for
 * both grid and save. One URL per result, as `pixabay.ts` already does with
 * `webformatURL`, which also saves the selected image a second fetch.
 */

/**
 * Search Wikimedia Commons. Returns up to 20 results per page; SVG results
 * are filtered out (mostly diagrams/logos, low value for AAC).
 */
export const searchWikimedia: ProviderSearchFn = async (
  query: string,
  page = 0
): Promise<ImageSearchResult[]> => {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    // Wikimedia search syntax: filetype filters to bitmap (jpg/png/etc) + drawing (svg).
    // We re-filter SVGs out below — leaving "drawing" in the search nets some PNG icons
    // that get misclassified, so the recall is worth the post-filter pass.
    gsrsearch: `filetype:bitmap|drawing ${query}`,
    gsrnamespace: "6", // File namespace
    gsrlimit: String(PAGE_SIZE),
    gsroffset: String(page * PAGE_SIZE),
    prop: "imageinfo",
    iiprop: "url|size|extmetadata|mime",
    iiurlwidth: String(REQUEST_WIDTH),
    origin: "*",
  });

  let res: Response;
  try {
    res = await fetch(`${WIKIMEDIA_API}?${params}`, {
      headers: { "User-Agent": USER_AGENT },
    });
  } catch (err) {
    console.error("[image-providers/wikimedia] fetch failed", err);
    return [];
  }
  if (!res.ok) {
    console.error(`[image-providers/wikimedia] API error: ${res.status}`);
    return [];
  }

  const json = (await res.json()) as SearchResponse;
  const pages = json.query?.pages ?? [];

  return pages
    .map((p): ImageSearchResult | null => {
      const info = p.imageinfo?.[0];
      if (!info) return null;
      // Image-only filter. The `filetype:bitmap|drawing` search filter is
      // leaky — PDFs, DjVu scans, and TIFFs sometimes leak through and they
      // RENDER as PNG thumbnails (so the grid looks fine) but `info.url`
      // points at the actual PDF/DjVu/etc., and clicking through to the
      // proxy then fetches a non-image MIME and 502s. Drop anything that
      // doesn't declare an image MIME on the file itself.
      //
      // Also drop SVGs explicitly — they tend to be diagrams/logos/license
      // marks, low value for AAC.
      if (!info.mime.startsWith("image/")) return null;
      if (info.mime === "image/svg+xml") return null;
      if (!info.thumburl) return null;

      return {
        providerId: String(p.pageid),
        provider: "wikimedia",
        title: p.title,
        // Both come straight from the API — see the note above. Same URL for
        // grid and save, so selecting a result needs no second download.
        thumbnailUrl: info.thumburl,
        fullImageUrl: info.thumburl,
        sourceUrl: info.descriptionurl,
        attribution: readMeta(info.extmetadata, "Artist") || "Unknown",
        license: readMeta(info.extmetadata, "LicenseShortName") || "Unknown",
        width: info.width,
        height: info.height,
        mime: info.mime,
      };
    })
    .filter((r): r is ImageSearchResult => r !== null);
};
