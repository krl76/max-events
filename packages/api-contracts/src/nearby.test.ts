import { describe, expect, it } from "vitest";
import { NearbyBucketSchema, NearbyTimelineSchema } from "./nearby.js";

describe("NearbyBucketSchema", () => {
  it("covers the four README timeline segments", () => {
    expect(NearbyBucketSchema.options).toEqual(["now", "inAnHour", "evening", "tomorrow"]);
  });
});

describe("NearbyTimelineSchema", () => {
  it("defaults to four empty groups", () => {
    const parsed = NearbyTimelineSchema.parse({ now: [], inAnHour: [], evening: [], tomorrow: [] });
    expect(parsed.now).toEqual([]);
    expect(parsed.tomorrow).toEqual([]);
  });
});
