// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring the leave-now engine and scheduler.
// SCOPE: Plan/participant/event/place/user/check-in repos, LeaveNowService, scheduler.
// DEPENDS: @nestjs/typeorm, ../max-bot/max-bot.module
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - LeaveNowModule - provides LeaveNowService and scheduler
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { MaxBotModule } from "../max-bot/max-bot.module";
import { PlaceEntity } from "../places/place.entity";
import { PlanParticipantEntity } from "../plans/plan-participant.entity";
import { PlanEntity } from "../plans/plan.entity";
import { ProfileEntity } from "../users/profile.entity";
import { UserEntity } from "../users/user.entity";
import { LeaveNowScheduler } from "./leave-now.scheduler";
import { LeaveNowService } from "./leave-now.service";

@Module({
  imports: [TypeOrmModule.forFeature([PlanEntity, PlanParticipantEntity, EventEntity, PlaceEntity, UserEntity, CheckInEntity, ProfileEntity]), MaxBotModule],
  providers: [LeaveNowService, LeaveNowScheduler],
})
export class LeaveNowModule {}
