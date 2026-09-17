import { describe, expect, it } from "vitest";
import { CreateSubscriptionSchema, SubscriptionSchema } from "./subscription.js";

const base = {
  id: "018f3c5a-0000-7000-8000-000000000040",
  userId: "018f3c5a-0000-7000-8000-000000000001",
  createdAt: "2026-09-11T10:00:00+03:00",
};

describe("SubscriptionSchema", () => {
  it("accepts organizer, place and interest targets", () => {
    expect(
      SubscriptionSchema.parse({
        ...base,
        type: "organizer",
        organizerUserId: "018f3c5a-0000-7000-8000-000000000002",
        placeId: null,
        interest: null,
      }).type,
    ).toBe("organizer");
    expect(SubscriptionSchema.parse({ ...base, type: "place", organizerUserId: null, placeId: "018f3c5a-0000-7000-8000-000000000003", interest: null }).type).toBe("place");
    expect(SubscriptionSchema.parse({ ...base, type: "interest", organizerUserId: null, placeId: null, interest: "электронная музыка" }).interest).toBe("электронная музыка");
  });

  it("rejects a type/target mismatch", () => {
    expect(SubscriptionSchema.safeParse({ ...base, type: "place", organizerUserId: "018f3c5a-0000-7000-8000-000000000002", placeId: null, interest: null }).success).toBe(false);
  });
});

describe("CreateSubscriptionSchema", () => {
  it("accepts a discriminated write payload", () => {
    expect(CreateSubscriptionSchema.parse({ type: "place", placeId: "018f3c5a-0000-7000-8000-000000000003" })).toEqual({
      type: "place",
      placeId: "018f3c5a-0000-7000-8000-000000000003",
    });
    expect(CreateSubscriptionSchema.parse({ type: "interest", interest: "походы" })).toEqual({ type: "interest", interest: "походы" });
    expect(CreateSubscriptionSchema.safeParse({ type: "place", interest: "походы" }).success).toBe(false);
  });
});
