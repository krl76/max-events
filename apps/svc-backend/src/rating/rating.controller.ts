// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for organizer rating on organizer and event pages.
// SCOPE: GET /organizers/:userId/rating, GET /events/:id/organizer-rating.
// DEPENDS: @nestjs/common, ./rating.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OrganizerRatingController - GET /organizers/:userId/rating
// - EventOrganizerRatingController - GET /events/:id/organizer-rating
// END_MODULE_MAP

import { Controller, Get, Inject, Param, ParseUUIDPipe } from "@nestjs/common";
import type { OrganizerRatingResponse } from "@max-events/api-contracts";
import { RatingService } from "./rating.service";

@Controller("organizers")
export class OrganizerRatingController {
  constructor(@Inject(RatingService) private readonly ratings: RatingService) {}

  @Get(":userId/rating")
  forOrganizer(@Param("userId", ParseUUIDPipe) userId: string): Promise<OrganizerRatingResponse> {
    return this.ratings.forOrganizer(userId);
  }
}

@Controller("events")
export class EventOrganizerRatingController {
  constructor(@Inject(RatingService) private readonly ratings: RatingService) {}

  @Get(":id/organizer-rating")
  forEvent(@Param("id", ParseUUIDPipe) id: string): Promise<OrganizerRatingResponse> {
    return this.ratings.forEvent(id);
  }
}
