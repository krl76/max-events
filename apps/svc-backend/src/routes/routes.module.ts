// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring day-route build and optimize.
// SCOPE: Event/Place repos, RoutesService, RoutesController.
// DEPENDS: @nestjs/typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - RoutesModule - provides RoutesService and RoutesController
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventEntity } from "../events/event.entity";
import { PlaceEntity } from "../places/place.entity";
import { RoutesController } from "./routes.controller";
import { RoutesService } from "./routes.service";

@Module({
  imports: [TypeOrmModule.forFeature([EventEntity, PlaceEntity])],
  controllers: [RoutesController],
  providers: [RoutesService],
})
export class RoutesModule {}
