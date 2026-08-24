export type ImageProvider = "wikimedia" | "pixabay" | "unsplash" | "pexels";

export type ImageSearchResult = {
  providerId: string;
  provider: ImageProvider;
  title: string;
  thumbnailUrl: string;
  /**
   * Save-size URL, when the provider can hand one over at search time.
   *
   * Omitted by `wikimedia`, whose save URL needs a second API call at a
   * different `iiurlwidth` and is resolved server-side from `providerId` by
   * the proxy instead (MOS-30). Providers that omit it MUST have a resolution
   * path in `/api/image-search/proxy` — the proxy rejects a selection it can
   * neither resolve nor read a URL for.
   */
  fullImageUrl?: string;
  sourceUrl: string;
  attribution: string;
  license: string;
  width: number;
  height: number;
  mime: string;
};

export type ProviderSearchFn = (
  query: string,
  page: number,
) => Promise<ImageSearchResult[]>;
