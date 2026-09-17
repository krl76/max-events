// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring taste graph and after-me HTTP.
// SCOPE: Check-in/event/place/review repos, TasteService, TasteController.
// DEPENDS: @nestjs/typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - TasteModule - provides TasteService
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { PlaceEntity } from "../places/place.entity";
import { ReviewEntity } from "../reviews/review.entity";
import { ProfileEntity } from "../users/profile.entity";
import { TasteController } from "./taste.controller";
import { TasteService } from "./taste.service";

@Module({
  imports: [TypeOrmModule.forFeature([CheckInEntity, EventEntity, PlaceEntity, ReviewEntity, ProfileEntity])],
  controllers: [TasteController],
  providers: [TasteService],
  exports: [TasteService],
})
export class TasteModule {}
