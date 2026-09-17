// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring personal lists (presets, items, HTTP).
// SCOPE: Registers ListEntity, ListItemEntity, EventEntity, ListsService, ListsController.
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
import { ListItemEntity } from "./list-item.entity";
import { ListEntity } from "./list.entity";
import { ListsController } from "./lists.controller";
import { ListsService } from "./lists.service";

@Module({
  imports: [TypeOrmModule.forFeature([ListEntity, ListItemEntity, EventEntity])],
  controllers: [ListsController],
  providers: [ListsService],
})
export class ListsModule {}
