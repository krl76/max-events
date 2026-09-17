// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring the friends feature (graph, sync, activity, event summary).
// SCOPE: Registers FriendshipEntity plus user/event/participation repos, FriendsService, HTTP controllers.
// DEPENDS: @nestjs/typeorm, ../max-bot, ../users, ../events, ../participations, ./friendship.entity
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - FriendsModule - provides FriendsService and friend HTTP controllers
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventEntity } from "../events/event.entity";
import { MaxBotModule } from "../max-bot/max-bot.module";
import { ParticipationEntity } from "../participations/participation.entity";
import { UserEntity } from "../users/user.entity";
import { EventFriendsController, FriendsController } from "./friends.controller";
import { FriendshipEntity } from "./friendship.entity";
import { FriendsService } from "./friends.service";

@Module({
  imports: [TypeOrmModule.forFeature([FriendshipEntity, UserEntity, ParticipationEntity, EventEntity]), MaxBotModule],
  controllers: [FriendsController, EventFriendsController],
  providers: [FriendsService],
  exports: [FriendsService],
})
export class FriendsModule {}
