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
});

describe("CreateEventSchema", () => {
  it("does not require id", () => {
    const { id: _id, ...withoutId } = validEvent;
    expect(CreateEventSchema.safeParse(withoutId).success).toBe(true);
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
