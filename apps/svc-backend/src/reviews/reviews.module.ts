// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring reviews and rating HTTP.
// SCOPE: ReviewEntity, BookingEntity, EventEntity, ReviewsService, controllers.
// DEPENDS: @nestjs/typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ReviewsModule - provides ReviewsService and review/rating controllers
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import { EventRatingsController, PlaceRatingsController, ReviewsController } from "./reviews.controller";
import { ReviewEntity } from "./review.entity";
import { ReviewsService } from "./reviews.service";

@Module({
  imports: [TypeOrmModule.forFeature([ReviewEntity, BookingEntity, EventEntity])],
  controllers: [ReviewsController, EventRatingsController, PlaceRatingsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
