import { describe, expect, it } from "vitest";
import { TodayResponseSchema } from "./today.js";
import type { Event } from "./event.js";

const event: Event = {
  id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90",
  title: "Лекция о современной архитектуре",
  description: "",
  category: "afisha",
  city: "Москва",
  placeId: null,
  startsAt: "2026-09-11T19:00:00+03:00",
  endsAt: null,
  isPaid: false,
  priceRub: null,
  paymentUrl: null,
  capacity: 20,
};

describe("TodayResponseSchema", () => {
  it("accepts the README example: summary plus card with all label kinds", () => {
    const response = {
      summary: { nearbyCount: 12, suitableCount: 3, withFriendsCount: 2 },
      cards: [
        {
          event,
          labels: [{ kind: "distance", minutes: 10 }, { kind: "friend_attending", friendName: "Анна" }, { kind: "free_entry" }, { kind: "spots_left", count: 12 }],
        },
      ],
    };
    expect(TodayResponseSchema.parse(response)).toMatchObject(response);
  });

  it("rejects a free-text label without a known kind", () => {
    const response = {
      summary: { nearbyCount: 1, suitableCount: 1, withFriendsCount: 0 },
      cards: [{ event, labels: [{ text: "10 минут от тебя" }] }],
    };
    expect(TodayResponseSchema.safeParse(response).success).toBe(false);
  });

  it("rejects a distance label without minutes", () => {
    const response = {
      summary: { nearbyCount: 1, suitableCount: 1, withFriendsCount: 0 },
      cards: [{ event, labels: [{ kind: "distance" }] }],
    };
    expect(TodayResponseSchema.safeParse(response).success).toBe(false);
  });
});
