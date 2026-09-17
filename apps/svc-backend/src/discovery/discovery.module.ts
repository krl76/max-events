// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring reverse discovery.
// SCOPE: Check-in/event/place/user/profile repos, FriendsModule, DiscoveryService, controller.
// DEPENDS: @nestjs/typeorm, ../friends/friends.module
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - DiscoveryModule - provides DiscoveryService
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { FriendsModule } from "../friends/friends.module";
import { PlaceEntity } from "../places/place.entity";
import { ProfileEntity } from "../users/profile.entity";
import { UserEntity } from "../users/user.entity";
import { DiscoveryController } from "./discovery.controller";
import { DiscoveryService } from "./discovery.service";

@Module({
  imports: [TypeOrmModule.forFeature([CheckInEntity, EventEntity, PlaceEntity, UserEntity, ProfileEntity]), FriendsModule],
  controllers: [DiscoveryController],
  providers: [DiscoveryService],
})
export class DiscoveryModule {}
