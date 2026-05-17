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
const THUMB_WIDTH = 320;
const FULL_WIDTH = 640;

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
 * Pick the URL to use for the "full size" (save) version of a result.
 *
 * Wikimedia's thumbnail factory will downscale on demand but **won't
 * upscale** — requesting a 640px thumbnail of a 200px-wide original returns
 * 404. License-mark icons (titles like "Public Domain Mark", "CC0 1.0") are
 * a common case of small originals that crashed the click handler before
 * this guard existed.
 *
 *  - Original width ≥ FULL_WIDTH → widen the thumb URL by swapping
 *    `/<N>px-` → `/<FULL_WIDTH>px-` at the URL tail.
 *  - Original width < FULL_WIDTH → return `info.url`, the raw original file
 *    URL (also on `upload.wikimedia.org`, so the proxy allowlist passes).
 *
 * The regex anchors to the URL tail — some Wikimedia filenames legitimately
 * contain a `<digits>px-` token (screenshots of width markers etc.) and we
 * don't want to rewrite those mid-path.
 */
function pickFullImageUrl(info: { url: string; thumburl?: string; width: number }): string {
  if (!info.thumburl) return info.url;
  if (info.width >= FULL_WIDTH) {
    return info.thumburl.replace(/\/\d+px-([^/]+)$/, `/${FULL_WIDTH}px-$1`);
  }
  return info.url;
}

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
    iiurlwidth: String(THUMB_WIDTH),
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
        thumbnailUrl: info.thumburl,
        fullImageUrl: pickFullImageUrl(info),
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
