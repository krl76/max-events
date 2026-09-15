// START_MODULE_CONTRACT
// PURPOSE: Authenticate requests by MAX initData — validate signature/freshness and upsert the user.
// SCOPE: authenticate(initData) returns the upserted user or null; fails closed when MAX_BOT_TOKEN is not configured.
// DEPENDS: @nestjs/config, ./max-init-data, ../users/users.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AuthService - initData validation + user upsert entrypoint shared by guard and login endpoint
// END_MODULE_MAP

import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserEntity } from "../users/user.entity";
import { UsersService } from "../users/users.service";
import { validateInitData } from "./max-init-data";

@Injectable()
export class AuthService {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(UsersService) private readonly users: UsersService,
  ) {}

  async authenticate(initData: string): Promise<UserEntity | null> {
    const botToken = this.config.get<string>("MAX_BOT_TOKEN");
    if (!botToken) return null;
    const validated = validateInitData(initData, botToken);
    if (!validated) return null;
    return this.users.upsertFromMax(validated.user);
  }
}
