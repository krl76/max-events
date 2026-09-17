// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring nearby timeline and leisure options.
// SCOPE: Event/Place/Participation repos, FriendsModule, NearbyService, controller.
// DEPENDS: @nestjs/typeorm, ../friends/friends.module
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - NearbyModule - provides NearbyService and NearbyController
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventEntity } from "../events/event.entity";
import { FriendsModule } from "../friends/friends.module";
import { ParticipationEntity } from "../participations/participation.entity";
import { PlaceEntity } from "../places/place.entity";
import { NearbyController } from "./nearby.controller";
import { NearbyService } from "./nearby.service";

@Module({
  imports: [TypeOrmModule.forFeature([EventEntity, PlaceEntity, ParticipationEntity]), FriendsModule],
  controllers: [NearbyController],
  providers: [NearbyService],
})
export class NearbyModule {}
