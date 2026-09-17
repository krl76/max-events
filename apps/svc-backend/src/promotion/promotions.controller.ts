// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for active promotion placements and targeted collections.
// SCOPE: GET /promotions/placements; GET /promotions/for-me.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PromotionsController - placements and for-me
// END_MODULE_MAP

import { Controller, Get, Inject } from "@nestjs/common";
import type { PromotionPlacements, TargetedPromotionsResponse } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { PromotionService } from "./promotion.service";

@Controller("promotions")
export class PromotionsController {
  constructor(@Inject(PromotionService) private readonly promotions: PromotionService) {}

  @Get("placements")
  placements(): Promise<PromotionPlacements> {
    return this.promotions.placements();
  }

  @Get("for-me")
  forMe(@CurrentUser() user: UserEntity): Promise<TargetedPromotionsResponse> {
    return this.promotions.targetedFor(user.id);
  }
}
