// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring the feed wall.
// SCOPE: Feed post/like/comment entities, Event/User/Place/Participation/Friendship repos, FeedService, FeedController.
// DEPENDS: @nestjs/typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - FeedModule - provides FeedService and FeedController; imports Places and Waitlist for cards
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BookingsModule } from "../bookings/bookings.module";
import { EventEntity } from "../events/event.entity";
import { FriendshipEntity } from "../friends/friendship.entity";
import { ParticipationEntity } from "../participations/participation.entity";
import { PlaceEntity } from "../places/place.entity";
import { PlacesModule } from "../places/places.module";
import { UserEntity } from "../users/user.entity";
import { UsersModule } from "../users/users.module";
import { WaitlistModule } from "../waitlist/waitlist.module";
import { FeedController } from "./feed.controller";
import { FeedDraftEntity } from "./feed-draft.entity";
import { FeedCommentEntity, FeedLikeEntity, FeedPostEntity } from "./feed-post.entity";
import { FeedService } from "./feed.service";

@Module({
  imports: [TypeOrmModule.forFeature([FeedPostEntity, FeedLikeEntity, FeedCommentEntity, FeedDraftEntity, EventEntity, UserEntity, PlaceEntity, ParticipationEntity, FriendshipEntity]), UsersModule, PlacesModule, WaitlistModule, BookingsModule],
  controllers: [FeedController],
  providers: [FeedService],
  exports: [FeedService],
})
export class FeedModule {}
