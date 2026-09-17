import { NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import type { EventRating } from "@max-events/api-contracts";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import type { FriendsService } from "../friends/friends.service";
import { ParticipationEntity } from "../participations/participation.entity";
import { PlaceEntity } from "../places/place.entity";
import type { ReviewsService } from "../reviews/reviews.service";
import { UserEntity } from "../users/user.entity";
import { PlacePageService } from "./place-page.service";

const now = new Date("2026-09-12T10:00:00Z");
const viewer = "00000000-0000-4000-8000-00000000000a";
const friendId = "00000000-0000-4000-8000-00000000000b";
const placeId = "00000000-0000-4000-8000-0000000000p1";
const eventId = "00000000-0000-4000-8000-0000000000e1";

function createStoreRepo<T extends { id?: string }>(initial: T[] = []) {
  const store = [...initial];
  return {
    find: async (opts: { where?: Record<string, string> } = {}) => {
      const where = opts.where ?? {};
      return store.filter((row) => Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value));
    },
    findOneBy: async (where: Record<string, string>) => store.find((row) => Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value)) ?? null,
  };
}

describe("PlacePageService", () => {
  it("assembles today events, friend visits, popularity and personal history", async () => {
    const places = createStoreRepo<PlaceEntity>([{ id: placeId, title: "ВДНХ" } as PlaceEntity]);
    const events = createStoreRepo<EventEntity>([
      {
        id: eventId,
        title: "Выставка",
        description: "",
        category: "afisha",
        city: "Москва",
        placeId,
        organizerUserId: null,
        startsAt: now,
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
    const checkIns = createStoreRepo<CheckInEntity>([{ id: "c1", userId: viewer, eventId: null, placeId, visitDate: "2026-09-12", checkedInAt: now } as CheckInEntity, { id: "c2", userId: friendId, eventId: null, placeId, visitDate: "2026-09-01", checkedInAt: now } as CheckInEntity, { id: "c3", userId: friendId, eventId: null, placeId, visitDate: "2026-09-12", checkedInAt: now } as CheckInEntity]);
    const participations = createStoreRepo<ParticipationEntity>([{ id: "p1", userId: friendId, eventId, status: "going" } as ParticipationEntity]);
    const users = createStoreRepo<UserEntity>([{ id: friendId, firstName: "Анна", lastName: null, avatarUrl: null } as UserEntity]);
    const friends = { friendIds: async () => new Set([friendId]) } as unknown as FriendsService;
    const rating: EventRating = { summary: { eventId: null, placeId, averageStars: 4.8, reviewsCount: 2 }, categoryAverages: { atmosphere: 4.8, organization: null, price: null, place: null } };
    const reviews = { placeRating: async () => rating } as unknown as ReviewsService;
    const service = new PlacePageService(places as unknown as Repository<PlaceEntity>, events as unknown as Repository<EventEntity>, checkIns as unknown as Repository<CheckInEntity>, participations as unknown as Repository<ParticipationEntity>, users as unknown as Repository<UserEntity>, friends, reviews);
    const page = await service.get(placeId, viewer, now);
    expect(page.todayEvents).toHaveLength(1);
    expect(page.popularityToday).toBe(2);
    expect(page.personalVisitsCount).toBe(1);
    expect(page.friends).toHaveLength(1);
    expect(page.friends[0]?.visitsCount).toBe(2);
    expect(page.friends[0]?.goingToday).toBe(true);
    expect(page.rating?.summary.averageStars).toBe(4.8);
  });

  it("rejects an unknown place", async () => {
    const empty = createStoreRepo();
    const service = new PlacePageService(empty as unknown as Repository<PlaceEntity>, empty as unknown as Repository<EventEntity>, empty as unknown as Repository<CheckInEntity>, empty as unknown as Repository<ParticipationEntity>, empty as unknown as Repository<UserEntity>, { friendIds: async () => new Set() } as unknown as FriendsService, { placeRating: async () => ({ summary: { eventId: null, placeId, averageStars: 0, reviewsCount: 0 }, categoryAverages: { atmosphere: null, organization: null, price: null, place: null } }) } as unknown as ReviewsService);
    await expect(service.get(placeId, viewer, now)).rejects.toBeInstanceOf(NotFoundException);
  });
});
