// START_MODULE_CONTRACT
// PURPOSE: Authenticate requests by MAX initData — validate signature/freshness and upsert the user.
// SCOPE: authenticate(initData) returns the upserted user or null; fails closed when MAX_BOT_TOKEN is not configured.
// DEPENDS: @nestjs/config, ./max-init-data, ../users/users.service, ../friends/friends.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AuthService - initData validation + user upsert entrypoint shared by guard and login endpoint
// END_MODULE_MAP

import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserEntity } from "../users/user.entity";
import { FriendsService } from "../friends/friends.service";
import { UsersService } from "../users/users.service";
import { validateInitData } from "./max-init-data";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(FriendsService) private readonly friends: FriendsService,
  ) {
    if (!this.config.get<string>("MAX_BOT_TOKEN")) {
      this.logger.warn("MAX_BOT_TOKEN is not set: every initData authentication will be rejected (fail-closed)");
    }
  }

  async authenticate(initData: string): Promise<UserEntity | null> {
    const botToken = this.config.get<string>("MAX_BOT_TOKEN");
    if (!botToken) return null;
    const validated = validateInitData(initData, botToken);
    if (!validated) return null;
    const user = await this.users.upsertFromMax(validated.user);
    try {
      await this.friends.sync(user.id);
    } catch (error: unknown) {
      this.logger.warn(`Friend sync failed: ${error instanceof Error ? error.message : "unknown"}`);
    }
    return user;
  }
}
