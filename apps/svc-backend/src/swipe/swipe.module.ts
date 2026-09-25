// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring the swipe deck of venues.
// SCOPE: SwipeDecisionEntity, CheckInEntity, PlaceEntity, SwipeService, SwipeController.
// DEPENDS: @nestjs/typeorm, lists/taste/friends
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SwipeModule - provides SwipeService and SwipeController
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CheckInEntity } from "../checkins/check-in.entity";
import { FriendsModule } from "../friends/friends.module";
import { ListsModule } from "../lists/lists.module";
import { PlaceEntity } from "../places/place.entity";
import { TasteModule } from "../taste/taste.module";
import { SwipeDecisionEntity } from "./swipe-decision.entity";
import { SwipeController } from "./swipe.controller";
import { SwipeService } from "./swipe.service";

@Module({
  imports: [TypeOrmModule.forFeature([SwipeDecisionEntity, PlaceEntity, CheckInEntity]), TasteModule, ListsModule, FriendsModule],
  controllers: [SwipeController],
  providers: [SwipeService],
})
export class SwipeModule {}
