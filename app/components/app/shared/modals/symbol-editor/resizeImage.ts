/**
 * Shared image-resize helper for the three symbol-image sources (Upload,
 * AI Generate, Image Search). Scales the longest edge down to `maxEdge`
 * (never up) and re-encodes to webp, which is where most of the size win
 * comes from even when no scaling is needed (e.g. Image Search JPEGs).
 *
 * Uncompressed AI Generate PNGs (1024x1024, ~880KB) and Image Search JPEGs
 * (66KB) were previously handed to R2 untouched — only the Upload tab
 * resized. This brings all three tabs to the same ~17KB-class webp output
 * that Upload already produced.
 */
export async function toResizedWebp(
  source: Blob,
  maxEdge = 512,
  quality = 0.85
): Promise<Blob> {
  const objectUrl = URL.createObjectURL(source);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image for resizing"));
      img.src = objectUrl;
    });

    let w = img.width;
    let h = img.height;
    if (w > maxEdge || h > maxEdge) {
      if (w > h) {
        h = Math.round((h * maxEdge) / w);
        w = maxEdge;
      } else {
        w = Math.round((w * maxEdge) / h);
        h = maxEdge;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", quality);
    });
    if (!blob) throw new Error("Failed to encode resized image");
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
