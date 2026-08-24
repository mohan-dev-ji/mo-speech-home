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
 * Widths we ASK the API for. Wikimedia decides what we actually get — see the
 * `iiurlwidth` note below.
 *
 * The grid asks for 320 (tiles render at ~330px) and the save path asks for
 * 640, which matches what Unsplash and Pixabay save and covers the largest a
 * symbol image ever renders (`max-w-[260px]` in PlayModal) on a 2x display.
 * Measured on File:Classical Guitar two views.jpg: ~22 KB vs ~104 KB per
 * image, i.e. ~1.6 MB saved on a 19-result search (MOS-30).
 */
const GRID_WIDTH = 320;
const SAVE_WIDTH = 640;

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
 * So: pass the width we want as `iiurlwidth` and use `thumburl` verbatim.
 *
 * ## Two calls, two widths (MOS-30)
 *
 * `iiurlwidth` is per API call, so one search call can only produce one width.
 * Serving both grid and save from it meant the grid downloaded save-size
 * images (~2 MB per search). Instead:
 *
 *  - `searchWikimedia` asks for `GRID_WIDTH` and returns that `thumburl` as
 *    `thumbnailUrl`. It deliberately does NOT set `fullImageUrl` — a Wikimedia
 *    result carries only its `pageid` (as `providerId`) as the save reference.
 *  - `resolveWikimediaSaveUrl` asks for `SAVE_WIDTH` by `pageid` at selection
 *    time, one extra un-metered call per *selection* (not per search).
 *
 * Both still use the returned `thumburl` verbatim — neither hand-builds a
 * `px-` token. The second call also means the save URL is resolved on the
 * server from an id rather than round-tripped through the client, so the proxy
 * cannot be steered at an arbitrary host for this provider.
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
    iiurlwidth: String(GRID_WIDTH),
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
        // Grid-size URL, straight from the API. No `fullImageUrl`: the save
        // URL is resolved server-side from `providerId` (the pageid) by
        // `resolveWikimediaSaveUrl` — see the note above.
        thumbnailUrl: info.thumburl,
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

/**
 * Resolve the save-size image URL for one Wikimedia result, server-side.
 *
 * Called by `/api/image-search/proxy` when a result is selected. Takes the
 * result's `providerId` (the Commons `pageid`) and asks the API for a
 * `SAVE_WIDTH` thumbnail of that page, returning the `thumburl` verbatim.
 *
 * This is the whole reason the proxy never has to trust a client-supplied URL
 * for this provider: the only thing that crosses the wire is a page id, which
 * is validated as digits here before it goes anywhere near a request, and the
 * URL that comes back is one Wikimedia itself produced.
 *
 * Returns null on a bad id, a failed call, or a page with no usable thumbnail
 * — the caller turns that into a 502.
 */
export async function resolveWikimediaSaveUrl(
  pageId: string
): Promise<string | null> {
  if (!/^\d+$/.test(pageId)) return null;

  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    pageids: pageId,
    prop: "imageinfo",
    iiprop: "url|mime",
    iiurlwidth: String(SAVE_WIDTH),
    origin: "*",
  });

  let res: Response;
  try {
    res = await fetch(`${WIKIMEDIA_API}?${params}`, {
      headers: { "User-Agent": USER_AGENT },
    });
  } catch (err) {
    console.error("[image-providers/wikimedia] save-url fetch failed", err);
    return null;
  }
  if (!res.ok) {
    console.error(
      `[image-providers/wikimedia] save-url API error: ${res.status}`
    );
    return null;
  }

  const json = (await res.json()) as SearchResponse;
  const info = json.query?.pages?.[0]?.imageinfo?.[0];
  // Same image-only guard the grid applies — a pageid that turns out to be a
  // PDF or DjVu scan renders as a thumbnail but is not something we save.
  if (!info?.thumburl) return null;
  if (!info.mime.startsWith("image/")) return null;

  return info.thumburl;
}
