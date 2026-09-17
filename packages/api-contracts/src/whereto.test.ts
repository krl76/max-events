import { describe, expect, it } from "vitest";
import { WheretoQuerySchema, WheretoResponseSchema } from "./whereto.js";
import type { Event } from "./event.js";

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
};

describe("WheretoQuerySchema", () => {
  it("accepts the README example: alone + active + any", () => {
    const query = { company: "alone", mood: "active", budget: "any" };
    expect(WheretoQuerySchema.parse(query)).toEqual(query);
  });

  it("rejects an unknown company context", () => {
    expect(WheretoQuerySchema.safeParse({ company: "coworkers", mood: "calm", budget: "free" }).success).toBe(false);
  });
});

describe("WheretoResponseSchema", () => {
  it("accepts the README example: 5 concrete suggestions", () => {
    const response = { items: Array.from({ length: 5 }, () => event) };
    expect(WheretoResponseSchema.parse(response)).toMatchObject(response);
  });

  it("rejects more than 5 suggestions", () => {
    const response = { items: Array.from({ length: 6 }, () => event) };
    expect(WheretoResponseSchema.safeParse(response).success).toBe(false);
  });
});
