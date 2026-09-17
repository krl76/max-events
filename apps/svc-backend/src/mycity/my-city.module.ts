// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring «Мой город» aggregation.
// SCOPE: CheckIn/Event/Place repositories, MyCityService, MyCityController.
// DEPENDS: @nestjs/typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MyCityModule - provides MyCityService and MyCityController
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { PlaceEntity } from "../places/place.entity";
import { MyCityController } from "./my-city.controller";
import { MyCityService } from "./my-city.service";

@Module({
  imports: [TypeOrmModule.forFeature([CheckInEntity, EventEntity, PlaceEntity])],
  controllers: [MyCityController],
  providers: [MyCityService],
})
export class MyCityModule {}
