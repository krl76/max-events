// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring shared event votes.
// SCOPE: Vote/option/participant/ballot + event/user repos, VotesService, controller.
// DEPENDS: @nestjs/typeorm, ../friends, ../max-bot
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - VotesModule - provides VotesService
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventEntity } from "../events/event.entity";
import { FriendsModule } from "../friends/friends.module";
import { MaxBotModule } from "../max-bot/max-bot.module";
import { NotificationEntity } from "../smart-alerts/notification.entity";
import { UserEntity } from "../users/user.entity";
import { VoteBallotEntity, VoteEntity, VoteOptionEntity, VoteParticipantEntity } from "./vote.entity";
import { VotesController } from "./votes.controller";
import { VotesService } from "./votes.service";

@Module({
  imports: [TypeOrmModule.forFeature([VoteEntity, VoteOptionEntity, VoteParticipantEntity, VoteBallotEntity, EventEntity, UserEntity, NotificationEntity]), FriendsModule, MaxBotModule],
  controllers: [VotesController],
  providers: [VotesService],
})
export class VotesModule {}
