// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring the report queue.
// SCOPE: ReportEntity plus the reportable target entities, ReportsService, ReportsController.
// DEPENDS: @nestjs/typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ReportsModule - provides ReportsService and ReportsController
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventEntity } from "../events/event.entity";
import { EventsModule } from "../events/events.module";
import { FeedPostEntity } from "../feed/feed-post.entity";
import { FeedModule } from "../feed/feed.module";
import { MicroEventEntity } from "../microevents/micro-event.entity";
import { MicroEventsModule } from "../microevents/micro-events.module";
import { PlaceEntity } from "../places/place.entity";
import { PlacesModule } from "../places/places.module";
import { UsersModule } from "../users/users.module";
import { ModerationService } from "./moderation.service";
import { ReportEntity } from "./report.entity";
import { ModerationController, ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({
  imports: [TypeOrmModule.forFeature([ReportEntity, EventEntity, PlaceEntity, FeedPostEntity, MicroEventEntity]), EventsModule, PlacesModule, FeedModule, MicroEventsModule, UsersModule],
  controllers: [ReportsController, ModerationController],
  providers: [ReportsService, ModerationService],
})
export class ReportsModule {}
