// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring the bookings feature (transactional BookingsService + HTTP controller).
// SCOPE: Registers BookingEntity and EventEntity repositories, BookingsService, BookingsController.
// DEPENDS: @nestjs/typeorm, ../events/event.entity, ./booking.entity, ./bookings.service, ./bookings.controller
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - BookingsModule - provides BookingsService and BookingsController
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventEntity } from "../events/event.entity";
import { WaitlistModule } from "../waitlist/waitlist.module";
import { BookingEntity } from "./booking.entity";
import { BookingsController } from "./bookings.controller";
import { BookingsService } from "./bookings.service";

@Module({
  imports: [TypeOrmModule.forFeature([BookingEntity, EventEntity]), WaitlistModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
