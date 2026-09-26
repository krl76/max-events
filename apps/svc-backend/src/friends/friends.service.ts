// START_MODULE_CONTRACT
// PURPOSE: Friend graph sync, "your people are going" activity, and per-event friend counters.
// SCOPE: Replace-on-sync from MaxBotClient.listFriends; without a list the graph is left untouched unless FRIENDS_DEMO_ALL_USERS opts into the demo fallback, which only a development or test NODE_ENV can unlock; activity grouped by friend; event summary.
// DEPENDS: @nestjs/common, @nestjs/config, @nestjs/typeorm, typeorm, @max-events/api-contracts, ../max-bot, ../users, ../events, ../participations
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - FriendsService - sync, list, activity, eventFriends, friendIds
// - toFriendDto - map UserEntity to api-contracts Friend
// END_MODULE_MAP

import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import type { EventFriendsSummary, Friend, FriendActivityByFriend, FriendSuggestion, FriendsSyncStatus } from "@max-events/api-contracts";
import { toEventDto } from "../events/event.mapper";
import { EventEntity } from "../events/event.entity";
import { MaxBotClient } from "../max-bot/max-bot.client";
import { ParticipationEntity } from "../participations/participation.entity";
import { SubscriptionEntity } from "../subscriptions/subscription.entity";
import { UserEntity } from "../users/user.entity";
import { FriendshipEntity } from "./friendship.entity";

@Injectable()
export class FriendsService {
  private readonly logger = new Logger(FriendsService.name);
  private demoFallbackRefused = false;

  constructor(
    @InjectRepository(FriendshipEntity)
    private readonly friendships: Repository<FriendshipEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(ParticipationEntity)
    private readonly participations: Repository<ParticipationEntity>,
    @InjectRepository(EventEntity)
    private readonly events: Repository<EventEntity>,
    @Inject(MaxBotClient) private readonly bot: MaxBotClient,
    @Inject(ConfigService) private readonly config: ConfigService,
    @InjectRepository(SubscriptionEntity) private readonly subscriptions: Repository<SubscriptionEntity>,
  ) {}

  async friendIds(userId: string): Promise<Set<string>> {
    const rows = await this.friendships.find({ where: { userId } });
    return new Set(rows.map((row) => row.friendUserId));
  }

  async closeFriendIds(userId: string): Promise<Set<string>> {
    const rows = await this.friendships.find({ where: { userId, closeFriend: true } });
    return new Set(rows.map((row) => row.friendUserId));
  }

  /** Authors who put this viewer on their close-friends list. Their close-friends stories are visible here. */
  async authorsWhoMarkedClose(viewerId: string): Promise<Set<string>> {
    const rows = await this.friendships.find({ where: { friendUserId: viewerId, closeFriend: true } });
    return new Set(rows.map((row) => row.userId));
  }

  async isCloseFriend(userId: string, friendUserId: string): Promise<boolean> {
    const row = await this.friendships.findOneBy({ userId, friendUserId });
    return row?.closeFriend === true;
  }

  async setCloseFriend(userId: string, friendUserId: string, close: boolean): Promise<boolean> {
    if (userId === friendUserId) throw new BadRequestException("Invalid close friend");
    const person = await this.users.findOneBy({ id: friendUserId });
    if (!person) throw new NotFoundException("User not found");
    const existing = await this.friendships.findOneBy({ userId, friendUserId });
    if (!existing) {
      if (!close) return false;
      await this.friendships.save(this.friendships.create({ userId, friendUserId, closeFriend: true }));
      return true;
    }
    existing.closeFriend = close;
    await this.friendships.save(existing);
    return close;
  }

  async list(userId: string): Promise<Friend[]> {
    return this.friendsOfIds(await this.friendIds(userId));
  }

  private async friendsOfIds(ids: Set<string>): Promise<Friend[]> {
    if (ids.size === 0) return [];
    const users = await this.users.find();
    const byId = new Map(users.map((row) => [row.id, row]));
    return [...ids].flatMap((id) => {
      const user = byId.get(id);
      return user ? [toFriendDto(user)] : [];
    });
  }

  async following(userId: string): Promise<Friend[]> {
    const me = await this.users.findOneBy({ id: userId });
    if (!me) throw new NotFoundException("User not found");
    const rows = await this.subscriptions.find({ where: { userId, type: "user" } });
    return this.friendsOfIds(new Set(rows.flatMap((row) => (row.targetUserId ? [row.targetUserId] : []))));
  }

  async followers(userId: string): Promise<Friend[]> {
    const me = await this.users.findOneBy({ id: userId });
    if (!me) throw new NotFoundException("User not found");
    const rows = await this.subscriptions.find({ where: { targetUserId: userId, type: "user" } });
    return this.friendsOfIds(new Set(rows.map((row) => row.userId)));
  }

  async sync(userId: string): Promise<Friend[]> {
    const me = await this.users.findOneBy({ id: userId });
    if (!me) throw new NotFoundException("User not found");
    const fromBot = await this.bot.listFriends(me.maxUserId);
    // No list from MAX means no knowledge of who this user's friends are. Inventing the whole user
    // table as friends inflated the social counters and let anyone discover every other user, so
    // the graph is left exactly as it is unless the demo switch is deliberately on.
    if (fromBot === null && !this.demoFallbackEnabled()) return this.list(userId);
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
    me.friendsSyncedAt = new Date();
    await this.users.save(me);
    return this.list(userId);
  }

  async syncStatus(userId: string): Promise<FriendsSyncStatus> {
    const me = await this.users.findOneBy({ id: userId });
    if (!me) throw new NotFoundException("User not found");
    return { lastSyncedAt: me.friendsSyncedAt ? me.friendsSyncedAt.toISOString() : null, friends: await this.list(userId) };
  }

  async suggestions(userId: string): Promise<FriendSuggestion[]> {
    const me = await this.users.findOneBy({ id: userId });
    if (!me) throw new NotFoundException("User not found");
    const fromBot = await this.bot.listFriends(me.maxUserId);
    if (fromBot === null || fromBot.length === 0) return [];
    const following = await this.friendIds(userId);
    const users = await this.users.find({ where: { maxUserId: In(fromBot) } });
    return users
      .filter((row) => row.id !== userId && fromBot.includes(row.maxUserId))
      .map((row) => ({
        friend: toFriendDto(row),
        hint: following.has(row.id) ? "уже в друзьях" : "из контактов MAX",
        following: following.has(row.id),
      }))
      .slice(0, 20);
  }

  async replaceFollows(userId: string, userIds: string[]): Promise<string[]> {
    const me = await this.users.findOneBy({ id: userId });
    if (!me) throw new NotFoundException("User not found");
    // Follows live on subscriptions (type=user). Friendships are the MAX contact list
    // (GET /friends) and must survive an unfollow.
    const unique = [...new Set(userIds)].filter((id) => id !== userId);
    const known = new Set((await this.users.find()).map((row) => row.id));
    const nextIds = unique.filter((id) => known.has(id));
    const next = new Set(nextIds);
    const existing = await this.subscriptions.find({ where: { userId, type: "user" } });
    for (const row of existing) {
      if (row.targetUserId && !next.has(row.targetUserId)) await this.subscriptions.delete({ id: row.id });
    }
    const have = new Set(existing.flatMap((row) => (row.targetUserId && next.has(row.targetUserId) ? [row.targetUserId] : [])));
    for (const id of nextIds) {
      if (have.has(id)) continue;
      await this.subscriptions.save(this.subscriptions.create({ userId, type: "user", organizerUserId: null, placeId: null, targetUserId: id, interest: null }));
    }
    return nextIds;
  }

  private demoFallbackEnabled(): boolean {
    if (this.config.get<boolean>("FRIENDS_DEMO_ALL_USERS") !== true) return false;
    // The switch makes every app user everyone's friend, so on a real host it would hand each visitor
    // the whole user table. The environment has to say out loud that it is not a real host; anything
    // other than development or test — including an unset NODE_ENV — counts as production.
    const environment = this.config.get<string>("NODE_ENV")?.toLowerCase();
    if (environment === "development" || environment === "test") return true;
    // sync() runs inside the auth guard, so this is reached once per request: say it once per process.
    if (!this.demoFallbackRefused) {
      this.demoFallbackRefused = true;
      this.logger.error(`FRIENDS_DEMO_ALL_USERS is on but NODE_ENV is "${environment ?? "unset"}": the demo friend graph stays off. Set NODE_ENV=development to use it locally.`);
    }
    return false;
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
    ...(user.username ? { username: user.username } : {}),
  };
}
