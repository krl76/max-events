import { describe, expect, it } from "vitest";
import { CreatePlanSchema, CreatePlanWriteSchema, PlanCardSchema, PlanParticipantWriteSchema, PlanSchema } from "./plan.js";
import type { Event } from "./event.js";
import type { Friend } from "./friends.js";

const event: Event = {
  id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90",
  title: "The Weekend Tribute",
  description: "",
  category: "afisha",
  city: "Москва",
  placeId: null,
  startsAt: "2026-09-20T20:00:00+03:00",
  endsAt: null,
  isPaid: true,
  priceRub: 850,
  paymentUrl: "https://example.com/pay",
  capacity: null,
  chatLink: null,
  promoted: false,
  published: true,
  bookingOpensAt: null,
  weather: null,
};

const friend: Friend = { id: "018f3c5a-0000-7000-8000-000000000001", name: "Дима", avatarUrl: null };

const plan = {
  id: "018f3c5a-0000-7000-8000-000000000020",
  eventId: event.id,
  participants: [
    { friend: { ...friend, name: "Дима" }, status: "confirmed" },
    { friend: { ...friend, name: "Катя" }, status: "confirmed" },
    { friend: { ...friend, name: "Андрей" }, status: "invited" },
  ],
  meetingPoint: "у метро",
  meetingAt: "2026-09-20T18:20:00+03:00",
  createdAt: "2026-09-11T10:00:00+03:00",
  updatedAt: "2026-09-11T12:00:00+03:00",
} as const;

describe("PlanSchema", () => {
  it("accepts a plan with event link, participants, meeting point and time", () => {
    expect(PlanSchema.parse(plan)).toEqual({ ...plan, chatLink: null });
  });

  it("defaults chatLink to null when absent", () => {
    expect(PlanSchema.parse(plan).chatLink).toBeNull();
  });

  it("keeps a provided chatLink", () => {
    expect(PlanSchema.parse({ ...plan, chatLink: "https://max.ru/chat/plan-1" }).chatLink).toBe("https://max.ru/chat/plan-1");
  });

  it("rejects an unknown participant status", () => {
    expect(PlanSchema.safeParse({ ...plan, participants: [{ friend, status: "maybe" }] }).success).toBe(false);
  });

  it("round-trips through JSON", () => {
    const parsed = PlanSchema.parse(plan);
    expect(PlanSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });
});

describe("CreatePlanSchema", () => {
  it("accepts a creation payload without id/timestamps", () => {
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...payload } = plan;
    expect(CreatePlanSchema.parse(payload)).toEqual(payload);
  });

  it("strips an extra id from the payload", () => {
    const parsed = CreatePlanSchema.parse(plan);
    expect(parsed).not.toHaveProperty("id");
  });

  it("strips chatLink from the payload", () => {
    const parsed = CreatePlanSchema.parse({ ...plan, chatLink: "https://max.ru/chat/plan-1" });
    expect(parsed).not.toHaveProperty("chatLink");
  });
});

describe("PlanCardSchema", () => {
  it("accepts the README card: The Weekend Tribute. Ты + 3 друга. Сбор 18:20 у метро. 850 м от тебя", () => {
    const card = { plan, event, distanceMeters: 850 };
    expect(PlanCardSchema.parse(card)).toMatchObject(card);
  });

  it("rejects a negative distance", () => {
    expect(PlanCardSchema.safeParse({ plan, event, distanceMeters: -1 }).success).toBe(false);
  });
});

describe("CreatePlanWriteSchema", () => {
  it("accepts event, meeting and optional participant ids", () => {
    const payload = { eventId: event.id, participantIds: [friend.id], meetingPoint: "у метро", meetingAt: plan.meetingAt };
    expect(CreatePlanWriteSchema.parse(payload)).toEqual(payload);
    expect(CreatePlanWriteSchema.parse({ eventId: event.id, meetingPoint: "у метро", meetingAt: plan.meetingAt }).participantIds).toEqual([]);
  });
});

describe("PlanParticipantWriteSchema", () => {
  it("accepts confirmed or declined", () => {
    expect(PlanParticipantWriteSchema.parse({ status: "declined" })).toEqual({ status: "declined" });
    expect(PlanParticipantWriteSchema.safeParse({ status: "invited" }).success).toBe(false);
  });
});
