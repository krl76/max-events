// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring the events feature (entity repositories, services, HTTP controller).
// SCOPE: Registers EventEntity plus Booking/CheckIn/Participation/User repos for the details aggregate, EventsService, EventDetailsService, EventWeatherService, EventChatScheduler and EventsController; imports PlacesModule, MaxBotModule, ReviewsModule.
// DEPENDS: @nestjs/typeorm, ../places/places.module, ../max-bot/max-bot.module, ../reviews/reviews.module, ./event.entity, ./events.service, ./event-details.service, ./events.controller
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - EventsModule - provides EventsService, EventDetailsService and EventsController
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BookingEntity } from "../bookings/booking.entity";
import { CheckInEntity } from "../checkins/check-in.entity";
import { MaxBotModule } from "../max-bot/max-bot.module";
import { ParticipationEntity } from "../participations/participation.entity";
import { PlacesModule } from "../places/places.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";
import { UserEntity } from "../users/user.entity";
import { UsersModule } from "../users/users.module";
import { PromotionModule } from "../promotion/promotion.module";
import { WaitlistModule } from "../waitlist/waitlist.module";
import { EventChatScheduler } from "./event-chat.scheduler";
import { EventDetailsService } from "./event-details.service";
import { EventEntity } from "./event.entity";
import { EventsController } from "./events.controller";
import { EventWeatherService } from "./event-weather.service";
import { EventsService } from "./events.service";
import { WeatherClient } from "../smart-alerts/weather.client";

@Module({
  imports: [TypeOrmModule.forFeature([EventEntity, BookingEntity, CheckInEntity, ParticipationEntity, UserEntity]), PlacesModule, MaxBotModule, SubscriptionsModule, UsersModule, WaitlistModule, PromotionModule, ReviewsModule],
  controllers: [EventsController],
  providers: [WeatherClient, EventWeatherService, EventsService, EventDetailsService, EventChatScheduler],
  exports: [EventsService],
})
export class EventsModule {}
