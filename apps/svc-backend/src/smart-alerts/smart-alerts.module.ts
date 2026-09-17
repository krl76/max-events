// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring weather + friend-left smart alerts and the scheduler.
// SCOPE: Plan/participant/event/place/user/check-in repos, WeatherClient, SmartAlertsService, scheduler.
// DEPENDS: @nestjs/typeorm, ../max-bot/max-bot.module, ./weather.client
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SmartAlertsModule - provides SmartAlertsService and scheduler
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
import { SmartAlertsScheduler } from "./smart-alerts.scheduler";
import { SmartAlertsService } from "./smart-alerts.service";
import { WeatherClient } from "./weather.client";

@Module({
  imports: [TypeOrmModule.forFeature([PlanEntity, PlanParticipantEntity, EventEntity, PlaceEntity, UserEntity, CheckInEntity, ProfileEntity]), MaxBotModule],
  providers: [WeatherClient, SmartAlertsService, SmartAlertsScheduler],
})
export class SmartAlertsModule {}
