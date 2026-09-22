import { describe, expect, it } from "vitest";
import { MAX_FEED_PHOTO_URL_LENGTH } from "@max-events/api-contracts";
import { FEED_PHOTO_QUALITY_STEPS, FEED_PHOTO_SIDE_STEPS, fitWithin, MAX_PICKED_PHOTO_BYTES, readFeedPhoto, tooLargeToDecode } from "./photo";

describe("fitWithin", () => {
  it("scales a photo down to the longest edge and keeps its shape", () => {
    expect(fitWithin(4000, 3000, 480)).toEqual({ width: 480, height: 360 });
    expect(fitWithin(3000, 4000, 480)).toEqual({ width: 360, height: 480 });
  });

  it("leaves a photo that already fits alone, rather than blowing it up", () => {
    // Upscaling would cost bytes and add nothing: the card cannot show detail that is not there.
    expect(fitWithin(300, 200, 480)).toEqual({ width: 300, height: 200 });
    expect(fitWithin(480, 480, 480)).toEqual({ width: 480, height: 480 });
  });

  it("never rounds a side down to zero", () => {
    expect(fitWithin(10_000, 3, 480)).toEqual({ width: 480, height: 1 });
  });
});

describe("tooLargeToDecode", () => {
  it("refuses a file before it reaches the decoder", async () => {
    // A 100-megapixel file is decoded into memory before any resizing could help, and on a phone
    // that is where the webview dies — so the answer has to come before `new Image()`.
    expect(tooLargeToDecode({ size: MAX_PICKED_PHOTO_BYTES + 1 })).toBe(true);
    expect(tooLargeToDecode({ size: MAX_PICKED_PHOTO_BYTES })).toBe(false);

    // The whole path, without a decoder: an oversized file resolves to null and never touches canvas.
    await expect(readFeedPhoto({ size: MAX_PICKED_PHOTO_BYTES + 1 } as File)).resolves.toBeNull();
  });
});

describe("feed photo budget", () => {
  it("walks down the side, not only the quality", () => {
    // Quality alone bottoms out on a noisy photo; without a smaller side such a photo could never be
    // published at all, whatever the author did.
    expect(FEED_PHOTO_SIDE_STEPS.length).toBeGreaterThan(1);
    expect(FEED_PHOTO_SIDE_STEPS).toEqual([...FEED_PHOTO_SIDE_STEPS].sort((a, b) => b - a));
    expect(FEED_PHOTO_QUALITY_STEPS).toEqual([...FEED_PHOTO_QUALITY_STEPS].sort((a, b) => b - a));
    expect(FEED_PHOTO_QUALITY_STEPS.every((quality) => quality > 0 && quality <= 1)).toBe(true);
  });

  it("keeps a full feed page under a megabyte", () => {
    // The feed answers up to 50 posts at once and a data URL is not cacheable, so the per-photo
    // budget is what bounds the screen: it is paid again on every open.
    expect(MAX_FEED_PHOTO_URL_LENGTH * 50).toBeLessThan(1_000_000);
  });
});
