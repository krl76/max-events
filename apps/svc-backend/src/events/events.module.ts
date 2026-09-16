// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring the events feature (entity repository, service, HTTP controller).
// SCOPE: Registers EventEntity, EventsService and EventsController; imports PlacesModule and MaxBotModule.
// DEPENDS: @nestjs/typeorm, ../places/places.module, ../max-bot/max-bot.module, ./event.entity, ./events.service, ./events.controller
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - EventsModule - provides EventsService and EventsController
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MaxBotModule } from "../max-bot/max-bot.module";
import { PlacesModule } from "../places/places.module";
import { EventEntity } from "./event.entity";
import { EventsController } from "./events.controller";
import { EventsService } from "./events.service";

@Module({
  imports: [TypeOrmModule.forFeature([EventEntity]), PlacesModule, MaxBotModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
