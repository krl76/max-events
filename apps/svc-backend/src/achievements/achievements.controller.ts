// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for achievements — GET /users/:userId/achievements.
// SCOPE: CurrentUser identity; 403 for another user.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth/auth.guard, ./achievements.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AchievementsController - GET /users/:userId/achievements
// END_MODULE_MAP

import { Controller, Get, Inject, Param, ParseUUIDPipe } from "@nestjs/common";
import type { Achievement } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { AchievementsService } from "./achievements.service";

@Controller("users")
export class AchievementsController {
  constructor(@Inject(AchievementsService) private readonly achievements: AchievementsService) {}

  @Get(":userId/achievements")
  async list(@CurrentUser() user: UserEntity, @Param("userId", ParseUUIDPipe) userId: string): Promise<Achievement[]> {
    return this.achievements.list(userId, user.id);
  }
}
