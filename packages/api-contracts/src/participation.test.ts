import { describe, expect, it } from "vitest";
import { ParticipationSchema, ParticipationStatsSchema, ParticipationStatusSchema, ParticipationStatusWriteSchema, SetParticipationStatusSchema } from "./participation.js";

const userId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f";
const eventId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90";

const validParticipation = {
  id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d92",
  userId,
  eventId,
  status: "going",
  createdAt: "2026-09-01T10:00:00+03:00",
  updatedAt: "2026-09-01T10:00:00+03:00",
};

describe("ParticipationStatusSchema", () => {
  it("accepts all 6 statuses from the product spec", () => {
    const statuses = ["wants_to_go", "probably_going", "going", "looking_for_company", "looking_for_travel_buddy", "looking_for_after_event_company"];
    for (const status of statuses) {
      expect(ParticipationStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it("rejects statuses outside the closed enum", () => {
    expect(ParticipationStatusSchema.safeParse("maybe").success).toBe(false);
    expect(ParticipationStatusSchema.safeParse("confirmed").success).toBe(false);
  });
});

describe("ParticipationSchema", () => {
  it("round-trips through JSON without loss", () => {
    const parsed = ParticipationSchema.parse(validParticipation);
    const restored = ParticipationSchema.parse(JSON.parse(JSON.stringify(parsed)));
    expect(restored).toEqual(parsed);
  });

  it("rejects a non-uuid user reference", () => {
    expect(ParticipationSchema.safeParse({ ...validParticipation, userId: "user-1" }).success).toBe(false);
  });
});

describe("SetParticipationStatusSchema", () => {
  it("requires only user, event and status", () => {
    expect(SetParticipationStatusSchema.parse({ userId, eventId, status: "wants_to_go" })).toEqual({
      userId,
      eventId,
      status: "wants_to_go",
    });
  });

  it("rejects a missing status", () => {
    expect(SetParticipationStatusSchema.safeParse({ userId, eventId }).success).toBe(false);
  });
});

describe("ParticipationStatusWriteSchema", () => {
  it("accepts a status-only body", () => {
    expect(ParticipationStatusWriteSchema.parse({ status: "looking_for_company" })).toEqual({ status: "looking_for_company" });
  });

  it("rejects an unknown status", () => {
    expect(ParticipationStatusWriteSchema.safeParse({ status: "confirmed" }).success).toBe(false);
  });
});

describe("ParticipationStatsSchema", () => {
  it("requires a count for every status", () => {
    const stats = {
      counts: {
        wants_to_go: 1,
        probably_going: 0,
        going: 24,
        looking_for_company: 4,
        looking_for_travel_buddy: 0,
        looking_for_after_event_company: 2,
      },
      friendsCount: 0,
      myStatus: "going" as const,
    };
    expect(ParticipationStatsSchema.parse(stats)).toEqual(stats);
    expect(ParticipationStatsSchema.safeParse({ ...stats, myStatus: null }).success).toBe(true);
    expect(ParticipationStatsSchema.safeParse({ ...stats, counts: { going: 1 } }).success).toBe(false);
  });
});
