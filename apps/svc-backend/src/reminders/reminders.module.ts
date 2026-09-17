// START_MODULE_CONTRACT
// PURPOSE: Nest module for booking reminder ticks (service + 60s scheduler).
// SCOPE: Registers Booking/Event/User repos, RemindersService, RemindersScheduler; imports MaxBotModule.
// DEPENDS: @nestjs/typeorm, ../max-bot/max-bot.module, bookings/events/users entities
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - RemindersModule - provides RemindersService and RemindersScheduler
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import { MaxBotModule } from "../max-bot/max-bot.module";
import { UserEntity } from "../users/user.entity";
import { RemindersScheduler } from "./reminders.scheduler";
import { RemindersService } from "./reminders.service";

@Module({
  imports: [TypeOrmModule.forFeature([BookingEntity, EventEntity, UserEntity]), MaxBotModule],
  providers: [RemindersService, RemindersScheduler],
})
export class RemindersModule {}
