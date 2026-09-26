// START_MODULE_CONTRACT
// PURPOSE: Nest module for the organizer panel HTTP.
// SCOPE: OrganizerController; imports EventsModule, PlacesModule, PromoModule, PromotionModule, OrganizationsModule.
// DEPENDS: ../events/events.module, ../places/places.module, ../promo/promo.module, ../promotion/promotion.module, ../payments/payments.module, ../organizations/organizations.module
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OrganizerModule - organizer panel
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BookingEntity } from "../bookings/booking.entity";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { EventsModule } from "../events/events.module";
import { PlacesModule } from "../places/places.module";
import { BookingsModule } from "../bookings/bookings.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PaymentsModule } from "../payments/payments.module";
import { PromoModule } from "../promo/promo.module";
import { PromotionModule } from "../promotion/promotion.module";
import { StatsModule } from "../stats/stats.module";
import { UserEntity } from "../users/user.entity";
import { WaitlistEntryEntity } from "../waitlist/waitlist-entry.entity";
import { SlotsModule } from "../slots/slots.module";
import { WaitlistModule } from "../waitlist/waitlist.module";
import { EventOptionsEntity } from "./event-options.entity";
import { OrganizerController } from "./organizer.controller";
import { OrganizerDayService } from "./organizer-day.service";

@Module({
  imports: [TypeOrmModule.forFeature([EventEntity, EventOptionsEntity, BookingEntity, CheckInEntity, WaitlistEntryEntity, UserEntity]), EventsModule, PlacesModule, PromoModule, PromotionModule, PaymentsModule, BookingsModule, OrganizationsModule, StatsModule, WaitlistModule, SlotsModule],
  controllers: [OrganizerController],
  providers: [OrganizerDayService],
})
export class OrganizerModule {}
