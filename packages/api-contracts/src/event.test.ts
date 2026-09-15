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
  });

  it("rejects paid event semantics violation: negative price", () => {
    const result = EventSchema.safeParse({ ...validEvent, isPaid: true, priceRub: -100 });
    expect(result.success).toBe(false);
  });
});

describe("CreateEventSchema", () => {
  it("does not require id", () => {
    const { id: _id, ...withoutId } = validEvent;
    expect(CreateEventSchema.safeParse(withoutId).success).toBe(true);
  });
});
