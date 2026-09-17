// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring promocodes and early access.
// SCOPE: PromoCode/Event/Booking repos, PromoService; exported for bookings.
// DEPENDS: @nestjs/typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PromoModule - provides PromoService
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import { PromoCampaignEntity } from "./promo-campaign.entity";
import { PromoCodeEntity } from "./promo-code.entity";
import { PromoFulfillmentEntity } from "./promo-fulfillment.entity";
import { PromoService } from "./promo.service";

@Module({
  imports: [TypeOrmModule.forFeature([PromoCodeEntity, PromoCampaignEntity, PromoFulfillmentEntity, EventEntity, BookingEntity])],
  providers: [PromoService],
  exports: [PromoService],
})
export class PromoModule {}
