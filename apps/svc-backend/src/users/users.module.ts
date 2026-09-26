// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring users and current-user profiles.
// SCOPE: Registers UserEntity/ProfileEntity plus profile-surface aggregates, UsersService, ProfilesService and HTTP controllers.
// DEPENDS: @nestjs/typeorm, ./user.entity, ./users.service, ./profile.entity, ./profiles.service, ./profiles.controller
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - UsersModule - provides UsersService, ProfilesService and ProfilesController
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { FeedCommentEntity, FeedLikeEntity, FeedPostEntity } from "../feed/feed-post.entity";
import { PlaceEntity } from "../places/place.entity";
import { ProfileEntity } from "./profile.entity";
import { ProfileSurfaceController } from "./profile-surface.controller";
import { ProfileSurfaceService } from "./profile-surface.service";
import { ProfilesController } from "./profiles.controller";
import { ProfilesService } from "./profiles.service";
import { UserEntity } from "./user.entity";
import { UsersService } from "./users.service";

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, ProfileEntity, CheckInEntity, EventEntity, PlaceEntity, FeedPostEntity, FeedLikeEntity, FeedCommentEntity])],
  controllers: [ProfilesController, ProfileSurfaceController],
  providers: [UsersService, ProfilesService, ProfileSurfaceService],
  exports: [UsersService, ProfilesService],
})
export class UsersModule {}
