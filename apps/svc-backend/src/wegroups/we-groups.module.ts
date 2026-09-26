// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring «Мы» trip groups.
// SCOPE: WeGroup/member/item + event/place/user/booking/plan/review repos, WeGroupsService, controller.
// DEPENDS: @nestjs/typeorm, ../max-bot
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - WeGroupsModule - provides WeGroupsService
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import { MaxBotModule } from "../max-bot/max-bot.module";
import { PlanExpenseEntity } from "../plans/plan-expense.entity";
import { PlanEntity } from "../plans/plan.entity";
import { ParticipationEntity } from "../participations/participation.entity";
import { PlaceEntity } from "../places/place.entity";
import { ReviewEntity } from "../reviews/review.entity";
import { UserEntity } from "../users/user.entity";
import { WeGroupEntity, WeGroupItemEntity, WeGroupMemberEntity, WeGroupPhotoEntity } from "./we-group.entity";
import { WeGroupsController } from "./we-groups.controller";
import { WeGroupsService } from "./we-groups.service";

@Module({
  imports: [TypeOrmModule.forFeature([WeGroupEntity, WeGroupMemberEntity, WeGroupItemEntity, WeGroupPhotoEntity, EventEntity, PlaceEntity, UserEntity, BookingEntity, PlanEntity, PlanExpenseEntity, ReviewEntity, ParticipationEntity]), MaxBotModule],
  controllers: [WeGroupsController],
  providers: [WeGroupsService],
  exports: [WeGroupsService],
})
export class WeGroupsModule {}
