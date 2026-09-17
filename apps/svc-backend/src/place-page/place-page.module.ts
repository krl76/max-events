// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring the place social-page aggregate.
// SCOPE: Place/Event/CheckIn/Participation/User repos, FriendsModule, ReviewsModule, PlacePageService, controller.
// DEPENDS: @nestjs/typeorm, ../friends/friends.module, ../reviews/reviews.module
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PlacePageModule - provides PlacePageService and PlacePageController
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { FriendsModule } from "../friends/friends.module";
import { ParticipationEntity } from "../participations/participation.entity";
import { PlaceEntity } from "../places/place.entity";
import { ReviewsModule } from "../reviews/reviews.module";
import { UserEntity } from "../users/user.entity";
import { PlacePageController } from "./place-page.controller";
import { PlacePageService } from "./place-page.service";

@Module({
  imports: [TypeOrmModule.forFeature([PlaceEntity, EventEntity, CheckInEntity, ParticipationEntity, UserEntity]), FriendsModule, ReviewsModule],
  controllers: [PlacePageController],
  providers: [PlacePageService],
})
export class PlacePageModule {}
