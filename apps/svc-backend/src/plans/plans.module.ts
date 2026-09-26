// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring shared plans (CRUD, PlanCard, chat, meeting reminders).
// SCOPE: Registers plan/participant/event/place/user repos, PlansService, HTTP controller, scheduler.
// DEPENDS: @nestjs/typeorm, ../friends/friends.module, ../max-bot/max-bot.module
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PlansModule - provides PlansService and PlansController
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventEntity } from "../events/event.entity";
import { FriendsModule } from "../friends/friends.module";
import { MaxBotModule } from "../max-bot/max-bot.module";
import { PlaceEntity } from "../places/place.entity";
import { UserEntity } from "../users/user.entity";
import { PlanExpenseEntity } from "./plan-expense.entity";
import { PlanParticipantEntity } from "./plan-participant.entity";
import { NotificationEntity } from "../smart-alerts/notification.entity";
import { PlanEntity } from "./plan.entity";
import { PlansController } from "./plans.controller";
import { PlansScheduler } from "./plans.scheduler";
import { PlansService } from "./plans.service";

@Module({
  imports: [TypeOrmModule.forFeature([PlanEntity, PlanParticipantEntity, PlanExpenseEntity, EventEntity, PlaceEntity, UserEntity, NotificationEntity]), FriendsModule, MaxBotModule],
  controllers: [PlansController],
  providers: [PlansService, PlansScheduler],
  exports: [PlansService],
})
export class PlansModule {}
