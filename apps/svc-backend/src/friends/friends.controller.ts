// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for friend graph sync, activity feed, and per-event friend summary.
// SCOPE: POST /friends/sync, GET /friends, GET /friends/activity, GET /friends/suggestions, GET /friends/sync, PUT /friends/follows, GET /users/:id/following, GET /users/:id/followers, GET /events/:eventId/friends; CurrentUser identity.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth/auth.guard, ./friends.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - FriendsController - /friends list, sync, activity
// - UserGraphController - GET /users/:id/following and /followers
// - EventFriendsController - /events/:eventId/friends summary
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Put } from "@nestjs/common";
import { ReplaceFollowsWriteSchema, type EventFriendsSummary, type Friend, type FriendActivityByFriend, type FriendSuggestion, type FriendsSyncStatus } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { FriendsService } from "./friends.service";

@Controller("friends")
export class FriendsController {
  constructor(@Inject(FriendsService) private readonly friends: FriendsService) {}

  @Get()
  async list(@CurrentUser() user: UserEntity): Promise<Friend[]> {
    return this.friends.list(user.id);
  }

  @Get("activity")
  async activity(@CurrentUser() user: UserEntity): Promise<FriendActivityByFriend[]> {
    return this.friends.activity(user.id);
  }

  @Get("suggestions")
  async suggestions(@CurrentUser() user: UserEntity): Promise<FriendSuggestion[]> {
    return this.friends.suggestions(user.id);
  }

  @Get("sync")
  async syncStatus(@CurrentUser() user: UserEntity): Promise<FriendsSyncStatus> {
    return this.friends.syncStatus(user.id);
  }

  @Post("sync")
  async sync(@CurrentUser() user: UserEntity): Promise<Friend[]> {
    return this.friends.sync(user.id);
  }

  @Put("follows")
  async replaceFollows(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<string[]> {
    const parsed = ReplaceFollowsWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid follows payload");
    return this.friends.replaceFollows(user.id, parsed.data.userIds);
  }
}

@Controller("users/:userId")
export class UserGraphController {
  constructor(@Inject(FriendsService) private readonly friends: FriendsService) {}

  @Get("following")
  async following(@CurrentUser() _viewer: UserEntity, @Param("userId", ParseUUIDPipe) userId: string): Promise<Friend[]> {
    return this.friends.list(userId);
  }

  @Get("followers")
  async followers(@CurrentUser() _viewer: UserEntity, @Param("userId", ParseUUIDPipe) userId: string): Promise<Friend[]> {
    return this.friends.followers(userId);
  }
}

@Controller("events/:eventId/friends")
export class EventFriendsController {
  constructor(@Inject(FriendsService) private readonly friends: FriendsService) {}

  @Get()
  async list(@CurrentUser() user: UserEntity, @Param("eventId", ParseUUIDPipe) eventId: string): Promise<EventFriendsSummary> {
    return this.friends.eventFriends(user.id, eventId);
  }
}
