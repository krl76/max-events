// START_MODULE_CONTRACT
// PURPOSE: Reverse discovery — places friends visited that the viewer has not, with privacy gates.
// SCOPE: summary() unique unseen places by friend; route() chronological unseen trail; hidden history/routes skipped.
// DEPENDS: typeorm, @max-events/api-contracts, check-ins/events/places/friends/profiles
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - DiscoveryService - summary and friend route
// END_MODULE_MAP

import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import type { DiscoveryResponse, FriendRoute } from "@max-events/api-contracts";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { FriendsService, toFriendDto } from "../friends/friends.service";
import { toPlaceDto } from "../places/places.service";
import { PlaceEntity } from "../places/place.entity";
import { ProfileEntity } from "../users/profile.entity";
import { readPrivacy } from "../users/profiles.service";
import { UserEntity } from "../users/user.entity";

@Injectable()
export class DiscoveryService {
  constructor(
    @InjectRepository(CheckInEntity) private readonly checkIns: Repository<CheckInEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(PlaceEntity) private readonly places: Repository<PlaceEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(ProfileEntity) private readonly profiles: Repository<ProfileEntity>,
    @Inject(FriendsService) private readonly friends: FriendsService,
  ) {}

  async summary(viewerId: string): Promise<DiscoveryResponse> {
    const ctx = await this.loadContext(viewerId);
    const byFriend = [];
    const unique = new Set<string>();
    for (const friendId of ctx.friendIds) {
      const privacy = readPrivacy(ctx.profileById.get(friendId));
      if (privacy.visitHistory === "hidden") continue;
      const friend = ctx.userById.get(friendId);
      if (!friend) continue;
      const unseen = unseenPlaces(ctx.visitsByUser.get(friendId) ?? [], ctx.myPlaceIds, ctx.placeById, ctx.eventById);
      for (const place of unseen) unique.add(place.id);
      if (unseen.length === 0) continue;
      byFriend.push({ friend: toFriendDto(friend), newPlacesCount: unseen.length, places: unseen.map(toPlaceDto) });
    }
    byFriend.sort((a, b) => b.newPlacesCount - a.newPlacesCount || a.friend.name.localeCompare(b.friend.name));
    return { newPlacesCount: unique.size, byFriend };
  }

  async route(viewerId: string, friendId: string): Promise<FriendRoute> {
    if (viewerId === friendId) throw new ForbiddenException("Cannot load own reverse-discovery route");
    const ctx = await this.loadContext(viewerId);
    if (!ctx.friendIds.has(friendId)) throw new NotFoundException("Friend not found");
    const friend = ctx.userById.get(friendId);
    if (!friend) throw new NotFoundException("Friend not found");
    const privacy = readPrivacy(ctx.profileById.get(friendId));
    if (privacy.routes === "hidden" || privacy.visitHistory === "hidden") throw new ForbiddenException("Friend hid their route");
    const unseen = unseenPlaces(ctx.visitsByUser.get(friendId) ?? [], ctx.myPlaceIds, ctx.placeById, ctx.eventById);
    return { friend: toFriendDto(friend), places: unseen.map(toPlaceDto) };
  }

  private async loadContext(viewerId: string) {
    const friendIds = await this.friends.friendIds(viewerId);
    const userIds = [viewerId, ...friendIds];
    const checkIns = userIds.length === 0 ? [] : await this.checkIns.find({ where: { userId: In(userIds) } });
    const eventIds = [...new Set(checkIns.map((row) => row.eventId).filter((id): id is string => id !== null))];
    const events = eventIds.length === 0 ? [] : await this.events.find({ where: { id: In(eventIds) } });
    const eventById = new Map(events.map((row) => [row.id, row]));
    const placeIds = [
      ...new Set(
        checkIns.flatMap((row) => {
          if (row.placeId) return [row.placeId];
          const fromEvent = row.eventId ? eventById.get(row.eventId)?.placeId : null;
          return fromEvent ? [fromEvent] : [];
        }),
      ),
    ];
    const places = placeIds.length === 0 ? [] : await this.places.find({ where: { id: In(placeIds) } });
    const placeById = new Map(places.map((row) => [row.id, row]));
    const [users, profiles] = await Promise.all([
      userIds.length === 0 ? Promise.resolve([] as UserEntity[]) : this.users.find({ where: { id: In(userIds) } }),
      userIds.length === 0 ? Promise.resolve([] as ProfileEntity[]) : this.profiles.find({ where: { userId: In(userIds) } }),
    ]);
    const visitsByUser = new Map<string, CheckInEntity[]>();
    for (const row of checkIns) {
      const list = visitsByUser.get(row.userId) ?? [];
      list.push(row);
      visitsByUser.set(row.userId, list);
    }
    for (const list of visitsByUser.values()) list.sort((a, b) => a.checkedInAt.getTime() - b.checkedInAt.getTime() || a.id.localeCompare(b.id));
    const myPlaceIds = new Set(placeIdsOf(visitsByUser.get(viewerId) ?? [], eventById));
    return {
      friendIds,
      eventById,
      placeById,
      userById: new Map(users.map((row) => [row.id, row])),
      profileById: new Map(profiles.map((row) => [row.userId, row])),
      visitsByUser,
      myPlaceIds,
    };
  }
}

function placeIdsOf(rows: CheckInEntity[], eventById: Map<string, EventEntity>): string[] {
  return rows.flatMap((row) => {
    if (row.placeId) return [row.placeId];
    const fromEvent = row.eventId ? eventById.get(row.eventId)?.placeId : null;
    return fromEvent ? [fromEvent] : [];
  });
}

function unseenPlaces(rows: CheckInEntity[], myPlaceIds: Set<string>, placeById: Map<string, PlaceEntity>, eventById: Map<string, EventEntity>): PlaceEntity[] {
  const seen = new Set<string>();
  const out: PlaceEntity[] = [];
  for (const row of rows) {
    const id = row.placeId ?? (row.eventId ? eventById.get(row.eventId)?.placeId : null) ?? null;
    if (!id || myPlaceIds.has(id) || seen.has(id)) continue;
    const place = placeById.get(id);
    if (!place) continue;
    seen.add(id);
    out.push(place);
  }
  return out;
}
