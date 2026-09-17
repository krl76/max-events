// START_MODULE_CONTRACT
// PURPOSE: Fail-closed moderator check against MODERATOR_MAX_USER_IDS (MAX user ids).
// SCOPE: assertModerator throws 403 when the current user's maxUserId is not on the allowlist.
// DEPENDS: @nestjs/common, @nestjs/config, ../config/env, ../users/user.entity
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - assertModerator - 403 unless maxUserId is in MODERATOR_MAX_USER_IDS
// END_MODULE_MAP

import { ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { parseModeratorIds } from "../config/env";
import { UserEntity } from "../users/user.entity";

export function assertModerator(config: ConfigService, user: UserEntity): void {
  const allowed = parseModeratorIds(config.get<string>("MODERATOR_MAX_USER_IDS"));
  if (!allowed.has(user.maxUserId)) throw new ForbiddenException("Moderator only");
}
