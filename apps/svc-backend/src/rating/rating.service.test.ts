import { NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import type { OrganizationsService } from "../organizations/organizations.service";
import { ReviewEntity } from "../reviews/review.entity";
import { buildOrganizerRating, MIN_REVIEWS, RatingService } from "./rating.service";

const now = new Date("2026-09-12T12:00:00Z");
const organizer = "00000000-0000-4000-8000-00000000000a";
const eventId = "00000000-0000-4000-8000-0000000000e1";

function inValues(value: unknown): unknown[] | undefined {
  if (value && typeof value === "object" && Array.isArray((value as { _value?: unknown })._value)) return (value as { _value: unknown[] })._value;
  return undefined;
}

function matchesWhere(row: object, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, value]) => {
    const cell = (row as Record<string, unknown>)[key];
    const values = inValues(value);
    return values ? values.includes(cell) : cell === value;
  });
}

function createStoreRepo<T extends object>(initial: T[] = []) {
  const store = [...initial];
  return {
    find: async (opts: { where?: Record<string, unknown> } = {}) => store.filter((row) => matchesWhere(row as object, opts.where ?? {})),
    findOneBy: async (where: Record<string, unknown>) => store.find((row) => matchesWhere(row as object, where)) ?? null,
  };
}

describe("buildOrganizerRating", () => {
  it("hides the card below the review threshold and computes recommend/on-time when enough reviews exist", () => {
    const event = { id: eventId, organizerUserId: organizer, published: true, startsAt: new Date("2026-09-12T10:00:00Z") } as EventEntity;
    const few = [{ stars: 5, wouldGoAgain: true, eventId } as ReviewEntity, { stars: 4, wouldGoAgain: true, eventId } as ReviewEntity];
    expect(buildOrganizerRating(organizer, [event], few, [], now)).toBeNull();
    expect(few).toHaveLength(MIN_REVIEWS - 1);

    const reviews = [{ stars: 5, wouldGoAgain: true, eventId } as ReviewEntity, { stars: 5, wouldGoAgain: true, eventId } as ReviewEntity, { stars: 4, wouldGoAgain: false, eventId } as ReviewEntity];
    const checkIns = [{ eventId, checkedInAt: new Date("2026-09-12T10:05:00Z") } as CheckInEntity];
    const rating = buildOrganizerRating(organizer, [event], reviews, checkIns, now);
    expect(rating?.averageStars).toBeCloseTo(14 / 3);
    expect(rating?.recommendPercent).toBeCloseTo(200 / 3);
    expect(rating?.visitsCount).toBe(1);
    expect(rating?.onTimePercent).toBe(100);
    expect(rating?.reviewsCount).toBe(3);
    expect(rating?.eventsCount).toBe(1);
    expect(rating?.attendancePercent).toBe(100);
  });
});

// No organization row matches these ids, so the service treats them as organizer user ids.
const organizationsFake = { organizerUserIdOf: async () => null } as unknown as OrganizationsService;

describe("RatingService.forEvent", () => {
  it("returns null without an organizer and 404 for unpublished events", async () => {
    const events = createStoreRepo<EventEntity>([{ id: eventId, organizerUserId: null, published: true, startsAt: now } as EventEntity, { id: "00000000-0000-4000-8000-0000000000e2", organizerUserId: organizer, published: false, startsAt: now } as EventEntity]);
    const service = new RatingService(events as unknown as Repository<EventEntity>, createStoreRepo<ReviewEntity>() as unknown as Repository<ReviewEntity>, createStoreRepo<CheckInEntity>() as unknown as Repository<CheckInEntity>, organizationsFake);
    await expect(service.forEvent(eventId, now)).resolves.toEqual({ rating: null });
    await expect(service.forEvent("00000000-0000-4000-8000-0000000000e2", now)).rejects.toBeInstanceOf(NotFoundException);
  });
});
