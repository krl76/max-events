// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring venue slots.
// SCOPE: PlaceSlot/SlotBooking/Place repos, FriendsModule, SlotsService, SlotsController.
// DEPENDS: @nestjs/typeorm, friends
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SlotsModule - provides SlotsService
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FriendsModule } from "../friends/friends.module";
import { PlaceEntity } from "../places/place.entity";
import { PlaceExtraEntity, SlotChatMessageEntity, SlotWaitlistEntity } from "./slot-extra.entity";
import { PlaceSlotEntity, SlotBookingEntity } from "./slot.entity";
import { SlotsController } from "./slots.controller";
import { SlotsService } from "./slots.service";

@Module({
  imports: [TypeOrmModule.forFeature([PlaceSlotEntity, SlotBookingEntity, PlaceEntity, PlaceExtraEntity, SlotWaitlistEntity, SlotChatMessageEntity]), FriendsModule],
  controllers: [SlotsController],
  providers: [SlotsService],
  exports: [SlotsService],
})
export class SlotsModule {}
