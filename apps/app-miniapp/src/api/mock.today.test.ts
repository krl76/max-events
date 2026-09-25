import { describe, expect, it } from "vitest";
import { TodayResponseSchema } from "@max-events/api-contracts";
import { ApiClient } from "./client";
import { installMockApi, mockEvents, todayPicks } from "./mock";

describe("today mock endpoint", () => {
  it("todayPicks passes the today contract and mirrors the README digest numbers", () => {
    expect(TodayResponseSchema.safeParse(todayPicks())).toMatchObject({ success: true });
    expect(todayPicks().summary).toEqual({ nearbyCount: mockEvents.length, suitableCount: 4, withFriendsCount: 2 });
  });

  it("curated cards exercise all five label kinds and reference existing events", () => {
    const kinds = new Set(todayPicks().cards.flatMap((card) => card.labels.map((label) => label.kind)));
    expect([...kinds].sort()).toEqual(["after_me", "distance", "free_entry", "friend_attending", "spots_left"]);
    expect(todayPicks().cards.every((card) => mockEvents.includes(card.event))).toBe(true);
  });

  it("carries exactly one after_me hint, so the screen never has to pick between two", () => {
    expect(todayPicks().cards.filter((card) => card.labels.some((label) => label.kind === "after_me"))).toHaveLength(1);
  });

  it("enriches every card with the venue line and measures a distance wherever the event has a place", () => {
    for (const card of todayPicks().cards) {
      expect(card.distanceKm === null).toBe(card.event.placeId === null);
      expect(card.placeTitle === null).toBe(card.event.placeId === null);
    }
  });

  it("serves the digest through the typed client", async () => {
    const restore = installMockApi();
    try {
      expect(await new ApiClient("/api").getToday()).toEqual(todayPicks());
    } finally {
      restore();
    }
  });

  it("tolerates the origin query the live client sends", async () => {
    const restore = installMockApi();
    try {
      expect(await new ApiClient("/api").getToday({ latitude: 55.7522, longitude: 37.6156 })).toEqual(todayPicks());
    } finally {
      restore();
    }
  });
});
