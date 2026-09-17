// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring «Мы» trip groups.
// SCOPE: WeGroup/member/item + event/place/user repos, WeGroupsService, controller.
// DEPENDS: @nestjs/typeorm, ../max-bot
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - WeGroupsModule - provides WeGroupsService
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventEntity } from "../events/event.entity";
import { MaxBotModule } from "../max-bot/max-bot.module";
import { PlaceEntity } from "../places/place.entity";
import { UserEntity } from "../users/user.entity";
import { WeGroupEntity, WeGroupItemEntity, WeGroupMemberEntity } from "./we-group.entity";
import { WeGroupsController } from "./we-groups.controller";
import { WeGroupsService } from "./we-groups.service";

@Module({
  imports: [TypeOrmModule.forFeature([WeGroupEntity, WeGroupMemberEntity, WeGroupItemEntity, EventEntity, PlaceEntity, UserEntity]), MaxBotModule],
  controllers: [WeGroupsController],
  providers: [WeGroupsService],
  exports: [WeGroupsService],
})
export class WeGroupsModule {}
