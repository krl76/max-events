// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring weather, friend-left and list-digest smart alerts, the scheduler, and the in-app inbox HTTP.
// SCOPE: Plan/list/digest/notification repos, WeatherClient, SmartAlertsService, ListDigestService, NotificationsService, scheduler.
// DEPENDS: @nestjs/typeorm, ../max-bot/max-bot.module, ./weather.client
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SmartAlertsModule - provides SmartAlertsService, ListDigestService and scheduler
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { ListItemEntity } from "../lists/list-item.entity";
import { ListEntity } from "../lists/list.entity";
import { MaxBotModule } from "../max-bot/max-bot.module";
import { PlaceEntity } from "../places/place.entity";
import { PlanParticipantEntity } from "../plans/plan-participant.entity";
import { PlanEntity } from "../plans/plan.entity";
import { ProfileEntity } from "../users/profile.entity";
import { UsersModule } from "../users/users.module";
import { UserEntity } from "../users/user.entity";
import { ListDigestSendEntity } from "./list-digest.entity";
import { ListDigestService } from "./list-digest.service";
import { NotificationEntity } from "./notification.entity";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { SmartAlertsScheduler } from "./smart-alerts.scheduler";
import { GatheringsModule } from "../gatherings/gatherings.module";
import { MicroEventsModule } from "../microevents/micro-events.module";
import { PlansModule } from "../plans/plans.module";
import { WaitlistModule } from "../waitlist/waitlist.module";
import { SmartAlertsService } from "./smart-alerts.service";

@Module({
  imports: [TypeOrmModule.forFeature([PlanEntity, PlanParticipantEntity, EventEntity, PlaceEntity, UserEntity, CheckInEntity, ProfileEntity, ListEntity, ListItemEntity, ListDigestSendEntity, NotificationEntity]), MaxBotModule, UsersModule, PlansModule, GatheringsModule, MicroEventsModule, WaitlistModule],
  controllers: [NotificationsController],
  providers: [SmartAlertsService, ListDigestService, SmartAlertsScheduler, NotificationsService],
})
export class SmartAlertsModule {}
