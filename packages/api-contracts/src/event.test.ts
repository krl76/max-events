import { describe, expect, it } from "vitest";
import { CreateEventSchema, EventSchema } from "./event.js";

const validEvent = {
  id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f",
  title: "Джаз в парке",
  category: "afisha",
  city: "Москва",
  startsAt: "2026-09-12T19:00:00+03:00",
};

describe("EventSchema", () => {
  it("accepts a minimal valid event and applies defaults", () => {
    const parsed = EventSchema.parse(validEvent);
    expect(parsed.isPaid).toBe(false);
    expect(parsed.capacity).toBeNull();
    expect(parsed.chatLink).toBeNull();
    expect(parsed.published).toBe(true);
    expect(parsed.bookingOpensAt).toBeNull();
    expect(parsed.coverUrl).toBeNull();
  });

  it("accepts catalog card extras", () => {
    const parsed = EventSchema.parse({
      ...validEvent,
      organizerName: "Парк Горького",
      ratingAverage: 4.9,
      waitlistCount: 7,
      distanceKm: 2.1,
      friendsGoing: [{ id: "018f3c5a-0000-7000-8000-0000000000b1", name: "Анна" }],
    });
    expect(parsed.organizerName).toBe("Парк Горького");
    expect(parsed.ratingAverage).toBe(4.9);
    expect(parsed.waitlistCount).toBe(7);
    expect(parsed.distanceKm).toBe(2.1);
    expect(parsed.friendsGoing).toEqual([{ id: "018f3c5a-0000-7000-8000-0000000000b1", name: "Анна" }]);
  });

  it("parses bookingOpensAt as ISO timestamp or null", () => {
    expect(EventSchema.parse({ ...validEvent, bookingOpensAt: "2026-09-20T09:00:00+03:00" }).bookingOpensAt).toBe("2026-09-20T09:00:00+03:00");
    expect(EventSchema.parse({ ...validEvent, bookingOpensAt: null }).bookingOpensAt).toBeNull();
    expect(EventSchema.safeParse({ ...validEvent, bookingOpensAt: "soon" }).success).toBe(false);
  });

  it("keeps an explicit published flag", () => {
    expect(EventSchema.parse({ ...validEvent, published: false }).published).toBe(false);
    expect(EventSchema.parse({ ...validEvent, published: true }).published).toBe(true);
  });

  it("rejects paid event semantics violation: negative price", () => {
    const result = EventSchema.safeParse({ ...validEvent, isPaid: true, priceRub: -100 });
    expect(result.success).toBe(false);
  });

  it("requires paymentUrl for paid events", () => {
    const parsed = EventSchema.parse({
      ...validEvent,
      isPaid: true,
      priceRub: 1500,
      paymentUrl: "https://organizer.example.com/pay",
    });
    expect(parsed.paymentUrl).toBe("https://organizer.example.com/pay");
    expect(EventSchema.safeParse({ ...validEvent, isPaid: true }).success).toBe(false);
  });

  it("rejects paymentUrl on free events", () => {
    expect(EventSchema.safeParse({ ...validEvent, isPaid: false, paymentUrl: "https://organizer.example.com/pay" }).success).toBe(false);
  });

  it("defaults weather to null when the server omits it", () => {
    expect(EventSchema.parse(validEvent).weather).toBeNull();
  });

  it("round-trips a forecast snapshot", () => {
    const weather = { temperatureC: 12.4, condition: "облачно", conditionCode: 2, precipitationProbability: 40 };
    expect(EventSchema.parse({ ...validEvent, weather }).weather).toEqual(weather);
  });

  it("rejects precipitationProbability outside 0..100", () => {
    const weather = { temperatureC: 12, condition: "ясно", conditionCode: 0, precipitationProbability: 101 };
    expect(EventSchema.safeParse({ ...validEvent, weather }).success).toBe(false);
  });
});

describe("CreateEventSchema", () => {
  it("does not require id", () => {
    const { id: _id, ...withoutId } = validEvent;
    expect(CreateEventSchema.safeParse(withoutId).success).toBe(true);
  });

  it("strips the server-owned published flag", () => {
    const { id: _id, ...withoutId } = validEvent;
    const parsed = CreateEventSchema.parse({ ...withoutId, published: false });
    expect("published" in parsed).toBe(false);
  });

  it("strips the organizer-owned bookingOpensAt window", () => {
    const { id: _id, ...withoutId } = validEvent;
    const parsed = CreateEventSchema.parse({ ...withoutId, bookingOpensAt: "2026-09-20T09:00:00+03:00" });
    expect("bookingOpensAt" in parsed).toBe(false);
  });

  it("strips server-owned weather", () => {
    const { id: _id, ...withoutId } = validEvent;
    const parsed = CreateEventSchema.parse({
      ...withoutId,
      weather: { temperatureC: 12, condition: "ясно", conditionCode: 0, precipitationProbability: 0 },
    });
    expect("weather" in parsed).toBe(false);
  });

  it("keeps the paid/free payment link invariant", () => {
    const { id: _id, ...withoutId } = validEvent;
    expect(
      CreateEventSchema.safeParse({
        ...withoutId,
        isPaid: true,
        paymentUrl: "https://organizer.example.com/pay",
      }).success,
    ).toBe(true);
    expect(CreateEventSchema.safeParse({ ...withoutId, isPaid: true }).success).toBe(false);
  });
});
