// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring paid promotion campaigns.
// SCOPE: PromotionCampaign and Event repos, PromotionService; exported for organizer.
// DEPENDS: @nestjs/typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PromotionModule - provides PromotionService
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventEntity } from "../events/event.entity";
import { PromotionCampaignEntity } from "./promotion-campaign.entity";
import { PromotionService } from "./promotion.service";

@Module({
  imports: [TypeOrmModule.forFeature([PromotionCampaignEntity, EventEntity])],
  providers: [PromotionService],
  exports: [PromotionService],
})
export class PromotionModule {}
