// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring personal and shared lists (presets, items, membership, HTTP).
// SCOPE: Registers ListEntity, ListItemEntity, ListMemberEntity, EventEntity, ListsService, ListsController.
// DEPENDS: @nestjs/typeorm, ../events/event.entity
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ListsModule - provides ListsService and ListsController
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventEntity } from "../events/event.entity";
import { FriendsModule } from "../friends/friends.module";
import { PlaceEntity } from "../places/place.entity";
import { UsersModule } from "../users/users.module";
import { ListItemEntity } from "./list-item.entity";
import { ListMemberEntity } from "./list-member.entity";
import { ListEntity } from "./list.entity";
import { ListsController } from "./lists.controller";
import { ListsService } from "./lists.service";

@Module({
  imports: [TypeOrmModule.forFeature([ListEntity, ListItemEntity, ListMemberEntity, EventEntity, PlaceEntity]), UsersModule, FriendsModule],
  controllers: [ListsController],
  providers: [ListsService],
  exports: [ListsService],
})
export class ListsModule {}
