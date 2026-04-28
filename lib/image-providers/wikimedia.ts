/**
 * Wikimedia Commons image search provider.
 *
 * Public MediaWiki API — no key, no auth. Server-rendered thumbnails via
 * `iiurlwidth` mean we never resize locally.
 *
 * Etiquette: send a descriptive User-Agent per
 * https://meta.wikimedia.org/wiki/User-Agent_policy
 */

const WIKIMEDIA_API = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT =
  "mo-speech (https://mospeech.com; support@mospeech.com)";
const PAGE_SIZE = 20;

export type WikimediaResult = {
  pageId: number;
  title: string;
  thumbnailUrl: string;
  sourceUrl: string;
  attribution: string;
  license: string;
  width: number;
  height: number;
  mime: string;
  provider: "wikimedia";
};

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
 * Search Wikimedia Commons. Returns up to 20 results per page; SVG results
 * are filtered out (mostly diagrams/logos, low value for AAC).
 */
export async function searchWikimedia(
  query: string,
  page = 0
): Promise<WikimediaResult[]> {
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
    iiurlwidth: "320", // grid thumbnail size — standard cached width
    origin: "*",
  });

  const res = await fetch(`${WIKIMEDIA_API}?${params}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`Wikimedia API error: ${res.status}`);
  }

  const json = (await res.json()) as SearchResponse;
  const pages = json.query?.pages ?? [];

  return pages
    .map((p): WikimediaResult | null => {
      const info = p.imageinfo?.[0];
      if (!info) return null;
      if (info.mime === "image/svg+xml") return null;
      if (!info.thumburl) return null;

      return {
        pageId: p.pageid,
        title: p.title,
        thumbnailUrl: info.thumburl,
        sourceUrl: info.descriptionurl,
        attribution: readMeta(info.extmetadata, "Artist") || "Unknown",
        license: readMeta(info.extmetadata, "LicenseShortName") || "Unknown",
        width: info.width,
        height: info.height,
        mime: info.mime,
        provider: "wikimedia",
      };
    })
    .filter((r): r is WikimediaResult => r !== null);
}

/**
 * Resolve a single file's full image URL at a given width via a second
 * imageinfo call. Used by the proxy route to fetch the bytes we save to R2.
 */
export async function getWikimediaFullImage(
  pageId: number,
  width = 640
): Promise<{ url: string; mime: string }> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    pageids: String(pageId),
    prop: "imageinfo",
    iiprop: "url|mime",
    iiurlwidth: String(width),
    origin: "*",
  });

  const res = await fetch(`${WIKIMEDIA_API}?${params}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`Wikimedia API error: ${res.status}`);
  }

  const json = (await res.json()) as SearchResponse;
  const info = json.query?.pages?.[0]?.imageinfo?.[0];
  if (!info?.thumburl) {
    throw new Error(`Wikimedia: no thumbnail for pageId ${pageId}`);
  }

  return { url: info.thumburl, mime: info.mime };
}
