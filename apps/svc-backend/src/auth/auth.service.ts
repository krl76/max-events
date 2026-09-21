// START_MODULE_CONTRACT
// PURPOSE: Authenticate requests by MAX initData or organizer Bearer token — validate and upsert/load the user.
// SCOPE: authenticate(initData) returns the upserted user or null (fail-closed without MAX_BOT_TOKEN); organizerLogin issues a Redis-backed Bearer token against ORGANIZER_LOGIN/ORGANIZER_PASSWORD env credentials (fail-closed 503-worthy "disabled" when unset); authenticateOrganizerToken resolves a Bearer token to the organizer user.
// DEPENDS: @nestjs/common, @nestjs/config, @nestjs/typeorm, typeorm, ioredis, node:crypto, ./max-init-data, ../users/users.service, ../users/user.entity, ../friends/friends.service, ../redis/redis.module
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AuthService - initData validation + user upsert entrypoint shared by guard and login endpoint
// - ORGANIZER_SESSION_TTL_SECONDS - organizer Bearer token lifetime (7 days)
// - OrganizerLoginResult - organizerLogin outcome: { token, user } | "disabled" (env unset) | null (bad credentials)
// - AuthService.organizerLogin - env-credential check, find-or-create organizer user, store token in Redis
// - AuthService.authenticateOrganizerToken - Bearer token -> Redis lookup -> organizer user
// END_MODULE_MAP

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import type Redis from "ioredis";
import { QueryFailedError, Repository } from "typeorm";
import { UserEntity } from "../users/user.entity";
import { FriendsService } from "../friends/friends.service";
import { UsersService } from "../users/users.service";
import { REDIS_CLIENT } from "../redis/redis.module";
import { validateInitData } from "./max-init-data";

export const ORGANIZER_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export type OrganizerLoginResult = { token: string; user: UserEntity } | "disabled" | null;

// Hashing both sides normalizes length so timingSafeEqual never throws and leaks nothing about length.
function credentialsEqual(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(FriendsService) private readonly friends: FriendsService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
  ) {
    if (!this.config.get<string>("MAX_BOT_TOKEN")) {
      this.logger.warn("MAX_BOT_TOKEN is not set: every initData authentication will be rejected (fail-closed)");
    }
    if (!this.config.get<string>("ORGANIZER_LOGIN") || !this.config.get<string>("ORGANIZER_PASSWORD")) {
      this.logger.warn("ORGANIZER_LOGIN/ORGANIZER_PASSWORD are not set: organizer login is disabled (fail-closed)");
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

  async organizerLogin(login: string, password: string): Promise<OrganizerLoginResult> {
    const expectedLogin = this.config.get<string>("ORGANIZER_LOGIN");
    const expectedPassword = this.config.get<string>("ORGANIZER_PASSWORD");
    if (!expectedLogin || !expectedPassword) return "disabled";
    if (!credentialsEqual(login, expectedLogin) || !credentialsEqual(password, expectedPassword)) return null;
    const user = await this.findOrCreateOrganizer(login);
    const token = randomBytes(32).toString("hex");
    await this.redis.set(`organizer-session:${token}`, user.id, "EX", ORGANIZER_SESSION_TTL_SECONDS);
    return { token, user };
  }

  async authenticateOrganizerToken(token: string): Promise<UserEntity | null> {
    const userId = await this.redis.get(`organizer-session:${token}`);
    if (!userId) return null;
    return this.userRepo.findOneBy({ id: userId });
  }

  private async findOrCreateOrganizer(login: string): Promise<UserEntity> {
    const maxUserId = `organizer:${login}`;
    const existing = await this.userRepo.findOneBy({ maxUserId });
    if (existing) return existing;
    try {
      return await this.userRepo.save(this.userRepo.create({ maxUserId, firstName: login, lastName: null, username: null, avatarUrl: null }));
    } catch (error) {
      // Concurrent first login lost the insert race: the winner's row is now visible.
      if (error instanceof QueryFailedError && error.driverError?.code === "23505") {
        return this.userRepo.findOneByOrFail({ maxUserId });
      }
      throw error;
    }
  }
}
