// START_MODULE_CONTRACT
// PURPOSE: Nest module for the organizer panel HTTP.
// SCOPE: OrganizerController; imports EventsModule, PlacesModule, PromoModule, PromotionModule.
// DEPENDS: ../events/events.module, ../places/places.module, ../promo/promo.module, ../promotion/promotion.module, ../payments/payments.module
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OrganizerModule - organizer panel
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module";
import { PlacesModule } from "../places/places.module";
import { BookingsModule } from "../bookings/bookings.module";
import { PaymentsModule } from "../payments/payments.module";
import { PromoModule } from "../promo/promo.module";
import { PromotionModule } from "../promotion/promotion.module";
import { OrganizerController } from "./organizer.controller";

@Module({
  imports: [EventsModule, PlacesModule, PromoModule, PromotionModule, PaymentsModule, BookingsModule],
  controllers: [OrganizerController],
})
export class OrganizerModule {}
