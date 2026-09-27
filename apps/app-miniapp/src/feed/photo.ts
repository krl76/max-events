// START_MODULE_CONTRACT
// PURPOSE: Turn a picked photo into a JPEG data URL sharp enough for the feed, then small enough to upload.
// SCOPE: fitWithin sizes the canvas; tooLargeToDecode rejects a file before it reaches the decoder; readFeedPhoto draws the file into the canvas and walks down the side and the JPEG quality until the result fits UPLOAD_PHOTO_BUDGET, answering null when nothing fits. The post itself stores the short URL from POST /uploads, not this data URL.
// DEPENDS: @max-events/api-contracts (MAX_FEED_PHOTO_URL_LENGTH), browser canvas
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - FEED_PHOTO_SIDE_STEPS - longest edges tried, largest first
// - FEED_PHOTO_QUALITY_STEPS - JPEG qualities tried per side, largest first
// - MAX_PICKED_PHOTO_BYTES - largest file the decoder is allowed to open
// - fitWithin - scale a size down to the longest edge, never up
// - tooLargeToDecode - whether a picked file must be refused before decoding
// - readFeedPhoto - picked file to a data URL that fits the contract, or null when it cannot
// END_MODULE_MAP

/**
 * A phone feed is about 400 CSS px wide, and a 3x screen wants roughly 1200 px. 1600 keeps faces
 * sharp; the smaller steps are what a noisy photo falls back to instead of being refused.
 */
export const FEED_PHOTO_SIDE_STEPS = [1600, 1280, 960];

export const FEED_PHOTO_QUALITY_STEPS = [0.86, 0.78, 0.68];

/** The upload body can carry this. The post row then stores only the short /uploads URL. */
const UPLOAD_PHOTO_BUDGET = 1_500_000;

/** Above this a phone would decode a 100-megapixel file into memory before any resizing could help. */
export const MAX_PICKED_PHOTO_BYTES = 25 * 1024 * 1024;

export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide || longest === 0) return { width, height };
  const scale = maxSide / longest;
  // Never zero: a sliver of a photo is still a photo.
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function tooLargeToDecode(file: { size: number }): boolean {
  return file.size > MAX_PICKED_PHOTO_BYTES;
}

function drawToDataUrl(image: HTMLImageElement, maxSide: number, quality: number): string | null {
  const size = fitWithin(image.naturalWidth, image.naturalHeight, maxSide);
  // A zero-sized canvas answers "data:," — a valid URL that renders as a broken image forever.
  if (size.width <= 0 || size.height <= 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(image, 0, 0, size.width, size.height);
  // JPEG, not the original type: a screenshot arrives as PNG and would not shrink below the budget.
  return canvas.toDataURL("image/jpeg", quality);
}

function encodeWithinBudget(image: HTMLImageElement): string | null {
  for (const maxSide of FEED_PHOTO_SIDE_STEPS) {
    for (const quality of FEED_PHOTO_QUALITY_STEPS) {
      const dataUrl = drawToDataUrl(image, maxSide, quality);
      if (dataUrl === null) return null;
      if (dataUrl.length <= UPLOAD_PHOTO_BUDGET) return dataUrl;
    }
  }
  return null;
}

/**
 * null means "this photo cannot be sent" — the caller says so instead of posting a photo the backend
 * would reject with a 400 and instead of silently dropping it from the post.
 */
export function readFeedPhoto(file: File): Promise<string | null> {
  if (tooLargeToDecode(file)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    const finish = (result: string | null) => {
      URL.revokeObjectURL(objectUrl);
      resolve(result);
    };
    image.onload = () => finish(encodeWithinBudget(image));
    image.onerror = () => finish(null);
    image.src = objectUrl;
  });
}
