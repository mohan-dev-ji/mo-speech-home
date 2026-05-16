export type ImageProvider = "wikimedia" | "pixabay" | "unsplash" | "pexels";

export type ImageSearchResult = {
  providerId: string;
  provider: ImageProvider;
  title: string;
  thumbnailUrl: string;
  fullImageUrl: string;
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
