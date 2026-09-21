// START_MODULE_CONTRACT
// PURPOSE: Root NestJS module wiring config, Postgres (TypeORM) and feature modules.
// SCOPE: Global ConfigModule, TypeOrmModule from DATABASE_URL, feature modules including my-city, reviews, waitlist, feed, reports and place-page.
// DEPENDS: @nestjs/config, @nestjs/typeorm, auth/auth.module, health/health.module, places/places.module, events/events.module, bookings/bookings.module, calendar/calendar.module, reminders/reminders.module, participations/participations.module, friends/friends.module, whereto/whereto.module, today/today.module, gatherings/gatherings.module, plans/plans.module, lists/lists.module, subscriptions/subscriptions.module, checkins/check-ins.module, achievements/achievements.module
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AppModule - root application module
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { validateEnv } from "./config/env";
import { RedisModule } from "./redis/redis.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { PlacesModule } from "./places/places.module";
import { EventsModule } from "./events/events.module";
import { BookingsModule } from "./bookings/bookings.module";
import { CalendarModule } from "./calendar/calendar.module";
import { RemindersModule } from "./reminders/reminders.module";
import { ParticipationsModule } from "./participations/participations.module";
import { FriendsModule } from "./friends/friends.module";
import { WheretoModule } from "./whereto/whereto.module";
import { TodayModule } from "./today/today.module";
import { GatheringsModule } from "./gatherings/gatherings.module";
import { PlansModule } from "./plans/plans.module";
import { ListsModule } from "./lists/lists.module";
import { SubscriptionsModule } from "./subscriptions/subscriptions.module";
import { CheckInsModule } from "./checkins/check-ins.module";
import { AchievementsModule } from "./achievements/achievements.module";
import { MyCityModule } from "./mycity/my-city.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { WaitlistModule } from "./waitlist/waitlist.module";
import { FeedModule } from "./feed/feed.module";
import { ReportsModule } from "./reports/reports.module";
import { PlacePageModule } from "./place-page/place-page.module";
import { MicroEventsModule } from "./microevents/micro-events.module";
import { CollectionsModule } from "./collections/collections.module";
import { NearbyModule } from "./nearby/nearby.module";
import { RoutesModule } from "./routes/routes.module";
import { LeaveNowModule } from "./leave-now/leave-now.module";
import { SmartAlertsModule } from "./smart-alerts/smart-alerts.module";
import { TasteModule } from "./taste/taste.module";
import { DiscoveryModule } from "./discovery/discovery.module";
import { PeopleModule } from "./people/people.module";
import { OrganizerModule } from "./organizer/organizer.module";
import { StatsModule } from "./stats/stats.module";
import { RatingModule } from "./rating/rating.module";
import { PromoModule } from "./promo/promo.module";
import { PromotionModule } from "./promotion/promotion.module";
import { WeGroupsModule } from "./wegroups/we-groups.module";
import { VotesModule } from "./votes/votes.module";
import { PaymentsModule } from "./payments/payments.module";
import { AssistModule } from "./assist/assist.module";
import { StoriesModule } from "./stories/stories.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "postgres" as const,
        url: config.getOrThrow<string>("DATABASE_URL"),
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    RedisModule,
    HealthModule,
    AuthModule,
    PlacesModule,
    EventsModule,
    BookingsModule,
    CalendarModule,
    RemindersModule,
    ParticipationsModule,
    FriendsModule,
    WheretoModule,
    TodayModule,
    GatheringsModule,
    PlansModule,
    ListsModule,
    SubscriptionsModule,
    CheckInsModule,
    AchievementsModule,
    MyCityModule,
    ReviewsModule,
    WaitlistModule,
    FeedModule,
    ReportsModule,
    PlacePageModule,
    MicroEventsModule,
    CollectionsModule,
    NearbyModule,
    RoutesModule,
    LeaveNowModule,
    SmartAlertsModule,
    TasteModule,
    DiscoveryModule,
    PeopleModule,
    OrganizerModule,
    StatsModule,
    RatingModule,
    PromoModule,
    PromotionModule,
    WeGroupsModule,
    VotesModule,
    PaymentsModule,
    AssistModule,
    StoriesModule,
  ],
})
export class AppModule {}
