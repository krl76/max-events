// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring achievements (catalog, grants, HTTP).
// SCOPE: Registers UserAchievementEntity, AchievementsService, AchievementsController; imports CheckInsModule.
// DEPENDS: @nestjs/typeorm, ../checkins/check-ins.module
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AchievementsModule - provides AchievementsService and AchievementsController
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CheckInsModule } from "../checkins/check-ins.module";
import { UserAchievementEntity } from "./user-achievement.entity";
import { AchievementsController } from "./achievements.controller";
import { AchievementsService } from "./achievements.service";

@Module({
  imports: [TypeOrmModule.forFeature([UserAchievementEntity]), CheckInsModule],
  controllers: [AchievementsController],
  providers: [AchievementsService],
})
export class AchievementsModule {}
