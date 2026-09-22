import { describe, expect, it } from "vitest";
import { AssistDayResponseSchema, AssistQueryWriteSchema, AssistResponseSchema } from "./assist.js";
import type { Event } from "./event.js";

describe("AssistQueryWriteSchema", () => {
  it("accepts the README NL query and rejects an empty string", () => {
    expect(AssistQueryWriteSchema.parse({ query: "Хочу вечером куда-нибудь, максимум 3000 ₽, с девушкой, желательно музыка" }).query).toContain("вечером");
    expect(AssistQueryWriteSchema.parse({ query: "Сделай нам план на субботу", save: true }).save).toBe(true);
    expect(AssistQueryWriteSchema.safeParse({ query: "" }).success).toBe(false);
  });
});

describe("AssistResponseSchema", () => {
  it("requires a summary and criteria", () => {
    expect(
      AssistResponseSchema.safeParse({
        summary: "Нашел 0 вариантов",
        criteria: { when: "evening", budgetMaxRub: 3000, company: "partner", genre: "music" },
        items: [],
      }).success,
    ).toBe(true);
    expect(AssistResponseSchema.safeParse({ summary: "x", criteria: { when: "night" }, items: [] }).success).toBe(false);
  });
});

describe("AssistDayResponseSchema", () => {
  const event: Event = {
    id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90",
    title: "Вечер джаза",
    description: "",
    category: "afisha",
    city: "Москва",
    placeId: null,
    startsAt: "2026-09-19T19:00:00+03:00",
    endsAt: null,
    isPaid: true,
    priceRub: 1800,
    paymentUrl: "https://example.com/pay",
    capacity: null,
    chatLink: null,
    promoted: false,
    published: true,
    bookingOpensAt: null,
    weather: null,
    coverUrl: null,
  };
  const planCard = {
    plan: {
      id: "018f3c5a-0000-7000-8000-000000000020",
      hostUserId: "018f3c5a-0000-7000-8000-000000000021",
      eventId: event.id,
      participants: [],
      meetingPoint: "Вечер джаза",
      meetingAt: "2026-09-19T19:00:00+03:00",
      createdAt: "2026-09-12T10:00:00+03:00",
      updatedAt: "2026-09-12T10:00:00+03:00",
    },
    event,
    distanceMeters: 0,
  };
  const day = {
    summary: "Собрал день на субботу 2026-09-19: 1 событий",
    date: "2026-09-19",
    stops: [{ at: event.startsAt, event, explanation: "Слот субботнего дня" }],
    planDraft: { eventId: event.id, participantIds: [], meetingPoint: "Вечер джаза", meetingAt: event.startsAt },
  };

  it("parses a saved PlanCard payload", () => {
    expect(AssistDayResponseSchema.parse({ ...day, plan: planCard }).plan?.plan.id).toBe(planCard.plan.id);
  });

  it("rejects a garbage plan payload", () => {
    expect(AssistDayResponseSchema.safeParse({ ...day, plan: { junk: true } }).success).toBe(false);
  });

  it("defaults plan to null when omitted", () => {
    expect(AssistDayResponseSchema.parse(day).plan).toBeNull();
  });
});
