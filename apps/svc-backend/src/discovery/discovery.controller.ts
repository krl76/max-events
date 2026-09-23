// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for reverse discovery.
// SCOPE: GET /discovery, GET /discovery/friend-places, GET /discovery/friends/:userId/route.
// DEPENDS: @nestjs/common, ../auth/auth.guard, ./discovery.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - DiscoveryController - summary, the visited-places map layer and the friend route
// END_MODULE_MAP

import { Controller, Get, Inject, Param, ParseUUIDPipe } from "@nestjs/common";
import type { DiscoveryResponse, FriendPlaceVisit, FriendRoute } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { DiscoveryService } from "./discovery.service";

@Controller("discovery")
export class DiscoveryController {
  constructor(@Inject(DiscoveryService) private readonly discovery: DiscoveryService) {}

  @Get()
  summary(@CurrentUser() user: UserEntity): Promise<DiscoveryResponse> {
    return this.discovery.summary(user.id);
  }

  @Get("friend-places")
  friendPlaces(@CurrentUser() user: UserEntity): Promise<FriendPlaceVisit[]> {
    return this.discovery.friendPlaces(user.id);
  }

  @Get("friends/:userId/route")
  route(@CurrentUser() user: UserEntity, @Param("userId", ParseUUIDPipe) userId: string): Promise<FriendRoute> {
    return this.discovery.route(user.id, userId);
  }
}
