// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring check-ins and visit stats.
// SCOPE: Registers CheckInEntity, EventEntity, PlaceEntity, CheckInsService, HTTP controllers.
// DEPENDS: @nestjs/typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CheckInsModule - provides CheckInsService and check-in HTTP controllers
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventEntity } from "../events/event.entity";
import { PlaceEntity } from "../places/place.entity";
import { CheckInEntity } from "./check-in.entity";
import { CheckInsController, VisitStatsController } from "./check-ins.controller";
import { CheckInsService } from "./check-ins.service";

@Module({
  imports: [TypeOrmModule.forFeature([CheckInEntity, EventEntity, PlaceEntity])],
  controllers: [CheckInsController, VisitStatsController],
  providers: [CheckInsService],
  exports: [CheckInsService],
})
export class CheckInsModule {}
