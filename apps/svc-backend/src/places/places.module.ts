// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring the places feature (entity repository, service, HTTP controller).
// SCOPE: Registers PlaceEntity, PlacesService and PlacesController.
// DEPENDS: @nestjs/typeorm, ./place.entity, ./places.service, ./places.controller
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PlacesModule - provides PlacesService and PlacesController
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PlaceEntity } from "./place.entity";
import { PlacesController } from "./places.controller";
import { PlacesService } from "./places.service";

@Module({
  imports: [TypeOrmModule.forFeature([PlaceEntity])],
  controllers: [PlacesController],
  providers: [PlacesService],
  exports: [PlacesService],
})
export class PlacesModule {}
