// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring the "What to do today?" digest.
// SCOPE: Registers event/place/participation/user repos, TodayService, TodayController; imports UsersModule and FriendsModule.
// DEPENDS: @nestjs/typeorm, ../users/users.module, ../friends/friends.module, ./today.service, ./today.controller
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - TodayModule - provides TodayService and TodayController
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventEntity } from "../events/event.entity";
import { FriendsModule } from "../friends/friends.module";
import { ParticipationEntity } from "../participations/participation.entity";
import { PlaceEntity } from "../places/place.entity";
import { UserEntity } from "../users/user.entity";
import { TasteModule } from "../taste/taste.module";
import { UsersModule } from "../users/users.module";
import { TodayController } from "./today.controller";
import { TodayService } from "./today.service";

@Module({
  imports: [TypeOrmModule.forFeature([EventEntity, PlaceEntity, ParticipationEntity, UserEntity]), UsersModule, FriendsModule, TasteModule],
  controllers: [TodayController],
  providers: [TodayService],
})
export class TodayModule {}
