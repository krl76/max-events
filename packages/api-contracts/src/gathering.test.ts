import { describe, expect, it } from "vitest";
import { CreateGatheringSchema, FriendAvailabilitySchema, GatheringResponseWriteSchema, GatheringSchema, InviteeResponseSchema } from "./gathering.js";
import type { Event } from "./event.js";
import type { Friend } from "./friends.js";

const event: Event = {
  id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90",
  title: "Вечерняя пробежка по набережной",
  description: "",
  category: "sport",
  city: "Москва",
  placeId: null,
  startsAt: "2026-09-20T19:00:00+03:00",
  endsAt: null,
  isPaid: false,
  priceRub: null,
  paymentUrl: null,
  capacity: null,
  chatLink: null,
  promoted: false,
  published: true,
  bookingOpensAt: null,
};

const friend: Friend = { id: "018f3c5a-0000-7000-8000-000000000001", name: "Дима", avatarUrl: null };

describe("FriendAvailabilitySchema", () => {
  it("accepts free/busy/unknown availability", () => {
    const item = { friend, availability: "free" };
    expect(FriendAvailabilitySchema.parse(item)).toEqual(item);
  });

  it("rejects an unknown availability value", () => {
    expect(FriendAvailabilitySchema.safeParse({ friend, availability: "maybe" }).success).toBe(false);
  });
});

describe("InviteeResponseSchema", () => {
  it("accepts the README example responses: подтвердил / смотрит / занят", () => {
    expect(InviteeResponseSchema.parse("accepted")).toBe("accepted");
    expect(InviteeResponseSchema.parse("considering")).toBe("considering");
    expect(InviteeResponseSchema.parse("busy")).toBe("busy");
  });

  it("rejects a response outside the enum", () => {
    expect(InviteeResponseSchema.safeParse("declined").success).toBe(false);
  });
});

describe("GatheringSchema", () => {
  it("accepts the README example: Ты + 2 из 5 — Дима подтвердил, Катя смотрит, Андрей занят", () => {
    const invitee = (name: string, response: "accepted" | "considering" | "busy") => ({
      friend: { ...friend, name },
      response,
    });
    const gathering = {
      id: "018f3c5a-0000-7000-8000-000000000010",
      event,
      invitees: [invitee("Дима", "accepted"), invitee("Катя", "considering"), invitee("Андрей", "busy"), invitee("Егор", "accepted"), invitee("Оля", "busy")],
      proposedMeetingAt: "2026-09-20T18:30:00+03:00",
      status: "awaiting_responses",
      createdAt: "2026-09-11T10:00:00+03:00",
      updatedAt: "2026-09-11T12:00:00+03:00",
    };
    expect(GatheringSchema.parse(gathering)).toMatchObject(gathering);
  });

  it("round-trips through JSON", () => {
    const gathering = GatheringSchema.parse({
      id: "018f3c5a-0000-7000-8000-000000000010",
      event,
      invitees: [{ friend, response: "accepted" }],
      proposedMeetingAt: "2026-09-20T18:30:00+03:00",
      status: "confirmed",
      createdAt: "2026-09-11T10:00:00+03:00",
      updatedAt: "2026-09-11T12:00:00+03:00",
    });
    expect(GatheringSchema.parse(JSON.parse(JSON.stringify(gathering)))).toEqual(gathering);
  });

  it("rejects an unknown gathering status", () => {
    expect(
      GatheringSchema.safeParse({
        id: "018f3c5a-0000-7000-8000-000000000010",
        event,
        invitees: [],
        proposedMeetingAt: "2026-09-20T18:30:00+03:00",
        status: "closed",
        createdAt: "2026-09-11T10:00:00+03:00",
        updatedAt: "2026-09-11T12:00:00+03:00",
      }).success,
    ).toBe(false);
  });
});

describe("CreateGatheringSchema", () => {
  it("requires an event, at least one friend, and a timestamp", () => {
    const payload = { eventId: event.id, friendIds: [friend.id], proposedMeetingAt: "2026-09-20T18:30:00+03:00" };
    expect(CreateGatheringSchema.parse(payload)).toEqual(payload);
    expect(CreateGatheringSchema.safeParse({ ...payload, friendIds: [] }).success).toBe(false);
    expect(CreateGatheringSchema.safeParse({ ...payload, proposedMeetingAt: "tonight" }).success).toBe(false);
  });
});

describe("GatheringResponseWriteSchema", () => {
  it("accepts an invitee answer", () => {
    expect(GatheringResponseWriteSchema.parse({ response: "accepted" })).toEqual({ response: "accepted" });
    expect(GatheringResponseWriteSchema.safeParse({ response: "declined" }).success).toBe(false);
  });
});
