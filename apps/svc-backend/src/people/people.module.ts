// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring people matching.
// SCOPE: User/profile/check-in/event/place/participation repos, PeopleService, controller.
// DEPENDS: @nestjs/typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PeopleModule - provides PeopleService
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { ParticipationEntity } from "../participations/participation.entity";
import { PlaceEntity } from "../places/place.entity";
import { ProfileEntity } from "../users/profile.entity";
import { UserEntity } from "../users/user.entity";
import { PeopleController } from "./people.controller";
import { PeopleService } from "./people.service";

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, ProfileEntity, CheckInEntity, EventEntity, PlaceEntity, ParticipationEntity])],
  controllers: [PeopleController],
  providers: [PeopleService],
})
export class PeopleModule {}
