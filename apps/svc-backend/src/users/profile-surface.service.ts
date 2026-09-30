// START_MODULE_CONTRACT
// PURPOSE: Profile screen aggregates — counters, visited places, author posts, app settings.
// SCOPE: GET counters/visited-places/posts; GET/PATCH app-settings (own only). Unpublished posts stay off the grid.
// DEPENDS: typeorm, @max-events/api-contracts, check-ins, events, places, feed
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ProfileSurfaceService - counters, visitedPlaces, listPosts, getAppSettings, updateAppSettings
// END_MODULE_MAP

import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { DEFAULT_APP_SETTINGS, DEFAULT_PRIVACY, DEFAULT_SMART_ALERTS, type AppSettings, type ProfileCounters, type ProfilePost, type UpdateAppSettings, type VisitedPlace } from "@max-events/api-contracts";
import { DEFAULT_PROFILE_CITY } from "./profiles.service";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { FeedCommentEntity, FeedLikeEntity, FeedPostEntity } from "../feed/feed-post.entity";
import { PlaceEntity } from "../places/place.entity";
import { ProfileEntity } from "./profile.entity";
import { UserEntity } from "./user.entity";

@Injectable()
export class ProfileSurfaceService {
  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(ProfileEntity) private readonly profiles: Repository<ProfileEntity>,
    @InjectRepository(CheckInEntity) private readonly checkIns: Repository<CheckInEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(PlaceEntity) private readonly places: Repository<PlaceEntity>,
    @InjectRepository(FeedPostEntity) private readonly posts: Repository<FeedPostEntity>,
    @InjectRepository(FeedLikeEntity) private readonly likes: Repository<FeedLikeEntity>,
    @InjectRepository(FeedCommentEntity) private readonly comments: Repository<FeedCommentEntity>,
  ) {}

  async counters(userId: string): Promise<ProfileCounters> {
    await this.requireUser(userId);
    const mine = await this.checkIns.find({ where: { userId } });
    const eventIds = [...new Set(mine.map((row) => row.eventId).filter((id): id is string => id !== null))];
    const events = eventIds.length === 0 ? [] : await this.events.find({ where: { id: In(eventIds) } });
    const placeIds = new Set<string>();
    for (const row of mine) if (row.placeId) placeIds.add(row.placeId);
    for (const event of events) if (event.placeId) placeIds.add(event.placeId);
    const others = eventIds.length === 0 ? [] : await this.checkIns.find({ where: { eventId: In(eventIds) } });
    const shared = new Set(others.filter((row) => row.userId !== userId && row.eventId).map((row) => row.eventId as string));
    return { userId, eventsCount: eventIds.length, placesCount: placeIds.size, companiesCount: shared.size };
  }

  async visitedPlaces(userId: string): Promise<VisitedPlace[]> {
    await this.requireUser(userId);
    const mine = await this.checkIns.find({ where: { userId } });
    const eventIds = [...new Set(mine.map((row) => row.eventId).filter((id): id is string => id !== null))];
    const events = eventIds.length === 0 ? [] : await this.events.find({ where: { id: In(eventIds) } });
    const eventPlace = new Map(events.filter((row) => row.placeId).map((row) => [row.id, row.placeId as string]));
    const counts = new Map<string, number>();
    for (const row of mine) {
      const placeId = row.placeId ?? (row.eventId ? eventPlace.get(row.eventId) : undefined);
      if (!placeId) continue;
      counts.set(placeId, (counts.get(placeId) ?? 0) + 1);
    }
    const ids = [...counts.keys()];
    const places = ids.length === 0 ? [] : await this.places.find({ where: { id: In(ids) } });
    return places
      .map((place) => ({ placeId: place.id, title: place.title, visits: counts.get(place.id) ?? 0, photoUrl: place.logoUrl ?? null }))
      .filter((row) => row.visits > 0)
      .sort((a, b) => b.visits - a.visits || a.title.localeCompare(b.title) || a.placeId.localeCompare(b.placeId));
  }

  async listPosts(userId: string): Promise<ProfilePost[]> {
    await this.requireUser(userId);
    const rows = await this.posts.find({ where: { authorUserId: userId, published: true }, order: { createdAt: "DESC" } });
    if (rows.length === 0) return [];
    const eventIds = [...new Set(rows.flatMap((row) => (row.eventId ? [row.eventId] : [])))];
    const postIds = rows.map((row) => row.id);
    const [events, likeRows, commentRows] = await Promise.all([eventIds.length === 0 ? Promise.resolve([]) : this.events.find({ where: { id: In(eventIds) } }), this.likes.find({ where: { postId: In(postIds) } }), this.comments.find({ where: { postId: In(postIds) } })]);
    const eventById = new Map(events.map((row) => [row.id, row]));
    return rows.flatMap((row) => {
      const event = row.eventId ? eventById.get(row.eventId) : undefined;
      if (row.eventId && !event) return [];
      return [
        {
          postId: row.id,
          eventId: event?.id ?? null,
          eventTitle: event?.title ?? row.text,
          category: event?.category ?? "afisha",
          photoUrl: row.photoUrl ?? null,
          likesCount: likeRows.filter((like) => like.postId === row.id).length,
          commentsCount: commentRows.filter((comment) => comment.postId === row.id).length,
        },
      ];
    });
  }

  async getAppSettings(userId: string, requesterId: string): Promise<AppSettings> {
    if (userId !== requesterId) throw new ForbiddenException("Cannot read another user's app settings");
    await this.requireUser(userId);
    const profile = await this.profiles.findOneBy({ userId });
    return { userId, ...DEFAULT_APP_SETTINGS, ...(profile?.appSettings ?? {}) };
  }

  async updateAppSettings(userId: string, requesterId: string, patch: UpdateAppSettings): Promise<AppSettings> {
    if (userId !== requesterId) throw new ForbiddenException("Cannot edit another user's app settings");
    await this.requireUser(userId);
    let profile = await this.profiles.findOneBy({ userId });
    const next = { ...DEFAULT_APP_SETTINGS, ...(profile?.appSettings ?? {}), ...patch };
    if (!profile) {
      profile = this.profiles.create({
        userId,
        city: DEFAULT_PROFILE_CITY,
        interests: [],
        smartAlerts: { ...DEFAULT_SMART_ALERTS },
        privacy: { ...DEFAULT_PRIVACY },
        recommendationsEnabled: true,
        appSettings: next,
      });
    } else {
      profile.appSettings = next;
    }
    await this.profiles.save(profile);
    return { userId, ...next };
  }

  private async requireUser(userId: string): Promise<void> {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new NotFoundException("User not found");
  }
}
