import { describe, expect, it } from "vitest";
import { BookingSchema, CreateBookingSchema } from "./booking.js";

const userId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f";
const eventId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90";

const validBooking = {
  id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d91",
  userId,
  eventId,
  createdAt: "2026-09-01T10:00:00+03:00",
  updatedAt: "2026-09-01T10:00:00+03:00",
};

describe("BookingSchema", () => {
  it("defaults status to active", () => {
    const parsed = BookingSchema.parse(validBooking);
    expect(parsed.status).toBe("active");
  });

  it("accepts the cancelled status", () => {
    const parsed = BookingSchema.parse({ ...validBooking, status: "cancelled" });
    expect(parsed.status).toBe("cancelled");
  });

  it("rejects statuses outside the closed enum", () => {
    expect(BookingSchema.safeParse({ ...validBooking, status: "confirmed" }).success).toBe(false);
  });
});

describe("CreateBookingSchema", () => {
  it("requires only user and event", () => {
    expect(CreateBookingSchema.parse({ userId, eventId })).toEqual({ userId, eventId });
  });

  it("rejects a non-uuid event reference", () => {
    expect(CreateBookingSchema.safeParse({ userId, eventId: "event-1" }).success).toBe(false);
  });
});
