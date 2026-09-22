// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring organizer rating HTTP.
// SCOPE: Event/review/check-in repos, RatingService, controllers; OrganizationsModule resolves an organization id to its organizer user.
// DEPENDS: @nestjs/typeorm, ../organizations/organizations.module
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - RatingModule - provides RatingService
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { OrganizationsModule } from "../organizations/organizations.module";
import { ReviewEntity } from "../reviews/review.entity";
import { EventOrganizerRatingController, OrganizerRatingController } from "./rating.controller";
import { RatingService } from "./rating.service";

@Module({
  imports: [TypeOrmModule.forFeature([EventEntity, ReviewEntity, CheckInEntity]), OrganizationsModule],
  controllers: [OrganizerRatingController, EventOrganizerRatingController],
  providers: [RatingService],
})
export class RatingModule {}
