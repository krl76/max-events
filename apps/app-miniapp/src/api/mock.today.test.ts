import { describe, expect, it } from "vitest";
import { TodayResponseSchema } from "@max-events/api-contracts";
import { ApiClient } from "./client";
import { installMockApi, mockEvents, todayPicks } from "./mock";

describe("today mock endpoint", () => {
  it("todayPicks passes the today contract and mirrors the README digest numbers", () => {
    expect(TodayResponseSchema.safeParse(todayPicks())).toMatchObject({ success: true });
    expect(todayPicks().summary).toEqual({ nearbyCount: mockEvents.length, suitableCount: 3, withFriendsCount: 2 });
  });

  it("curated cards exercise all four label kinds and reference existing events", () => {
    const kinds = new Set(todayPicks().cards.flatMap((card) => card.labels.map((label) => label.kind)));
    expect([...kinds].sort()).toEqual(["distance", "free_entry", "friend_attending", "spots_left"]);
    expect(todayPicks().cards.every((card) => mockEvents.includes(card.event))).toBe(true);
  });

  it("serves the digest through the typed client", async () => {
    const restore = installMockApi();
    try {
      expect(await new ApiClient("/api").getToday()).toEqual(todayPicks());
    } finally {
      restore();
    }
  });
});
