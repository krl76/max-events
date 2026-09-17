// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring the feed wall.
// SCOPE: Feed post/like/comment entities, Event/User repos, FeedService, FeedController.
// DEPENDS: @nestjs/typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - FeedModule - provides FeedService and FeedController
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventEntity } from "../events/event.entity";
import { UserEntity } from "../users/user.entity";
import { UsersModule } from "../users/users.module";
import { FeedController } from "./feed.controller";
import { FeedCommentEntity, FeedLikeEntity, FeedPostEntity } from "./feed-post.entity";
import { FeedService } from "./feed.service";

@Module({
  imports: [TypeOrmModule.forFeature([FeedPostEntity, FeedLikeEntity, FeedCommentEntity, EventEntity, UserEntity]), UsersModule],
  controllers: [FeedController],
  providers: [FeedService],
  exports: [FeedService],
})
export class FeedModule {}
