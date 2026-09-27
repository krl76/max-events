import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { QueryFailedError, type Repository } from "typeorm";
import type { Place } from "@max-events/api-contracts";
import type { BookingsService } from "../bookings/bookings.service";
import { EventEntity } from "../events/event.entity";
import { FriendshipEntity } from "../friends/friendship.entity";
import { ParticipationEntity } from "../participations/participation.entity";
import type { PlacesService } from "../places/places.service";
import { UserEntity } from "../users/user.entity";
import type { UsersService } from "../users/users.service";
import type { WaitlistService } from "../waitlist/waitlist.service";
import { FeedDraftEntity } from "./feed-draft.entity";
import { FeedCommentEntity, FeedLikeEntity, FeedPostEntity, FeedPostGoingEntity } from "./feed-post.entity";
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
    merge: (entity: T, fields: Partial<T>) => Object.assign(entity, fields),
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
  const drafts = createStoreRepo<FeedDraftEntity>();
  const going = createStoreRepo<FeedPostGoingEntity>();
  // The booking DTO carries no source: what has to be checked is the source FeedService asks for.
  const booked: Array<{ eventId: string; source: string | null | undefined }> = [];
  const bookings = {
    create: async (_userId: string, bookedEventId: string, _promo?: string | null, _now?: Date, _referral?: string | null, source?: string | null) => {
      booked.push({ eventId: bookedEventId, source });
      return {
        id: "00000000-0000-4000-8000-0000000000b1",
        userId,
        eventId: bookedEventId,
        status: "active",
        freeSeats: null,
      };
    },
  } as unknown as BookingsService;
  const service = new FeedService(posts as unknown as Repository<FeedPostEntity>, likes as unknown as Repository<FeedLikeEntity>, comments as unknown as Repository<FeedCommentEntity>, events as unknown as Repository<EventEntity>, users as unknown as Repository<UserEntity>, publishers, places, waitlist, participations as unknown as Repository<ParticipationEntity>, friendships as unknown as Repository<FriendshipEntity>, drafts as unknown as Repository<FeedDraftEntity>, bookings, going as unknown as Repository<FeedPostGoingEntity>);
  return { service, likes, posts, participations, waitlistMap, drafts, booked, users, going };
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

  it("upserts one composer draft per author", async () => {
    const { service, drafts } = createService();
    const first = await service.saveDraft(userId, { eventId: null, text: "черновик" }, now);
    expect(first.savedAt).toBe(now.toISOString());
    expect(drafts.store).toHaveLength(1);
    await service.saveDraft(userId, { eventId, text: "обновили", allowJoin: true }, now);
    expect(drafts.store).toHaveLength(1);
    expect(drafts.store[0]?.text).toBe("обновили");
    expect(drafts.store[0]?.allowJoin).toBe(true);
  });

  it("books the post event when join is allowed and refuses otherwise", async () => {
    const { service, booked } = createService();
    const allowed = await service.create(userId, { eventId, text: "Собираемся", allowJoin: true });
    const booking = await service.join(userId, allowed.id);
    expect(booking.eventId).toBe(eventId);
    // Where the booking came from is what the feed adds to it, even though the DTO does not echo it back.
    expect(booked).toEqual([{ eventId, source: "feed" }]);
    const blocked = await service.create(userId, { eventId, text: "Без записи", allowJoin: false });
    await expect(service.join(userId, blocked.id)).rejects.toBeInstanceOf(BadRequestException);
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

  it("keeps a post with a place as the author's post, with the photos and the text once", async () => {
    const { service } = createService();
    const photos = ["data:image/jpeg;base64,a", "data:image/jpeg;base64,b"];
    const created = await service.create(userId, { eventId, text: "Мангальная зона", placeId, photoUrls: photos });
    const [card] = await service.listCards(userId, now);
    expect(card?.kind).toBe("friend");
    if (card?.kind !== "friend") throw new Error("expected a friend card");
    expect(card.id).toBe(created.id);
    expect(card.placeTitle).toBe("Парк Горького");
    expect(card.text).toBe("Мангальная зона");
    expect(card.photoUrls).toEqual(photos);
    expect(card.photoUrl).toBe(photos[0]);
    expect(card.event?.id).toBe(eventId);
  });

  it("publishes a post with no event", async () => {
    const { service } = createService();
    const created = await service.create(userId, { eventId: null, text: "Просто кадр" });
    expect(created.eventId).toBeNull();
    const [card] = await service.listCards(userId, now);
    expect(card?.kind).toBe("friend");
    if (card?.kind !== "friend") throw new Error("expected a friend card");
    expect(card.event).toBeNull();
    expect(card.text).toBe("Просто кадр");
  });

  it("reposts someone else's post once and keeps their caption on them", async () => {
    const { service, users } = createService();
    const otherId = "00000000-0000-4000-8000-00000000000b";
    users.store.push({ id: otherId, firstName: "Дима", lastName: "Кузнецов", avatarUrl: null } as UserEntity);
    const created = await service.create(userId, { eventId, text: "Мой комментарий к событию" });
    await service.addComment(userId, created.id, "Это мой коммент");
    await expect(service.repostPost(userId, created.id)).rejects.toBeInstanceOf(BadRequestException);
    const reposted = await service.repostPost(otherId, created.id);
    expect(reposted.text).toBe("");
    expect(reposted.comments).toEqual([]);
    expect(reposted.repostOf?.author.name).toBe("Анна Соколова");
    expect(reposted.repostOf?.text).toBe("Мой комментарий к событию");
    await expect(service.repostPost(otherId, created.id)).rejects.toBeInstanceOf(ConflictException);
    const original = await service.get(userId, created.id);
    expect(original.comments).toHaveLength(1);
    expect(original.comments[0]?.author.name).toBe("Анна Соколова");
  });

  it("marks going on one post without changing the sibling post of the same event", async () => {
    const { service } = createService();
    const first = await service.create(userId, { eventId, text: "Первый" });
    const second = await service.create(userId, { eventId, text: "Второй" });
    await service.toggleGoing(userId, first.id);
    const cards = await service.listCards(userId, now);
    const card = (id: string) => {
      const found = cards.find((item) => item.kind === "friend" && item.id === id);
      if (found?.kind !== "friend") throw new Error("expected a friend card");
      return found;
    };
    expect(card(first.id).goingByMe).toBe(true);
    expect(card(second.id).goingByMe).toBe(false);
    expect(card(first.id).friendsGoing).toBe(1);
    expect(card(second.id).friendsGoing).toBe(0);
  });

  it("hangs a reply under the root comment", async () => {
    const { service } = createService();
    const created = await service.create(userId, { eventId, text: "Пост" });
    const withRoot = await service.addComment(userId, created.id, "Корень");
    const rootId = withRoot.comments[0]?.id;
    if (rootId === undefined) throw new Error("expected a comment");
    const withReply = await service.addComment(userId, created.id, "Ответ", rootId);
    const reply = withReply.comments.find((item) => item.text === "Ответ");
    expect(reply?.parentId).toBe(rootId);
  });
});
