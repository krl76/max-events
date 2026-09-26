// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring the places feature (entity repository, service, HTTP controller).
// SCOPE: Registers PlaceEntity, place participations, PlacesService and PlacesController.
// DEPENDS: @nestjs/typeorm, ./place.entity, ./places.service, ./places.controller
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PlacesModule - provides PlacesService and PlacesController
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OrganizationsModule } from "../organizations/organizations.module";
import { UsersModule } from "../users/users.module";
import { PlaceEntity } from "./place.entity";
import { PlaceParticipationEntity } from "./place-participation.entity";
import { PlaceParticipationsController } from "./place-participations.controller";
import { PlaceParticipationsService } from "./place-participations.service";
import { PlacesController } from "./places.controller";
import { PlacesService } from "./places.service";

@Module({
  imports: [TypeOrmModule.forFeature([PlaceEntity, PlaceParticipationEntity]), UsersModule, OrganizationsModule],
  controllers: [PlacesController, PlaceParticipationsController],
  providers: [PlacesService, PlaceParticipationsService],
  exports: [PlacesService],
})
export class PlacesModule {}
