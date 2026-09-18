import { describe, expect, it } from "vitest";
import { EventFriendsSummarySchema, FriendActivityByEventSchema, FriendActivityByFriendSchema, FriendActivitySchema, FriendSchema } from "./friends.js";
import type { Event } from "./event.js";

const friend = {
  id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f",
  name: "Анна",
  avatarUrl: null,
};

const event: Event = {
  id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90",
  title: "Выставка современного искусства",
  description: "",
  category: "afisha",
  city: "Москва",
  placeId: null,
  startsAt: "2026-09-20T18:00:00+03:00",
  endsAt: null,
  isPaid: false,
  priceRub: null,
  paymentUrl: null,
  capacity: null,
  chatLink: null,
  promoted: false,
};

describe("FriendSchema", () => {
  it("accepts a friend with a nullable avatar", () => {
    expect(FriendSchema.parse(friend)).toEqual(friend);
  });

  it("rejects an empty name", () => {
    expect(FriendSchema.safeParse({ ...friend, name: "" }).success).toBe(false);
  });
});

describe("FriendActivitySchema", () => {
  it("links a friend to an event with a participation status", () => {
    const activity = { friend, event, participationStatus: "going" };
    expect(FriendActivitySchema.parse(activity)).toMatchObject(activity);
  });

  it("rejects a status outside the participation enum", () => {
    expect(FriendActivitySchema.safeParse({ friend, event, participationStatus: "confirmed" }).success).toBe(false);
  });
});

describe("grouped feed schemas", () => {
  it("groups by friend: friend with their events", () => {
    const byFriend = {
      friend,
      events: [{ event, participationStatus: "wants_to_go" }],
    };
    expect(FriendActivityByFriendSchema.parse(byFriend)).toMatchObject(byFriend);
  });

  it("groups by event: event with attending friends", () => {
    const byEvent = {
      event,
      friends: [{ friend, participationStatus: "looking_for_company" }],
    };
    expect(FriendActivityByEventSchema.parse(byEvent)).toMatchObject(byEvent);
  });
});

describe("EventFriendsSummarySchema", () => {
  it("counts going and looking_for_company separately from the friends list", () => {
    const summary = {
      friends: [{ friend, participationStatus: "looking_for_company" as const }],
      going: 0,
      lookingForCompany: 1,
    };
    expect(EventFriendsSummarySchema.parse(summary)).toMatchObject(summary);
    expect(EventFriendsSummarySchema.safeParse({ friends: [], going: -1, lookingForCompany: 0 }).success).toBe(false);
  });
});
