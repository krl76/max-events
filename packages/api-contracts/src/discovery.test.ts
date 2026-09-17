import { describe, expect, it } from "vitest";
import { DiscoveryResponseSchema } from "./discovery.js";

describe("DiscoveryResponseSchema", () => {
  it("accepts an empty discovery payload", () => {
    expect(DiscoveryResponseSchema.parse({ newPlacesCount: 0, byFriend: [] }).newPlacesCount).toBe(0);
  });
});
