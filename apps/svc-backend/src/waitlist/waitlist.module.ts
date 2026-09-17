// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring the waitlist queue, HTTP and expiry scheduler.
// SCOPE: WaitlistEntry/Event/User/Booking repos, WaitlistService, controller, scheduler; exports WaitlistService for bookings.
// DEPENDS: @nestjs/typeorm, ../max-bot/max-bot.module, ../promo/promo.module
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - WaitlistModule - provides WaitlistService and HTTP/scheduler
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import { MaxBotModule } from "../max-bot/max-bot.module";
import { PromoModule } from "../promo/promo.module";
import { UserEntity } from "../users/user.entity";
import { WaitlistController } from "./waitlist.controller";
import { WaitlistEntryEntity } from "./waitlist-entry.entity";
import { WaitlistScheduler } from "./waitlist.scheduler";
import { WaitlistService } from "./waitlist.service";

@Module({
  imports: [TypeOrmModule.forFeature([WaitlistEntryEntity, EventEntity, UserEntity, BookingEntity]), MaxBotModule, PromoModule],
  controllers: [WaitlistController],
  providers: [WaitlistService, WaitlistScheduler],
  exports: [WaitlistService],
})
export class WaitlistModule {}
