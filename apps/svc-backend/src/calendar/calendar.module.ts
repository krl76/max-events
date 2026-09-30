// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring the personal calendar (bookings + events + places) and the shared-calendar tables.
// SCOPE: Registers CalendarService and CalendarController with Booking/Event/Place/User and share/invite/going repositories; exports CalendarService for the chat bot.
// DEPENDS: @nestjs/typeorm, bookings/events/places/users entities, friends, ./calendar.service, ./calendar.controller
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CalendarModule - provides and exports CalendarService, provides CalendarController
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import { FriendsModule } from "../friends/friends.module";
import { PlaceEntity } from "../places/place.entity";
import { UserEntity } from "../users/user.entity";
import { CalendarGoingEntity } from "./calendar-going.entity";
import { CalendarInviteEntity } from "./calendar-invite.entity";
import { CalendarShareEntity } from "./calendar-share.entity";
import { CalendarController } from "./calendar.controller";
import { CalendarService } from "./calendar.service";

@Module({
  imports: [TypeOrmModule.forFeature([BookingEntity, EventEntity, PlaceEntity, CalendarShareEntity, CalendarInviteEntity, CalendarGoingEntity, UserEntity]), FriendsModule],
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
