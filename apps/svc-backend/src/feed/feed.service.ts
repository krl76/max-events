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

import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FindOperator, In, QueryFailedError, Repository } from "typeorm";
import type { BookingWithSeats, CreateFeedPostWrite, FeedCard, FeedCardCounts, FeedDraftSaved, FeedDraftWrite, FeedPost, FeedRepost, ParticipationStatus, Place } from "@max-events/api-contracts";
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
import { FeedCommentEntity, FeedLikeEntity, FeedPostEntity, FeedPostGoingEntity } from "./feed-post.entity";

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
    @InjectRepository(FeedPostGoingEntity) private readonly going: Repository<FeedPostGoingEntity>,
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
    const eventIds = [...new Set(posts.flatMap((post) => (post.eventId ? [post.eventId] : [])))];
    const events = eventIds.length === 0 ? [] : await this.events.find({ where: { id: In(eventIds), published: true } });
    const eventById = new Map(events.filter((row) => row.startsAt instanceof Date).map((row) => [row.id, row]));
    const placeIds = [...new Set([...events.map((row) => row.placeId), ...posts.map((post) => post.placeId ?? null)].filter((id): id is string => id !== null))];
    const [placeDtos, waitlists, parts] = await Promise.all([
      this.places.findByIds(placeIds),
      eventIds.length === 0 ? Promise.resolve(new Map<string, number>()) : this.waitlist.queueCountsByEventIds(eventIds),
      eventIds.length === 0 ? Promise.resolve([] as ParticipationEntity[]) : this.participations.find({ where: { eventId: In(eventIds) } }),
    ]);
    const placeById = new Map(placeDtos.map((place) => [place.id, place]));
    const counts = countParticipations(parts, viewerId);
    const rowById = new Map(rows.map((row) => [row.id, row]));
    const postIds = posts.map((post) => post.id);
    const [friendRows, goingRows] = await Promise.all([this.friendships.find({ where: { userId: viewerId } }), postIds.length === 0 ? Promise.resolve([]) : this.going.find({ where: { postId: In(postIds) } })]);
    const friendIds = new Set(friendRows.map((row) => row.friendUserId));
    return posts.flatMap((post) => {
      const event = post.eventId ? eventById.get(post.eventId) : undefined;
      if (post.eventId && !event) return [];
      const place = (post.placeId ? placeById.get(post.placeId) : undefined) ?? (event?.placeId ? placeById.get(event.placeId) : undefined);
      const createdAt = rowById.get(post.id)?.createdAt;
      const marks = goingRows.filter((row) => row.postId === post.id);
      const goingByMe = marks.some((row) => row.userId === viewerId);
      // «N идёт» is a friends-only line. A stranger does not see who is going, even as a number.
      const visible = post.author.id === viewerId || friendIds.has(post.author.id);
      const friendsGoing = visible ? marks.filter((row) => row.userId === viewerId || friendIds.has(row.userId)).length : null;
      // Площадка события остаётся подписью места. Карточка площадки со слотами здесь прятала фото и писала текст дважды.
      return [toFriendCard(post, event ?? null, place ?? null, post.eventId ? counts.get(post.eventId) : undefined, post.eventId ? (waitlists.get(post.eventId) ?? 0) : 0, now, createdAt, friendsGoing, goingByMe)];
    });
  }

  async create(userId: string, payload: CreateFeedPostWrite): Promise<FeedPost> {
    await this.publishers.assertCanPublish(userId);
    const eventId = payload.eventId ?? null;
    if (eventId !== null) {
      const event = await this.events.findOneBy({ id: eventId });
      if (!event || event.published === false) throw new NotFoundException("Event not found");
    }
    const photos = (payload.photoUrls ?? []).slice(0, 3);
    const photoUrl = payload.photoUrl ?? photos[0] ?? null;
    const saved = await this.posts.save(
      this.posts.create({
        authorUserId: userId,
        eventId,
        text: payload.text,
        photoUrl,
        photoUrls: photos.length > 0 ? photos : photoUrl ? [photoUrl] : [],
        placeId: payload.placeId ?? null,
        locationLabel: payload.locationLabel ?? null,
        taggedFriendIds: payload.taggedFriendIds ?? [],
        audience: payload.audience ?? "friends",
        allowJoin: payload.allowJoin ?? false,
        published: true,
        repostOfPostId: null,
        repostOfEventId: null,
      }),
    );
    return this.toDto(saved, userId);
  }

  /** One repost of someone else's post. The original caption and comments stay with the original author. */
  async repostPost(userId: string, postId: string): Promise<FeedPost> {
    await this.publishers.assertCanPublish(userId);
    const source = await this.requirePost(postId);
    if (source.authorUserId === userId) throw new BadRequestException("Cannot repost your own post");
    const duplicate = await this.posts.findOneBy({ authorUserId: userId, repostOfPostId: source.id, published: true });
    if (duplicate) throw new ConflictException("Already reposted");
    try {
      const saved = await this.posts.save(
        this.posts.create({
          authorUserId: userId,
          eventId: source.eventId,
          text: "",
          photoUrl: null,
          photoUrls: [],
          placeId: source.placeId ?? null,
          locationLabel: source.locationLabel ?? null,
          taggedFriendIds: [],
          audience: "friends",
          allowJoin: false,
          published: true,
          repostOfPostId: source.id,
          repostOfEventId: null,
        }),
      );
      return this.toDto(saved, userId);
    } catch (error) {
      if (error instanceof QueryFailedError && error.driverError?.code === "23505") throw new ConflictException("Already reposted");
      throw error;
    }
  }

  /** Share an event into the feed once. A second tap does not create another post under the same name. */
  async repostEvent(userId: string, eventId: string): Promise<FeedPost> {
    await this.publishers.assertCanPublish(userId);
    const event = await this.events.findOneBy({ id: eventId });
    if (!event || event.published === false) throw new NotFoundException("Event not found");
    const duplicate = await this.posts.findOneBy({ authorUserId: userId, repostOfEventId: eventId, published: true });
    if (duplicate) throw new ConflictException("Already reposted");
    try {
      const saved = await this.posts.save(
        this.posts.create({
          authorUserId: userId,
          eventId,
          text: "",
          photoUrl: null,
          photoUrls: [],
          placeId: event.placeId,
          locationLabel: null,
          taggedFriendIds: [],
          audience: "friends",
          allowJoin: false,
          published: true,
          repostOfPostId: null,
          repostOfEventId: eventId,
        }),
      );
      return this.toDto(saved, userId);
    } catch (error) {
      if (error instanceof QueryFailedError && error.driverError?.code === "23505") throw new ConflictException("Already reposted");
      throw error;
    }
  }

  /** «Я иду» on this post only. It does not change the viewer's status on the event or on any other post. */
  async toggleGoing(userId: string, postId: string): Promise<FeedPost> {
    const post = await this.requirePost(postId);
    const existing = await this.going.findOneBy({ postId, userId });
    if (existing) await this.going.remove(existing);
    else {
      try {
        await this.going.save(this.going.create({ postId, userId }));
      } catch (error) {
        if (!(error instanceof QueryFailedError && error.driverError?.code === "23505")) throw error;
      }
    }
    return this.toDto(post, userId);
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

  async addComment(userId: string, postId: string, text: string, parentId?: string | null): Promise<FeedPost> {
    const post = await this.requirePost(postId);
    let rootId: string | null = parentId ?? null;
    if (rootId !== null) {
      const parent = await this.comments.findOneBy({ id: rootId });
      if (!parent || parent.postId !== postId) throw new BadRequestException("Invalid comment payload");
      // One level, as in VK and TikTok: a reply to a reply hangs under the root comment.
      rootId = parent.parentId ?? parent.id;
    }
    await this.comments.save(this.comments.create({ postId, authorUserId: userId, text, parentId: rootId }));
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
    const built = posts.flatMap((post) => {
      const author = userById.get(post.authorUserId);
      if (!author) return [];
      const likes = likeRows.filter((row) => row.postId === post.id);
      const comments = commentRows
        .filter((row) => row.postId === post.id)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .flatMap((row) => {
          const commentAuthor = userById.get(row.authorUserId);
          return commentAuthor ? [{ id: row.id, author: toFriendDto(commentAuthor), text: row.text, parentId: row.parentId ?? null }] : [];
        });
      const photoUrls = post.photoUrls && post.photoUrls.length > 0 ? post.photoUrls : post.photoUrl ? [post.photoUrl] : [];
      return [{ id: post.id, author: toFriendDto(author), eventId: post.eventId ?? null, text: post.text, photoUrl: photoUrls[0] ?? null, photoUrls, placeId: post.placeId ?? null, locationLabel: post.locationLabel ?? null, taggedFriendIds: post.taggedFriendIds ?? [], audience: post.audience ?? "friends", allowJoin: post.allowJoin ?? false, likesCount: likes.length, likedByMe: likes.some((row) => row.userId === viewerId), comments, repostOf: null as FeedRepost | null, repostOfPostId: post.repostOfPostId ?? null }];
    });
    return this.withReposts(built);
  }

  /** Attach the original author and caption. Comments are not copied: they stay on the source post. */
  private async withReposts(posts: Array<FeedPost & { repostOfPostId: string | null }>): Promise<FeedPost[]> {
    const ids = [...new Set(posts.flatMap((post) => (post.repostOfPostId ? [post.repostOfPostId] : [])))];
    const originals = ids.length === 0 ? [] : await this.posts.find({ where: { id: In(ids) } });
    const authorIds = [...new Set(originals.map((row) => row.authorUserId))];
    const authors = authorIds.length === 0 ? [] : await this.users.find({ where: { id: In(authorIds) } });
    const authorById = new Map(authors.map((row) => [row.id, row]));
    const originalById = new Map(originals.map((row) => [row.id, row]));
    return posts.map((post) => {
      const sourceId = post.repostOfPostId;
      const source = sourceId ? originalById.get(sourceId) : undefined;
      const author = source ? authorById.get(source.authorUserId) : undefined;
      const rest: FeedPost = { ...post, repostOf: source && author ? { postId: source.id, author: toFriendDto(author), text: source.text, photoUrl: source.photoUrl } : null };
      return rest;
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

function toFriendCard(post: FeedPost, event: EventEntity | null, place: Place | null, bucket: ParticipationBucket | undefined, waitlist: number, now: Date, createdAt: Date | undefined, friendsGoing: number | null, goingByMe: boolean): FeedCard {
  const counts: FeedCardCounts = event
    ? {
        wantsToGo: bucket?.wantsToGo ?? 0,
        going: bucket?.going ?? 0,
        waitlist,
        freeSeats: event.capacity === null ? null : Math.max(0, event.capacity - (event.bookedCount ?? 0)),
      }
    : { wantsToGo: null, going: null, waitlist: null, freeSeats: null };
  const photos = post.photoUrls && post.photoUrls.length > 0 ? post.photoUrls : post.photoUrl ? [post.photoUrl] : [];
  return {
    kind: "friend",
    id: post.id,
    author: post.author,
    placeTitle: place?.title ?? post.locationLabel ?? null,
    locationLabel: post.locationLabel ?? null,
    distanceKm: null,
    event: event ? toEventDto(event) : null,
    photoUrls: photos,
    live: event !== null && event.endsAt !== null && event.startsAt.getTime() <= now.getTime() && now.getTime() < event.endsAt.getTime(),
    hit: false,
    counts,
    myStatus: bucket?.mine ?? null,
    text: post.text,
    likesCount: post.likesCount,
    likedByMe: post.likedByMe,
    comments: post.comments,
    commentsCount: post.comments.length,
    publishedAt: createdAt ? createdAt.toISOString() : null,
    photoUrl: photos[0] ?? null,
    friendsGoing,
    goingByMe,
    repostOf: post.repostOf ?? null,
  };
}
