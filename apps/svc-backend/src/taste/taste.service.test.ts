import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { PlaceEntity } from "../places/place.entity";
import { ReviewEntity } from "../reviews/review.entity";
import { ProfileEntity } from "../users/profile.entity";
import { buildTasteGraph, formatAfterMeExplanation, strongestAfterMe, TasteService } from "./taste.service";

const now = new Date("2026-09-12T10:00:00Z");
const userId = "00000000-0000-4000-8000-00000000000a";
const jazzId = "00000000-0000-4000-8000-0000000000e1";
const runId = "00000000-0000-4000-8000-0000000000e2";
const nextId = "00000000-0000-4000-8000-0000000000e3";
const parkId = "00000000-0000-4000-8000-0000000000p1";

function inValues(value: unknown): unknown[] | undefined {
  if (value && typeof value === "object" && Array.isArray((value as { _value?: unknown })._value)) return (value as { _value: unknown[] })._value;
  return undefined;
}

function matchesWhere(row: object, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, value]) => {
    const cell = (row as Record<string, unknown>)[key];
    const values = inValues(value);
    if (values) return values.includes(cell);
    if (value && typeof value === "object" && "_value" in value) {
      const bound = (value as { _value: Date })._value;
      if (bound instanceof Date && cell instanceof Date) return cell.getTime() >= bound.getTime();
      return true;
    }
    return cell === value;
  });
}

function createStoreRepo<T extends object>(initial: T[] = []) {
  const store = [...initial];
  return {
    store,
    find: async (opts: { where?: Record<string, unknown> } = {}) => store.filter((row) => matchesWhere(row as object, opts.where ?? {})),
    findOneBy: async (where: Record<string, unknown>) => store.find((row) => matchesWhere(row as object, where)) ?? null,
  };
}

describe("buildTasteGraph and strongestAfterMe", () => {
  it("weights visits, reviews and afisha→sport transitions", () => {
    const jazz = { id: jazzId, category: "afisha", placeId: parkId } as EventEntity;
    const run = { id: runId, category: "sport", placeId: parkId } as EventEntity;
    const park = { id: parkId, category: "park" } as PlaceEntity;
    const checkIns = [
      { id: "c1", userId, eventId: jazzId, placeId: null, checkedInAt: new Date("2026-09-01T10:00:00Z") },
      { id: "c2", userId, eventId: jazzId, placeId: null, checkedInAt: new Date("2026-09-02T10:00:00Z") },
      { id: "c3", userId, eventId: jazzId, placeId: null, checkedInAt: new Date("2026-09-03T10:00:00Z") },
      { id: "c4", userId, eventId: runId, placeId: null, checkedInAt: new Date("2026-09-04T10:00:00Z") },
    ] as CheckInEntity[];
    const reviews = [{ id: "r1", userId, eventId: jazzId, stars: 5, wouldGoAgain: true } as ReviewEntity];
    const graph = buildTasteGraph(
      checkIns,
      new Map([
        [jazzId, jazz],
        [runId, run],
      ]),
      new Map([[parkId, park]]),
      reviews,
    );
    expect(graph.eventWeights.get("afisha")).toBe(4.5);
    expect(graph.eventWeights.get("sport")).toBe(1);
    expect(graph.transitions.get("afisha>sport")).toBe(1);
    const after = strongestAfterMe(graph);
    expect(after).toMatchObject({ fromCategory: "afisha", toCategory: "sport", afterCount: 5 });
    expect(formatAfterMeExplanation(3, "afisha", "sport")).toContain("афиша");
    expect(formatAfterMeExplanation(3, "afisha", "sport")).toContain("спорт");
  });
});

describe("TasteService", () => {
  it("returns after-me upcoming events in the follow-on category", async () => {
    const checkIns = createStoreRepo<CheckInEntity>([{ id: "c1", userId, eventId: jazzId, placeId: null, checkedInAt: new Date("2026-09-01T10:00:00Z") } as CheckInEntity, { id: "c2", userId, eventId: runId, placeId: null, checkedInAt: new Date("2026-09-04T10:00:00Z") } as CheckInEntity]);
    const events = createStoreRepo<EventEntity>([
      { id: jazzId, category: "afisha", placeId: null, published: true, startsAt: new Date("2026-08-01T10:00:00Z") } as EventEntity,
      { id: runId, category: "sport", placeId: null, published: true, startsAt: new Date("2026-08-02T10:00:00Z") } as EventEntity,
      {
        id: nextId,
        title: "Забег",
        description: "",
        category: "sport",
        city: "Москва",
        placeId: null,
        startsAt: new Date("2026-09-20T10:00:00Z"),
        endsAt: null,
        isPaid: false,
        priceRub: null,
        paymentUrl: null,
        capacity: null,
        bookedCount: 0,
        published: true,
        chatLink: null,
        chatSyncPending: false,
        createdAt: now,
        updatedAt: now,
      } as EventEntity,
      {
        id: "00000000-0000-4000-8000-0000000000e4",
        title: "Казань",
        description: "",
        category: "sport",
        city: "Казань",
        placeId: null,
        startsAt: new Date("2026-09-19T10:00:00Z"),
        endsAt: null,
        isPaid: false,
        priceRub: null,
        paymentUrl: null,
        capacity: null,
        bookedCount: 0,
        published: true,
        chatLink: null,
        chatSyncPending: false,
        createdAt: now,
        updatedAt: now,
      } as EventEntity,
    ]);
    const profiles = createStoreRepo<ProfileEntity>([{ userId, city: "Москва", interests: [] } as unknown as ProfileEntity]);
    const service = new TasteService(checkIns as unknown as Repository<CheckInEntity>, events as unknown as Repository<EventEntity>, createStoreRepo<PlaceEntity>() as unknown as Repository<PlaceEntity>, createStoreRepo<ReviewEntity>() as unknown as Repository<ReviewEntity>, profiles as unknown as Repository<ProfileEntity>);
    const profile = await service.profile(userId, now);
    expect(profile.eventCategories.some((row) => row.category === "afisha" && row.weight === 1)).toBe(true);
    const after = await service.afterMe(userId, now);
    expect(after.suggestions[0]?.toCategory).toBe("sport");
    expect(after.suggestions[0]?.events.map((row) => row.id)).toEqual([nextId]);
  });

  it("returns no after-me suggestions when the viewer disabled recommendations", async () => {
    const checkIns = createStoreRepo<CheckInEntity>([{ id: "c1", userId, eventId: jazzId, placeId: null, checkedInAt: new Date("2026-09-01T10:00:00Z") } as CheckInEntity, { id: "c2", userId, eventId: runId, placeId: null, checkedInAt: new Date("2026-09-04T10:00:00Z") } as CheckInEntity]);
    const events = createStoreRepo<EventEntity>([{ id: jazzId, category: "afisha", placeId: null, published: true, startsAt: new Date("2026-08-01T10:00:00Z") } as EventEntity, { id: runId, category: "sport", placeId: null, published: true, startsAt: new Date("2026-08-02T10:00:00Z") } as EventEntity]);
    const profiles = createStoreRepo<ProfileEntity>([{ userId, city: "Москва", interests: [], recommendationsEnabled: false } as unknown as ProfileEntity]);
    const service = new TasteService(checkIns as unknown as Repository<CheckInEntity>, events as unknown as Repository<EventEntity>, createStoreRepo<PlaceEntity>() as unknown as Repository<PlaceEntity>, createStoreRepo<ReviewEntity>() as unknown as Repository<ReviewEntity>, profiles as unknown as Repository<ProfileEntity>);
    expect(await service.afterMe(userId, now)).toEqual({ suggestions: [] });
  });
});
