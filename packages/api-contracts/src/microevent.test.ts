import { describe, expect, it } from "vitest";
import { MicroEventSchema } from "./microevent.js";

const microEvent = {
  id: "018f3c5a-0000-7000-8000-000000000060",
  authorId: "018f3c5a-0000-7000-8000-000000000001",
  title: "Играем в баскетбол",
  startsAt: "2026-09-11T19:00:00+03:00",
  locationText: "Площадка у ВДНХ",
  placeId: null,
  participantsLimit: 6,
  participantsCount: 3,
  participantIds: ["018f3c5a-0000-7000-8000-000000000001", "018f3c5a-0000-7000-8000-000000000002", "018f3c5a-0000-7000-8000-000000000003"],
  status: "open",
  createdAt: "2026-09-11T18:00:00+03:00",
} as const;

describe("MicroEventSchema", () => {
  it("accepts the README example: «Играем в баскетбол сегодня в 19:00 — сейчас 3/6 человек»", () => {
    expect(MicroEventSchema.parse(microEvent)).toEqual(microEvent);
  });

  it("accepts a placeId instead of location text", () => {
    const withPlace = { ...microEvent, locationText: null, placeId: "018f3c5a-0000-7000-8000-000000000099" };
    expect(MicroEventSchema.parse(withPlace)).toEqual(withPlace);
  });

  it("rejects an event with neither location text nor placeId", () => {
    expect(MicroEventSchema.safeParse({ ...microEvent, locationText: null }).success).toBe(false);
  });

  it("rejects an event with both location text and placeId", () => {
    expect(MicroEventSchema.safeParse({ ...microEvent, placeId: "018f3c5a-0000-7000-8000-000000000099" }).success).toBe(false);
  });

  it("rejects more participants than the limit", () => {
    expect(MicroEventSchema.safeParse({ ...microEvent, participantsCount: 7 }).success).toBe(false);
  });

  it("defaults participantsCount to zero", () => {
    const fresh = { ...microEvent, participantsCount: undefined, participantIds: undefined };
    expect(MicroEventSchema.parse(fresh).participantsCount).toBe(0);
    expect(MicroEventSchema.parse(fresh).participantIds).toEqual([]);
  });

  it("rejects a participant list that disagrees with the count", () => {
    expect(MicroEventSchema.safeParse({ ...microEvent, participantIds: ["018f3c5a-0000-7000-8000-000000000001"] }).success).toBe(false);
  });

  it("rejects a participant id that is not a uuid", () => {
    expect(MicroEventSchema.safeParse({ ...microEvent, participantIds: ["me", "you", "them"] }).success).toBe(false);
  });

  it("round-trips through JSON", () => {
    const parsed = MicroEventSchema.parse(microEvent);
    expect(MicroEventSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });
});
