// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring the personal calendar (bookings + events + places).
// SCOPE: Registers CalendarService and CalendarController with Booking/Event/Place repositories.
// DEPENDS: @nestjs/typeorm, bookings/events/places entities, ./calendar.service, ./calendar.controller
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CalendarModule - provides CalendarService and CalendarController
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import { PlaceEntity } from "../places/place.entity";
import { CalendarController } from "./calendar.controller";
import { CalendarService } from "./calendar.service";

@Module({
  imports: [TypeOrmModule.forFeature([BookingEntity, EventEntity, PlaceEntity])],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
