import { describe, expect, it } from "vitest";
import { DiscoveryResponseSchema, FriendPlaceVisitSchema } from "./discovery.js";

describe("DiscoveryResponseSchema", () => {
  it("accepts an empty discovery payload", () => {
    expect(DiscoveryResponseSchema.parse({ newPlacesCount: 0, byFriend: [] }).newPlacesCount).toBe(0);
  });
});

describe("FriendPlaceVisitSchema", () => {
  const place = { id: "00000000-0000-4000-8000-000000000011", title: "Парк", address: "Крымский Вал, 9", city: "Москва", category: "park", latitude: 55.73, longitude: 37.6, published: true, createdAt: "2026-09-01T10:00:00+03:00", updatedAt: "2026-09-01T10:00:00+03:00" };
  const friend = { id: "00000000-0000-4000-8000-000000000002", name: "Анна", avatarUrl: null };

  it("wants at least one friend behind a marker", () => {
    expect(FriendPlaceVisitSchema.safeParse({ place, friends: [friend], lastVisitAt: "2026-09-16T20:00:00+03:00" }).success).toBe(true);
    // A place nobody was at has no business being on the layer.
    expect(FriendPlaceVisitSchema.safeParse({ place, friends: [], lastVisitAt: "2026-09-16T20:00:00+03:00" }).success).toBe(false);
    expect(FriendPlaceVisitSchema.safeParse({ place, friends: [friend], lastVisitAt: "вчера" }).success).toBe(false);
  });
});
