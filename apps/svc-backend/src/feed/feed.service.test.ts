import { NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { QueryFailedError, type Repository } from "typeorm";
import type { Place } from "@max-events/api-contracts";
import { EventEntity } from "../events/event.entity";
import { FriendshipEntity } from "../friends/friendship.entity";
import { ParticipationEntity } from "../participations/participation.entity";
import type { PlacesService } from "../places/places.service";
import { UserEntity } from "../users/user.entity";
import type { UsersService } from "../users/users.service";
import type { WaitlistService } from "../waitlist/waitlist.service";
import { FeedCommentEntity, FeedLikeEntity, FeedPostEntity } from "./feed-post.entity";
import { FeedService } from "./feed.service";

const now = new Date("2026-09-12T10:00:00Z");
const userId = "00000000-0000-4000-8000-00000000000a";
const eventId = "00000000-0000-4000-8000-0000000000e1";
const otherEventId = "00000000-0000-4000-8000-0000000000e2";
const placeId = "00000000-0000-4000-8000-0000000000a1";
const otherPlaceId = "00000000-0000-4000-8000-0000000000a2";
const photoUrl = "https://cdn.example/feed/1.jpg";

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

function createStoreRepo<T extends { id?: string }>(initial: T[] = []) {
  const store = [...initial];
  let seq = 0;
  return {
    store,
    create: (fields: Partial<T>) => ({ ...fields, createdAt: now }) as unknown as T,
    find: async (opts: { where?: Record<string, unknown>; order?: { createdAt?: "DESC" | "ASC" }; take?: number; skip?: number } = {}) => {
      let rows = store.filter((row) => matchesWhere(row as object, opts.where ?? {}));
      if (opts.order?.createdAt === "DESC") rows = [...rows].reverse();
      const skip = opts.skip ?? 0;
      return rows.slice(skip, skip + (opts.take ?? rows.length));
    },
    findOneBy: async (where: Record<string, string>) => store.find((row) => matchesWhere(row as object, where)) ?? null,
    save: async (entity: T) => {
      if (!store.includes(entity)) {
        entity.id ??= `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
        store.push(entity);
      }
      return entity;
    },
    remove: async (entity: T) => {
      const index = store.indexOf(entity);
      if (index >= 0) store.splice(index, 1);
      return entity;
    },
  };
}

function catalogEvent(id: string, venueId: string, extra: Partial<EventEntity> = {}): EventEntity {
  return {
    id,
    title: extra.title ?? "Джаз в парке",
    description: "",
    category: "afisha",
    city: "Москва",
    placeId: venueId,
    organizerUserId: null,
    startsAt: extra.startsAt ?? new Date("2026-09-12T16:00:00Z"),
    endsAt: extra.endsAt ?? null,
    isPaid: false,
    priceRub: null,
    paymentUrl: null,
    capacity: extra.capacity ?? null,
    bookedCount: extra.bookedCount ?? 0,
    published: extra.published ?? true,
    bookingOpensAt: null,
    chatLink: null,
    chatSyncPending: true,
    createdAt: now,
    updatedAt: now,
    ...extra,
  } as EventEntity;
}

function createService(eventPublished = true) {
  const posts = createStoreRepo<FeedPostEntity>();
  const likes = createStoreRepo<FeedLikeEntity>();
  const comments = createStoreRepo<FeedCommentEntity>();
  const events = createStoreRepo<EventEntity>([catalogEvent(eventId, placeId, { published: eventPublished }), catalogEvent(otherEventId, otherPlaceId)]);
  const users = createStoreRepo<UserEntity>([{ id: userId, firstName: "Анна", lastName: "Соколова", avatarUrl: null } as UserEntity]);
  const publishers = { assertCanPublish: async () => undefined } as unknown as UsersService;
  const places = {
    findByIds: async (ids: string[]) =>
      ids.map(
        (id) =>
          ({
            id,
            title: "Парк Горького",
            address: "ул. Крымский Вал, 9",
            city: "Москва",
            category: "park",
            latitude: 55.73,
            longitude: 37.6,
            published: true,
            logoUrl: null,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          }) as Place,
      ),
  } as unknown as PlacesService;
  const waitlistMap = new Map<string, number>();
  const waitlist = { queueCountsByEventIds: async () => waitlistMap } as unknown as WaitlistService;
  const participations = createStoreRepo<ParticipationEntity>();
  const friendships = createStoreRepo<FriendshipEntity>();
  const service = new FeedService(posts as unknown as Repository<FeedPostEntity>, likes as unknown as Repository<FeedLikeEntity>, comments as unknown as Repository<FeedCommentEntity>, events as unknown as Repository<EventEntity>, users as unknown as Repository<UserEntity>, publishers, places, waitlist, participations as unknown as Repository<ParticipationEntity>, friendships as unknown as Repository<FriendshipEntity>);
  return { service, likes, posts, participations, waitlistMap };
}

describe("FeedService", () => {
  it("publishes a post immediately and lists it newest first", async () => {
    const { service } = createService();
    const created = await service.create(userId, { eventId, text: "Как прошло — огонь" });
    expect(created.text).toBe("Как прошло — огонь");
    expect(created.author.name).toBe("Анна Соколова");
    expect(created.likesCount).toBe(0);
    const listed = await service.list(userId, { eventId });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(created.id);
  });

  it("keeps the post photo from create through the list", async () => {
    const { service } = createService();
    const created = await service.create(userId, { eventId, text: "с фото", photoUrl });
    expect(created.photoUrl).toBe(photoUrl);
    const listed = await service.list(userId, { eventId });
    expect(listed[0]?.photoUrl).toBe(photoUrl);
  });

  it("leaves photoUrl null when the post carries no photo", async () => {
    const { service } = createService();
    const created = await service.create(userId, { eventId, text: "без фото" });
    expect(created.photoUrl).toBeNull();
  });

  it("serves the wall of a place from the posts of its events", async () => {
    const { service } = createService();
    const here = await service.create(userId, { eventId, text: "тут" });
    await service.create(userId, { eventId: otherEventId, text: "в другом месте" });

    const wall = await service.list(userId, { placeId });
    expect(wall.map((post) => post.id)).toEqual([here.id]);

    const everything = await service.list(userId);
    expect(everything).toHaveLength(2);
  });

  it("returns an empty wall for a place with no events", async () => {
    const { service } = createService();
    await service.create(userId, { eventId, text: "тут" });
    await expect(service.list(userId, { placeId: "00000000-0000-4000-8000-0000000000a9" })).resolves.toEqual([]);
  });

  it("toggles a like and adds a comment", async () => {
    const { service } = createService();
    const created = await service.create(userId, { eventId, text: "фото" });
    const liked = await service.toggleLike(userId, created.id);
    expect(liked.likesCount).toBe(1);
    expect(liked.likedByMe).toBe(true);
    const unliked = await service.toggleLike(userId, created.id);
    expect(unliked.likesCount).toBe(0);
    const commented = await service.addComment(userId, created.id, "согласен");
    expect(commented.comments).toHaveLength(1);
    expect(commented.comments[0]?.text).toBe("согласен");
  });

  it("rejects a post for an unknown event", async () => {
    const { service } = createService();
    await expect(service.create(userId, { eventId: "00000000-0000-4000-8000-0000000000e9", text: "x" })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects a post for an unpublished event", async () => {
    const { service } = createService(false);
    await expect(service.create(userId, { eventId, text: "x" })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("treats a unique-violation like as already liked", async () => {
    const { service, likes } = createService();
    const created = await service.create(userId, { eventId, text: "фото" });
    likes.store.push({ id: "like-1", postId: created.id, userId } as FeedLikeEntity);
    likes.findOneBy = async () => null;
    likes.save = async () => {
      throw new QueryFailedError("INSERT", [], Object.assign(new Error("duplicate"), { code: "23505" }));
    };
    const liked = await service.toggleLike(userId, created.id);
    expect(liked.likesCount).toBe(1);
    expect(liked.likedByMe).toBe(true);
  });

  it("paginates the feed list", async () => {
    const { service } = createService();
    await service.create(userId, { eventId, text: "first" });
    await service.create(userId, { eventId, text: "second" });
    const page = await service.list(userId, { eventId }, 1, 0);
    expect(page).toHaveLength(1);
    expect(page[0]?.text).toBe("second");
  });

  it("wraps friend posts as home cards with counted zeros rather than nulls", async () => {
    const { service, participations, waitlistMap } = createService();
    const created = await service.create(userId, { eventId, text: "Как прошло — огонь" });
    participations.store.push({ id: "p1", userId, eventId, status: "going" } as ParticipationEntity);
    waitlistMap.set(eventId, 3);
    const [card] = await service.listCards(userId, now);
    expect(card?.kind).toBe("friend");
    if (card?.kind !== "friend") throw new Error("expected a friend card");
    expect(card.id).toBe(created.id);
    expect(card.placeTitle).toBe("Парк Горького");
    expect(card.counts).toEqual({ wantsToGo: 0, going: 1, waitlist: 3, freeSeats: null });
    expect(card.myStatus).toBe("going");
    expect(card.publishedAt).toBe(now.toISOString());
  });

  it("answers a venue card when the post names a place, and free seats when capacity is known", async () => {
    const { service } = createService();
    const created = await service.create(userId, { eventId, text: "Мангальная зона", placeId });
    const [card] = await service.listCards(userId, now);
    expect(card?.kind).toBe("place");
    if (card?.kind !== "place") throw new Error("expected a place card");
    expect(card.id).toBe(created.id);
    expect(card.place.id).toBe(placeId);
    expect(card.rating).toBeNull();
    expect(card.travelMinutes).toBeNull();
  });
});
