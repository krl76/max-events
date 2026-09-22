// START_MODULE_CONTRACT
// PURPOSE: Turn a picked photo into a data URL small enough to travel inside a feed post.
// SCOPE: fitWithin sizes the canvas; tooLargeToDecode rejects a file before it reaches the decoder; readFeedPhoto draws the file into the canvas and walks down the side and the JPEG quality until the result fits MAX_FEED_PHOTO_URL_LENGTH, answering null when nothing fits. Until object storage lands (#477) the photo rides inside the request body and inside every feed response, so the budget is small on purpose.
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

import { MAX_FEED_PHOTO_URL_LENGTH } from "@max-events/api-contracts";

/**
 * A 4:5 card is ~400 CSS px wide on a phone. 480 keeps it honest; the smaller steps are what a noisy
 * photo falls back to instead of being refused — a slightly softer picture beats no picture.
 */
export const FEED_PHOTO_SIDE_STEPS = [480, 360, 280];

export const FEED_PHOTO_QUALITY_STEPS = [0.7, 0.55, 0.4];

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
      if (dataUrl.length <= MAX_FEED_PHOTO_URL_LENGTH) return dataUrl;
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
