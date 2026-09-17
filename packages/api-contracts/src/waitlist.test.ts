import { describe, expect, it } from "vitest";
import { JoinWaitlistWriteSchema, WaitlistEntrySchema } from "./waitlist.js";

const entry = {
  id: "018f3c5a-0000-7000-8000-000000000070",
  userId: "018f3c5a-0000-7000-8000-000000000001",
  eventId: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90",
  position: 1,
  status: "waiting",
  createdAt: "2026-09-12T10:00:00+03:00",
  updatedAt: "2026-09-12T10:00:00+03:00",
};

describe("WaitlistEntrySchema", () => {
  it("defaults offeredUntil to null for a waiting row", () => {
    expect(WaitlistEntrySchema.parse(entry).offeredUntil).toBeNull();
  });

  it("accepts an offered row with a confirmation deadline", () => {
    const parsed = WaitlistEntrySchema.parse({ ...entry, status: "offered", offeredUntil: "2026-09-12T10:15:00+03:00" });
    expect(parsed.status).toBe("offered");
    expect(parsed.offeredUntil).toBe("2026-09-12T10:15:00+03:00");
  });

  it("rejects a non-positive position", () => {
    expect(WaitlistEntrySchema.safeParse({ ...entry, position: 0 }).success).toBe(false);
  });
});

describe("JoinWaitlistWriteSchema", () => {
  it("requires an event id", () => {
    expect(JoinWaitlistWriteSchema.parse({ eventId: entry.eventId })).toEqual({ eventId: entry.eventId });
  });
});
