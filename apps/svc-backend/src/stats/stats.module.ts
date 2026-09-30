// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring page views and organizer stats.
// SCOPE: PageView/Event/Booking repos, StatsService, controllers.
// DEPENDS: @nestjs/typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - StatsModule - provides StatsService
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BookingEntity } from "../bookings/booking.entity";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { WaitlistEntryEntity } from "../waitlist/waitlist-entry.entity";
import { PageViewEntity } from "./page-view.entity";
import { OrganizerStatsController, ViewsController } from "./stats.controller";
import { StatsService } from "./stats.service";

@Module({
  imports: [TypeOrmModule.forFeature([PageViewEntity, EventEntity, BookingEntity, CheckInEntity, WaitlistEntryEntity])],
  controllers: [ViewsController, OrganizerStatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}
