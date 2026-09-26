// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring gatherings (availability, create/respond, unanswered reminders).
// SCOPE: Registers gathering/invitee/booking/event/user repos, GatheringsService, HTTP controllers, scheduler.
// DEPENDS: @nestjs/typeorm, ../friends/friends.module, ../max-bot/max-bot.module
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - GatheringsModule - provides GatheringsService and gathering HTTP controllers
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import { FriendsModule } from "../friends/friends.module";
import { MaxBotModule } from "../max-bot/max-bot.module";
import { UserEntity } from "../users/user.entity";
import { NotificationEntity } from "../smart-alerts/notification.entity";
import { GatheringInviteeEntity } from "./gathering-invitee.entity";
import { GatheringEntity } from "./gathering.entity";
import { FriendAvailabilityController, GatheringsController } from "./gatherings.controller";
import { GatheringsScheduler } from "./gatherings.scheduler";
import { GatheringsService } from "./gatherings.service";

@Module({
  imports: [TypeOrmModule.forFeature([GatheringEntity, GatheringInviteeEntity, BookingEntity, EventEntity, UserEntity, NotificationEntity]), FriendsModule, MaxBotModule],
  controllers: [FriendAvailabilityController, GatheringsController],
  providers: [GatheringsService, GatheringsScheduler],
})
export class GatheringsModule {}
