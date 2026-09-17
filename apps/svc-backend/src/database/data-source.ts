// START_MODULE_CONTRACT
// PURPOSE: Standalone TypeORM DataSource for the migration CLI (generate/run/revert).
// SCOPE: Postgres connection from validated env; migration sources in src/database/migrations.
// DEPENDS: typeorm, config/env
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AppDataSource - standalone TypeORM DataSource consumed by the migration CLI
// END_MODULE_MAP

import "reflect-metadata";
import { DataSource } from "typeorm";
import { validateEnv } from "../config/env";
import { UserAchievementEntity } from "../achievements/user-achievement.entity";
import { BookingEntity } from "../bookings/booking.entity";
import { CheckInEntity } from "../checkins/check-in.entity";
import { FeedCommentEntity, FeedLikeEntity, FeedPostEntity } from "../feed/feed-post.entity";
import { ReportEntity } from "../reports/report.entity";
import { ReviewEntity } from "../reviews/review.entity";
import { WaitlistEntryEntity } from "../waitlist/waitlist-entry.entity";
import { EventEntity } from "../events/event.entity";
import { FriendshipEntity } from "../friends/friendship.entity";
import { GatheringInviteeEntity } from "../gatherings/gathering-invitee.entity";
import { GatheringEntity } from "../gatherings/gathering.entity";
import { ListItemEntity } from "../lists/list-item.entity";
import { ListEntity } from "../lists/list.entity";
import { SubscriptionEntity } from "../subscriptions/subscription.entity";
import { PlanParticipantEntity } from "../plans/plan-participant.entity";
import { PlanEntity } from "../plans/plan.entity";
import { ParticipationEntity } from "../participations/participation.entity";
import { PlaceEntity } from "../places/place.entity";
import { ProfileEntity } from "../users/profile.entity";
import { UserEntity } from "../users/user.entity";

const env = validateEnv();

export const AppDataSource = new DataSource({
  type: "postgres",
  url: env.DATABASE_URL,
  entities: [UserEntity, ProfileEntity, PlaceEntity, EventEntity, BookingEntity, ParticipationEntity, FriendshipEntity, GatheringEntity, GatheringInviteeEntity, PlanEntity, PlanParticipantEntity, ListEntity, ListItemEntity, SubscriptionEntity, CheckInEntity, UserAchievementEntity, ReviewEntity, WaitlistEntryEntity, FeedPostEntity, FeedLikeEntity, FeedCommentEntity, ReportEntity],
  migrations: ["src/database/migrations/*.ts"],
});
