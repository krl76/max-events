// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for friend graph sync, activity feed, and per-event friend summary.
// SCOPE: POST /friends/sync, GET /friends, GET /friends/activity, GET /events/:eventId/friends; CurrentUser identity.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth/auth.guard, ./friends.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - FriendsController - /friends list, sync, activity
// - EventFriendsController - /events/:eventId/friends summary
// END_MODULE_MAP

import { Controller, Get, Inject, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import type { EventFriendsSummary, Friend, FriendActivityByFriend } from "@max-events/api-contracts";
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

  @Post("sync")
  async sync(@CurrentUser() user: UserEntity): Promise<Friend[]> {
    return this.friends.sync(user.id);
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
