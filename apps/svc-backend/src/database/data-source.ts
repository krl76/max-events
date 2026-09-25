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
import { StoryEntity } from "../stories/story.entity";
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
import { MicroEventEntity, MicroEventParticipantEntity } from "../microevents/micro-event.entity";
import { ListDigestSendEntity } from "../smart-alerts/list-digest.entity";
import { PageViewEntity } from "../stats/page-view.entity";
import { PromoCampaignEntity } from "../promo/promo-campaign.entity";
import { PromoCodeEntity } from "../promo/promo-code.entity";
import { PromoFulfillmentEntity } from "../promo/promo-fulfillment.entity";
import { PromotionCampaignEntity } from "../promotion/promotion-campaign.entity";
import { PlanExpenseEntity } from "../plans/plan-expense.entity";
import { WeGroupEntity, WeGroupItemEntity, WeGroupMemberEntity } from "../wegroups/we-group.entity";
import { VoteBallotEntity, VoteEntity, VoteOptionEntity, VoteParticipantEntity } from "../votes/vote.entity";
import { PaymentWebhookEventEntity } from "../payments/payment-webhook-event.entity";
import { PaymentEntity } from "../payments/payment.entity";
import { OrganizationEntity } from "../organizations/organization.entity";
import { ListMemberEntity } from "../lists/list-member.entity";
import { NotificationEntity } from "../smart-alerts/notification.entity";
import { SwipeDecisionEntity } from "../swipe/swipe-decision.entity";
import { CalendarGoingEntity } from "../calendar/calendar-going.entity";
import { CalendarInviteEntity } from "../calendar/calendar-invite.entity";
import { CalendarShareEntity } from "../calendar/calendar-share.entity";
import { WeGroupPhotoEntity } from "../wegroups/we-group.entity";
import { PlaceSlotEntity, SlotBookingEntity } from "../slots/slot.entity";

const env = validateEnv();

export const AppDataSource = new DataSource({
  type: "postgres",
  url: env.DATABASE_URL,
  entities: [UserEntity, ProfileEntity, PlaceEntity, EventEntity, BookingEntity, ParticipationEntity, FriendshipEntity, GatheringEntity, GatheringInviteeEntity, PlanEntity, PlanParticipantEntity, PlanExpenseEntity, ListEntity, ListItemEntity, ListMemberEntity, SubscriptionEntity, CheckInEntity, StoryEntity, UserAchievementEntity, ReviewEntity, WaitlistEntryEntity, FeedPostEntity, FeedLikeEntity, FeedCommentEntity, ReportEntity, MicroEventEntity, MicroEventParticipantEntity, ListDigestSendEntity, PageViewEntity, PromoCodeEntity, PromoCampaignEntity, PromoFulfillmentEntity, PromotionCampaignEntity, WeGroupEntity, WeGroupMemberEntity, WeGroupItemEntity, WeGroupPhotoEntity, VoteEntity, VoteOptionEntity, VoteParticipantEntity, VoteBallotEntity, PaymentEntity, PaymentWebhookEventEntity, OrganizationEntity, NotificationEntity, SwipeDecisionEntity, CalendarShareEntity, CalendarInviteEntity, CalendarGoingEntity, PlaceSlotEntity, SlotBookingEntity],
  migrations: ["src/database/migrations/*.ts"],
});
