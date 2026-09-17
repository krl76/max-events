// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring shared collections.
// SCOPE: Collection/member/item/event/user repos, MaxBotModule, service, controller.
// DEPENDS: @nestjs/typeorm, ../max-bot/max-bot.module
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CollectionsModule - provides CollectionsService and controller
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventEntity } from "../events/event.entity";
import { MaxBotModule } from "../max-bot/max-bot.module";
import { UserEntity } from "../users/user.entity";
import { CollectionEntity, CollectionItemEntity, CollectionMemberEntity } from "./collection.entity";
import { CollectionsController } from "./collections.controller";
import { CollectionsService } from "./collections.service";

@Module({
  imports: [TypeOrmModule.forFeature([CollectionEntity, CollectionMemberEntity, CollectionItemEntity, EventEntity, UserEntity]), MaxBotModule],
  controllers: [CollectionsController],
  providers: [CollectionsService],
})
export class CollectionsModule {}
