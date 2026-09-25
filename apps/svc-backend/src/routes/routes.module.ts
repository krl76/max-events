// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring day-route build, optimize, and map travel tiles.
// SCOPE: Event/Place repos, RoutesService, RoutesController, TravelController.
// DEPENDS: @nestjs/typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - RoutesModule - provides RoutesService, RoutesController and TravelController
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventEntity } from "../events/event.entity";
import { PlaceEntity } from "../places/place.entity";
import { RoutesController } from "./routes.controller";
import { RoutesService } from "./routes.service";
import { TravelController } from "./travel.controller";

@Module({
  imports: [TypeOrmModule.forFeature([EventEntity, PlaceEntity])],
  controllers: [RoutesController, TravelController],
  providers: [RoutesService],
  exports: [RoutesService],
})
export class RoutesModule {}
