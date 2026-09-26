import { NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import type { FriendsService } from "../friends/friends.service";
import { ParticipationEntity } from "../participations/participation.entity";
import { PlaceEntity } from "../places/place.entity";
import type { ReviewsService } from "../reviews/reviews.service";
import { UserEntity } from "../users/user.entity";
import { occupancyFrom, PlacePageService } from "./place-page.service";

const now = new Date("2026-09-12T13:00:00Z");
const viewer = "00000000-0000-4000-8000-00000000000a";
const placeId = "00000000-0000-4000-8000-0000000000p1";

function matchesWhere(row: object, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value);
}

function createStoreRepo<T extends { id?: string }>(initial: T[] = []) {
  const store = [...initial];
  return {
    find: async (opts: { where?: Record<string, unknown> | Record<string, unknown>[] } = {}) => {
      const where = opts.where;
      if (Array.isArray(where)) return store.filter((row) => where.some((clause) => matchesWhere(row as object, clause)));
      return store.filter((row) => matchesWhere(row as object, where ?? {}));
    },
    findOneBy: async (where: Record<string, unknown>) => store.find((row) => matchesWhere(row as object, where)) ?? null,
  };
}

describe("occupancyFrom", () => {
  it("normalizes hour counts to 0..1 and is empty without visits", () => {
    expect(occupancyFrom([], now)).toEqual({ occupancy: [], occupancyNowHour: null });
    const busy = new Date("2026-09-12T13:00:00Z");
    const quiet = new Date("2026-09-12T10:00:00Z");
    const result = occupancyFrom([{ checkedInAt: busy } as CheckInEntity, { checkedInAt: busy } as CheckInEntity, { checkedInAt: quiet } as CheckInEntity], now);
    expect(result.occupancy).toEqual([
      { hour: 13, load: 0.5 },
      { hour: 16, load: 1 },
    ]);
    expect(result.occupancyNowHour).toBe(16);
  });
});

describe("PlacePageService.board", () => {
  it("builds occupancy from check-ins and leaves slots empty", async () => {
    const places = createStoreRepo<PlaceEntity>([{ id: placeId, published: true } as PlaceEntity]);
    const events = createStoreRepo<EventEntity>([{ id: "e1", placeId, published: true, startsAt: new Date("2026-09-14T12:00:00Z") } as EventEntity]);
    const checkIns = createStoreRepo<CheckInEntity>([
      { id: "c1", userId: viewer, placeId, eventId: null, visitDate: "2026-09-12", checkedInAt: now } as CheckInEntity,
      { id: "c2", userId: viewer, placeId, eventId: null, visitDate: "2026-08-01", checkedInAt: new Date("2026-08-01T12:00:00Z") } as CheckInEntity,
    ]);
    const service = new PlacePageService(places as unknown as Repository<PlaceEntity>, events as unknown as Repository<EventEntity>, checkIns as unknown as Repository<CheckInEntity>, createStoreRepo<ParticipationEntity>() as unknown as Repository<ParticipationEntity>, createStoreRepo<UserEntity>() as unknown as Repository<UserEntity>, { friendIds: async () => new Set() } as unknown as FriendsService, { placeRating: async () => null } as unknown as ReviewsService, { upcoming: async () => [] } as never);
    const board = await service.board(placeId, viewer, now);
    expect(board.checkedInToday).toBe(true);
    expect(board.weekEventsCount).toBe(1);
    expect(board.occupancy.length).toBeGreaterThan(0);
    expect(board.slots).toEqual([]);
    expect(board.upcoming).toEqual([]);
    expect(board.visitMonths.some((row) => row.month === "2026-09")).toBe(true);
    await expect(service.board("00000000-0000-4000-8000-0000000000p9", viewer, now)).rejects.toBeInstanceOf(NotFoundException);
  });
});
