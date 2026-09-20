// START_MODULE_CONTRACT
// PURPOSE: Participant-facing referral surface — the code a user can share for an event.
// SCOPE: GET /events/:id/referral; 404 when the event has no active refer-a-friend campaign.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ./promo.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - EventReferralController - GET /events/:id/referral
// END_MODULE_MAP

import { Controller, Get, Inject, Param, ParseUUIDPipe } from "@nestjs/common";
import type { PromoCampaign } from "@max-events/api-contracts";
import { PromoService } from "./promo.service";

@Controller("events")
export class EventReferralController {
  constructor(@Inject(PromoService) private readonly promo: PromoService) {}

  @Get(":id/referral")
  referral(@Param("id", ParseUUIDPipe) id: string): Promise<PromoCampaign> {
    return this.promo.activeReferral(id);
  }
}
