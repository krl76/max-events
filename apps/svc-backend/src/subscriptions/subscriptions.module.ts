// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring catalog subscriptions (CRUD + notify).
// SCOPE: Registers SubscriptionEntity, PlaceEntity, UserEntity, SubscriptionsService, controller; imports MaxBotModule and OrganizationsModule (subscription titles name the organization).
// DEPENDS: @nestjs/typeorm, ../max-bot/max-bot.module, ../organizations/organizations.module
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SubscriptionsModule - provides SubscriptionsService and SubscriptionsController
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MaxBotModule } from "../max-bot/max-bot.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PlaceEntity } from "../places/place.entity";
import { NotificationEntity } from "../smart-alerts/notification.entity";
import { ProfileEntity } from "../users/profile.entity";
import { UserEntity } from "../users/user.entity";
import { SubscriptionEntity } from "./subscription.entity";
import { SubscriptionsController } from "./subscriptions.controller";
import { SubscriptionsService } from "./subscriptions.service";

@Module({
  imports: [TypeOrmModule.forFeature([SubscriptionEntity, PlaceEntity, UserEntity, ProfileEntity, NotificationEntity]), MaxBotModule, OrganizationsModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
