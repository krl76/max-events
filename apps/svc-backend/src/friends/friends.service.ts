// START_MODULE_CONTRACT
// PURPOSE: Friend graph sync, "your people are going" activity, and per-event friend counters.
// SCOPE: Replace-on-sync from MaxBotClient.listFriends or other app users; activity grouped by friend; event summary.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, ../max-bot, ../users, ../events, ../participations
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - FriendsService - sync, list, activity, eventFriends, friendIds
// - toFriendDto - map UserEntity to api-contracts Friend
// END_MODULE_MAP

import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { EventFriendsSummary, Friend, FriendActivityByFriend } from "@max-events/api-contracts";
import { toEventDto } from "../events/events.service";
import { EventEntity } from "../events/event.entity";
import { MaxBotClient } from "../max-bot/max-bot.client";
import { ParticipationEntity } from "../participations/participation.entity";
import { UserEntity } from "../users/user.entity";
import { FriendshipEntity } from "./friendship.entity";

@Injectable()
export class FriendsService {
  constructor(
    @InjectRepository(FriendshipEntity)
    private readonly friendships: Repository<FriendshipEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(ParticipationEntity)
    private readonly participations: Repository<ParticipationEntity>,
    @InjectRepository(EventEntity)
    private readonly events: Repository<EventEntity>,
    private readonly bot: MaxBotClient,
  ) {}

  async friendIds(userId: string): Promise<Set<string>> {
    const rows = await this.friendships.find({ where: { userId } });
    return new Set(rows.map((row) => row.friendUserId));
  }

  async list(userId: string): Promise<Friend[]> {
    const ids = await this.friendIds(userId);
    if (ids.size === 0) return [];
    const users = await this.users.find();
    const byId = new Map(users.map((row) => [row.id, row]));
    return [...ids].flatMap((id) => {
      const user = byId.get(id);
      return user ? [toFriendDto(user)] : [];
    });
  }

  async sync(userId: string): Promise<Friend[]> {
    const me = await this.users.findOneBy({ id: userId });
    if (!me) throw new NotFoundException("User not found");
    const fromBot = await this.bot.listFriends(me.maxUserId);
    const all = await this.users.find();
    const nextUsers = all.filter((row) => row.id !== userId && (fromBot === null || fromBot.includes(row.maxUserId)));
    const nextIds = new Set(nextUsers.map((row) => row.id));
    const existing = await this.friendships.find({ where: { userId } });
    for (const row of existing) {
      if (!nextIds.has(row.friendUserId)) await this.friendships.delete({ id: row.id });
    }
    const have = new Set(existing.filter((row) => nextIds.has(row.friendUserId)).map((row) => row.friendUserId));
    for (const friend of nextUsers) {
      if (have.has(friend.id)) continue;
      await this.friendships.save(this.friendships.create({ userId, friendUserId: friend.id }));
    }
    return this.list(userId);
  }

  async activity(userId: string): Promise<FriendActivityByFriend[]> {
    const friends = await this.list(userId);
    if (friends.length === 0) return [];
    const friendIds = new Set(friends.map((row) => row.id));
    const rows = (await this.participations.find()).filter((row) => friendIds.has(row.userId));
    const events = await this.events.find();
    const eventById = new Map(events.filter((row) => row.published).map((row) => [row.id, row]));
    const groups = new Map<string, FriendActivityByFriend>();
    for (const friend of friends) groups.set(friend.id, { friend, events: [] });
    for (const row of rows) {
      const event = eventById.get(row.eventId);
      const group = groups.get(row.userId);
      if (!event || !group) continue;
      group.events.push({ event: toEventDto(event), participationStatus: row.status });
    }
    const nonempty = [...groups.values()].filter((group) => group.events.length > 0);
    for (const group of nonempty) group.events.sort((a, b) => a.event.startsAt.localeCompare(b.event.startsAt));
    nonempty.sort((a, b) => a.events[0].event.startsAt.localeCompare(b.events[0].event.startsAt) || a.friend.name.localeCompare(b.friend.name));
    return nonempty;
  }

  async eventFriends(userId: string, eventId: string): Promise<EventFriendsSummary> {
    const event = await this.events.findOneBy({ id: eventId });
    if (!event) throw new NotFoundException("Event not found");
    const ids = await this.friendIds(userId);
    const rows = (await this.participations.find({ where: { eventId } })).filter((row) => ids.has(row.userId));
    const users = await this.users.find();
    const userById = new Map(users.map((row) => [row.id, row]));
    const friends = rows.flatMap((row) => {
      const user = userById.get(row.userId);
      return user ? [{ friend: toFriendDto(user), participationStatus: row.status }] : [];
    });
    return {
      friends,
      going: friends.filter((row) => row.participationStatus === "going").length,
      lookingForCompany: friends.filter((row) => row.participationStatus === "looking_for_company").length,
    };
  }
}

export function toFriendDto(user: UserEntity): Friend {
  return {
    id: user.id,
    name: user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName,
    avatarUrl: user.avatarUrl,
  };
}
