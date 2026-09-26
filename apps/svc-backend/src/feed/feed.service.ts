// START_MODULE_CONTRACT
// PURPOSE: Feed wall — create posts with an optional photo, toggle likes, add comments, list newest-first filtered by event or by place; home cards wrap posts with counters.
// SCOPE: toFeedPost includes author, photoUrl, likesCount, likedByMe for the requester, comments; a place wall is the posts of that place's events; listCards is GET /feed/cards.
// DEPENDS: typeorm, @max-events/api-contracts, events/users
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - FeedListFilter - event wall or place wall selector
// - FeedService - list/get/create/saveDraft/join/toggleLike/addComment/listCards
// END_MODULE_MAP

import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FindOperator, In, QueryFailedError, Repository } from "typeorm";
import type { BookingWithSeats, CreateFeedPostWrite, FeedCard, FeedCardCounts, FeedDraftSaved, FeedDraftWrite, FeedPost, ParticipationStatus, Place } from "@max-events/api-contracts";
import { BookingsService } from "../bookings/bookings.service";
import { EventEntity } from "../events/event.entity";
import { toEventDto } from "../events/event.mapper";
import { FriendshipEntity } from "../friends/friendship.entity";
import { toFriendDto } from "../friends/friends.service";
import { ParticipationEntity } from "../participations/participation.entity";
import { PlacesService } from "../places/places.service";
import { UserEntity } from "../users/user.entity";
import { UsersService } from "../users/users.service";
import { WaitlistService } from "../waitlist/waitlist.service";
import { FeedDraftEntity } from "./feed-draft.entity";
import { FeedCommentEntity, FeedLikeEntity, FeedPostEntity } from "./feed-post.entity";

export type FeedListFilter = { eventId?: string; placeId?: string };

@Injectable()
export class FeedService {
  constructor(
    @InjectRepository(FeedPostEntity) private readonly posts: Repository<FeedPostEntity>,
    @InjectRepository(FeedLikeEntity) private readonly likes: Repository<FeedLikeEntity>,
    @InjectRepository(FeedCommentEntity) private readonly comments: Repository<FeedCommentEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @Inject(UsersService) private readonly publishers: UsersService,
    @Inject(PlacesService) private readonly places: PlacesService,
    @Inject(WaitlistService) private readonly waitlist: WaitlistService,
    @InjectRepository(ParticipationEntity) private readonly participations: Repository<ParticipationEntity>,
    @InjectRepository(FriendshipEntity) private readonly friendships: Repository<FriendshipEntity>,
    @InjectRepository(FeedDraftEntity) private readonly drafts: Repository<FeedDraftEntity>,
    @Inject(BookingsService) private readonly bookings: BookingsService,
  ) {}

  async list(viewerId: string, filter: FeedListFilter = {}, limit = 50, offset = 0): Promise<FeedPost[]> {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = Math.max(offset, 0);
    const where: { published: true; eventId?: string | FindOperator<string> } = { published: true };
    if (filter.eventId) where.eventId = filter.eventId;
    else if (filter.placeId) {
      // The wall of a place is the posts of the events held there; an empty place has no wall.
      const atPlace = await this.events.find({ where: { placeId: filter.placeId, published: true } });
      if (atPlace.length === 0) return [];
      where.eventId = In(atPlace.map((row) => row.id));
    }
    const rows = await this.posts.find({ where, order: { createdAt: "DESC", id: "DESC" }, take, skip });
    return this.toDtoMany(rows, viewerId);
  }

  async get(viewerId: string, postId: string): Promise<FeedPost> {
    return this.toDto(await this.requirePost(postId), viewerId);
  }

  async listCards(viewerId: string, now = new Date()): Promise<FeedCard[]> {
    const rows = await this.posts.find({ where: { published: true }, order: { createdAt: "DESC", id: "DESC" }, take: 50, skip: 0 });
    const posts = await this.toDtoMany(rows, viewerId);
    if (posts.length === 0) return [];
    const eventIds = [...new Set(posts.map((post) => post.eventId))];
    const events = await this.events.find({ where: { id: In(eventIds), published: true } });
    const eventById = new Map(events.filter((row) => row.startsAt instanceof Date).map((row) => [row.id, row]));
    const placeIds = [...new Set([...events.map((row) => row.placeId), ...posts.map((post) => post.placeId ?? null)].filter((id): id is string => id !== null))];
    const [placeDtos, waitlists, parts, friendEdges] = await Promise.all([this.places.findByIds(placeIds), this.waitlist.queueCountsByEventIds(eventIds), this.participations.find({ where: { eventId: In(eventIds) } }), this.friendships.find({ where: { userId: viewerId } })]);
    const placeById = new Map(placeDtos.map((place) => [place.id, place]));
    const counts = countParticipations(parts, viewerId);
    const friendIds = new Set(friendEdges.map((row) => row.friendUserId));
    const goingFriendIds = [...new Set(parts.filter((row) => friendIds.has(row.userId) && row.status === "going").map((row) => row.userId))];
    const goingUsers = goingFriendIds.length === 0 ? [] : await this.users.find({ where: { id: In(goingFriendIds) } });
    const goingByPlace = goingFriendsByPlace(parts, events, goingUsers, friendIds);
    const rowById = new Map(rows.map((row) => [row.id, row]));
    return posts.flatMap((post) => {
      const event = eventById.get(post.eventId);
      if (!event) return [];
      const place = (post.placeId ? placeById.get(post.placeId) : undefined) ?? (event.placeId ? placeById.get(event.placeId) : undefined);
      const createdAt = rowById.get(post.id)?.createdAt;
      if (post.placeId && place) return [toPlaceCard(post, place, createdAt, goingByPlace.get(place.id) ?? [])];
      return [toFriendCard(post, event, place ?? null, counts.get(post.eventId), waitlists.get(post.eventId) ?? 0, now, createdAt)];
    });
  }

  async create(userId: string, payload: CreateFeedPostWrite): Promise<FeedPost> {
    await this.publishers.assertCanPublish(userId);
    const event = await this.events.findOneBy({ id: payload.eventId });
    if (!event || event.published === false) throw new NotFoundException("Event not found");
    const saved = await this.posts.save(
      this.posts.create({
        authorUserId: userId,
        eventId: payload.eventId,
        text: payload.text,
        photoUrl: payload.photoUrl ?? null,
        placeId: payload.placeId ?? null,
        taggedFriendIds: payload.taggedFriendIds ?? [],
        audience: payload.audience ?? "friends",
        allowJoin: payload.allowJoin ?? false,
        published: true,
      }),
    );
    return this.toDto(saved, userId);
  }

  async saveDraft(userId: string, payload: FeedDraftWrite, now = new Date()): Promise<FeedDraftSaved> {
    const existing = await this.drafts.findOneBy({ authorUserId: userId });
    const fields = {
      eventId: payload.eventId,
      text: payload.text,
      photoUrls: payload.photoUrls ?? [],
      placeId: payload.placeId ?? null,
      taggedFriendIds: payload.taggedFriendIds ?? [],
      audience: payload.audience ?? "friends",
      allowJoin: payload.allowJoin ?? false,
      updatedAt: now,
    };
    const saved = existing ? await this.drafts.save(this.drafts.merge(existing, fields)) : await this.drafts.save(this.drafts.create({ authorUserId: userId, ...fields, createdAt: now }));
    return { savedAt: saved.updatedAt.toISOString() };
  }

  async join(userId: string, postId: string): Promise<BookingWithSeats> {
    const post = await this.requirePost(postId);
    if (!post.allowJoin || !post.eventId) throw new BadRequestException("Join is not allowed");
    return this.bookings.create(userId, post.eventId, undefined, new Date(), undefined, "feed");
  }

  async toggleLike(userId: string, postId: string): Promise<FeedPost> {
    const post = await this.requirePost(postId);
    const existing = await this.likes.findOneBy({ postId, userId });
    if (existing) await this.likes.remove(existing);
    else {
      try {
        await this.likes.save(this.likes.create({ postId, userId }));
      } catch (error) {
        if (!(error instanceof QueryFailedError && error.driverError?.code === "23505")) throw error;
      }
    }
    return this.toDto(post, userId);
  }

  async addComment(userId: string, postId: string, text: string): Promise<FeedPost> {
    const post = await this.requirePost(postId);
    await this.comments.save(this.comments.create({ postId, authorUserId: userId, text }));
    return this.toDto(post, userId);
  }

  async unpublish(id: string): Promise<void> {
    const post = await this.posts.findOneBy({ id });
    if (!post) throw new NotFoundException("Feed post not found");
    post.published = false;
    await this.posts.save(post);
  }

  private async requirePost(id: string): Promise<FeedPostEntity> {
    const post = await this.posts.findOneBy({ id });
    if (!post || post.published === false) throw new NotFoundException("Feed post not found");
    return post;
  }

  private async toDto(post: FeedPostEntity, viewerId: string): Promise<FeedPost> {
    const [dto] = await this.toDtoMany([post], viewerId);
    if (!dto) throw new NotFoundException("Author not found");
    return dto;
  }

  private async toDtoMany(posts: FeedPostEntity[], viewerId: string): Promise<FeedPost[]> {
    if (posts.length === 0) return [];
    const postIds = posts.map((row) => row.id);
    const userIds = [...new Set(posts.flatMap((row) => [row.authorUserId]))];
    const [authors, likeRows, commentRows] = await Promise.all([this.users.find({ where: { id: In(userIds) } }), this.likes.find({ where: { postId: In(postIds) } }), this.comments.find({ where: { postId: In(postIds) } })]);
    const commentAuthorIds = [...new Set(commentRows.map((row) => row.authorUserId))];
    const commentAuthors = commentAuthorIds.length === 0 ? [] : await this.users.find({ where: { id: In(commentAuthorIds) } });
    const userById = new Map([...authors, ...commentAuthors].map((row) => [row.id, row]));
    return posts.flatMap((post) => {
      const author = userById.get(post.authorUserId);
      if (!author) return [];
      const likes = likeRows.filter((row) => row.postId === post.id);
      const comments = commentRows
        .filter((row) => row.postId === post.id)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .flatMap((row) => {
          const commentAuthor = userById.get(row.authorUserId);
          return commentAuthor ? [{ id: row.id, author: toFriendDto(commentAuthor), text: row.text }] : [];
        });
      return [{ id: post.id, author: toFriendDto(author), eventId: post.eventId, text: post.text, photoUrl: post.photoUrl ?? null, placeId: post.placeId ?? null, taggedFriendIds: post.taggedFriendIds ?? [], audience: post.audience ?? "friends", allowJoin: post.allowJoin ?? false, likesCount: likes.length, likedByMe: likes.some((row) => row.userId === viewerId), comments }];
    });
  }
}

type ParticipationBucket = { wantsToGo: number; going: number; mine: ParticipationStatus | null };

function countParticipations(rows: ParticipationEntity[], viewerId: string): Map<string, ParticipationBucket> {
  const map = new Map<string, ParticipationBucket>();
  for (const row of rows) {
    const bucket = map.get(row.eventId) ?? { wantsToGo: 0, going: 0, mine: null };
    if (row.status === "wants_to_go") bucket.wantsToGo += 1;
    if (row.status === "going") bucket.going += 1;
    if (row.userId === viewerId) bucket.mine = row.status;
    map.set(row.eventId, bucket);
  }
  return map;
}

function goingFriendsByPlace(parts: ParticipationEntity[], events: EventEntity[], users: UserEntity[], friendIds: Set<string>): Map<string, ReturnType<typeof toFriendDto>[]> {
  const eventPlace = new Map(events.filter((row) => row.placeId).map((row) => [row.id, row.placeId as string]));
  const userById = new Map(users.map((row) => [row.id, row]));
  const map = new Map<string, ReturnType<typeof toFriendDto>[]>();
  for (const row of parts) {
    if (row.status !== "going" || !friendIds.has(row.userId)) continue;
    const placeId = eventPlace.get(row.eventId);
    const user = userById.get(row.userId);
    if (!placeId || !user) continue;
    const list = map.get(placeId) ?? [];
    if (!list.some((friend) => friend.id === user.id)) list.push(toFriendDto(user));
    map.set(placeId, list);
  }
  return map;
}

function toFriendCard(post: FeedPost, event: EventEntity, place: Place | null, bucket: ParticipationBucket | undefined, waitlist: number, now: Date, createdAt: Date | undefined): FeedCard {
  const counts: FeedCardCounts = {
    wantsToGo: bucket?.wantsToGo ?? 0,
    going: bucket?.going ?? 0,
    waitlist,
    freeSeats: event.capacity === null ? null : Math.max(0, event.capacity - (event.bookedCount ?? 0)),
  };
  return {
    kind: "friend",
    id: post.id,
    author: post.author,
    placeTitle: place?.title ?? null,
    distanceKm: null,
    event: toEventDto(event),
    live: event.endsAt !== null && event.startsAt.getTime() <= now.getTime() && now.getTime() < event.endsAt.getTime(),
    hit: false,
    counts,
    myStatus: bucket?.mine ?? null,
    text: post.text,
    likesCount: post.likesCount,
    likedByMe: post.likedByMe,
    comments: post.comments,
    commentsCount: post.comments.length,
    publishedAt: createdAt ? createdAt.toISOString() : null,
    photoUrl: post.photoUrl ?? null,
  };
}

function toPlaceCard(post: FeedPost, place: Place, createdAt: Date | undefined, goingFriends: ReturnType<typeof toFriendDto>[]): FeedCard {
  return {
    kind: "place",
    id: post.id,
    place,
    verified: false,
    distanceKm: null,
    travelMinutes: null,
    rating: null,
    pricePerHourRub: null,
    slotLabel: null,
    offerLabel: null,
    goingFriends,
    title: post.text,
    text: post.text,
    quote: null,
    likesCount: post.likesCount,
    likedByMe: post.likedByMe,
    commentsCount: post.comments.length,
    myStatus: null,
    publishedAt: (createdAt ?? new Date(0)).toISOString(),
  };
}
