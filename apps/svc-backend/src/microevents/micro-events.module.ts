// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring UGC micro-events.
// SCOPE: MicroEvent/participant/place repos, UsersModule, service, controller.
// DEPENDS: @nestjs/typeorm, ../users/users.module
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MicroEventsModule - provides MicroEventsService and controller
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PlaceEntity } from "../places/place.entity";
import { UsersModule } from "../users/users.module";
import { MicroEventEntity, MicroEventParticipantEntity } from "./micro-event.entity";
import { MicroEventsController } from "./micro-events.controller";
import { MicroEventsService } from "./micro-events.service";

@Module({
  imports: [TypeOrmModule.forFeature([MicroEventEntity, MicroEventParticipantEntity, PlaceEntity]), UsersModule],
  controllers: [MicroEventsController],
  providers: [MicroEventsService],
  exports: [MicroEventsService],
})
export class MicroEventsModule {}
