import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { FeedCommentEntity, FeedLikeEntity, FeedPostEntity } from "../feed/feed-post.entity";
import { PlaceEntity } from "../places/place.entity";
import { ProfileSurfaceService } from "./profile-surface.service";
import { ProfileEntity } from "./profile.entity";
import { UserEntity } from "./user.entity";

const userId = "00000000-0000-4000-8000-00000000000a";
const otherId = "00000000-0000-4000-8000-00000000000b";
const eventId = "00000000-0000-4000-8000-0000000000e1";
const placeId = "00000000-0000-4000-8000-0000000000a1";
const now = new Date("2026-09-12T10:00:00Z");

function inValues(value: unknown): unknown[] | undefined {
  if (value && typeof value === "object" && Array.isArray((value as { value?: unknown }).value)) return (value as { value: unknown[] }).value;
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

function createStoreRepo<T extends { id?: string }>(initial: T[] = []) {
  const store = [...initial];
  return {
    store,
    findOneBy: async (where: Record<string, unknown>) => store.find((row) => matchesWhere(row as object, where)) ?? null,
    find: async (opts: { where?: Record<string, unknown>; order?: { createdAt?: "DESC" } } = {}) => {
      let rows = store.filter((row) => matchesWhere(row as object, opts.where ?? {}));
      if (opts.order?.createdAt === "DESC") rows = [...rows].reverse();
      return rows;
    },
    create: (fields: Partial<T>) => ({ ...fields }) as T,
    save: async (entity: T) => {
      if (!store.includes(entity)) store.push(entity);
      return entity;
    },
  };
}

function createService() {
  const users = createStoreRepo<UserEntity>([{ id: userId } as UserEntity]);
  const profiles = createStoreRepo<ProfileEntity>();
  const checkIns = createStoreRepo<CheckInEntity>([{ id: "c1", userId, eventId, placeId: null } as CheckInEntity, { id: "c2", userId: otherId, eventId, placeId: null } as CheckInEntity, { id: "c3", userId, eventId: null, placeId } as CheckInEntity]);
  const events = createStoreRepo<EventEntity>([{ id: eventId, title: "Джаз", category: "afisha", placeId, published: true } as EventEntity]);
  const places = createStoreRepo<PlaceEntity>([{ id: placeId, title: "Парк Горького" } as PlaceEntity]);
  const posts = createStoreRepo<FeedPostEntity>([{ id: "00000000-0000-4000-8000-0000000000f1", authorUserId: userId, eventId, text: "огонь", photoUrl: null, published: true, createdAt: now } as FeedPostEntity]);
  const likes = createStoreRepo<FeedLikeEntity>([{ id: "l1", postId: "00000000-0000-4000-8000-0000000000f1", userId: otherId } as FeedLikeEntity]);
  const comments = createStoreRepo<FeedCommentEntity>();
  const service = new ProfileSurfaceService(users as unknown as Repository<UserEntity>, profiles as unknown as Repository<ProfileEntity>, checkIns as unknown as Repository<CheckInEntity>, events as unknown as Repository<EventEntity>, places as unknown as Repository<PlaceEntity>, posts as unknown as Repository<FeedPostEntity>, likes as unknown as Repository<FeedLikeEntity>, comments as unknown as Repository<FeedCommentEntity>);
  return { service, profiles };
}

describe("ProfileSurfaceService", () => {
  it("counts distinct events and places and shared-event company visits", async () => {
    const { service } = createService();
    await expect(service.counters(userId)).resolves.toEqual({ userId, eventsCount: 1, placesCount: 1, companiesCount: 1 });
  });

  it("lists visited places by visit count and author posts newest first", async () => {
    const { service } = createService();
    expect(await service.visitedPlaces(userId)).toEqual([{ placeId, title: "Парк Горького", visits: 2 }]);
    const [post] = await service.listPosts(userId);
    expect(post).toMatchObject({ eventTitle: "Джаз", category: "afisha", likesCount: 1, commentsCount: 0, photoUrl: null });
  });

  it("stores app settings for the owner and refuses another user", async () => {
    const { service } = createService();
    const saved = await service.updateAppSettings(userId, userId, { quietHours: true, searchRadiusKm: 8 });
    expect(saved.quietHours).toBe(true);
    expect(saved.searchRadiusKm).toBe(8);
    expect(saved.showOnMap).toBe(true);
    await expect(service.getAppSettings(userId, otherId)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.counters("00000000-0000-4000-8000-0000000000ff")).rejects.toBeInstanceOf(NotFoundException);
  });
});
