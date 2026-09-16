// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring the participation feature (entity repositories, service, HTTP controller).
// SCOPE: Registers ParticipationEntity and EventEntity repositories, ParticipationsService, ParticipationsController.
// DEPENDS: @nestjs/typeorm, ../events/event.entity, ./participation.entity, ./participations.service, ./participations.controller
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ParticipationsModule - provides ParticipationsService and ParticipationsController
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventEntity } from "../events/event.entity";
import { ParticipationEntity } from "./participation.entity";
import { ParticipationsController } from "./participations.controller";
import { ParticipationsService } from "./participations.service";

@Module({
  imports: [TypeOrmModule.forFeature([ParticipationEntity, EventEntity])],
  controllers: [ParticipationsController],
  providers: [ParticipationsService],
  exports: [ParticipationsService],
})
export class ParticipationsModule {}
