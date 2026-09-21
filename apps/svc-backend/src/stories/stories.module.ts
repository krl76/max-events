// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring stories.
// SCOPE: StoryEntity repo, service, controller.
// DEPENDS: @nestjs/typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - StoriesModule - provides StoriesService and controller
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { StoryEntity } from "./story.entity";
import { StoriesController } from "./stories.controller";
import { StoriesService } from "./stories.service";

@Module({
  imports: [TypeOrmModule.forFeature([StoryEntity])],
  controllers: [StoriesController],
  providers: [StoriesService],
  exports: [StoriesService],
})
export class StoriesModule {}
