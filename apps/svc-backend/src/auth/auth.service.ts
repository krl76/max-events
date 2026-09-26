// START_MODULE_CONTRACT
// PURPOSE: Authenticate requests by MAX initData or organizer Bearer token — validate and upsert/load the user.
// SCOPE: authenticate(initData) returns the upserted user or null (fail-closed without MAX_BOT_TOKEN); organizerLogin issues a Redis-backed Bearer token against the Organization account row (ORGANIZER_LOGIN/ORGANIZER_PASSWORD provision that row once, fail-closed 503-worthy "disabled" when there is neither row nor env, "locked" after 5 failed attempts for 60s); organizerLogout revokes a Bearer session; authenticateOrganizerToken resolves a Bearer token to the organizer user.
// DEPENDS: @nestjs/common, @nestjs/config, @nestjs/typeorm, typeorm, ioredis, node:crypto, ./max-init-data, ../users/users.service, ../users/user.entity, ../friends/friends.service, ../organizations/organizations.service, ../redis/redis.module
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AuthService - initData validation + user upsert entrypoint shared by guard and login endpoint
// - ORGANIZER_SESSION_TTL_SECONDS - organizer Bearer token lifetime (7 days)
// - ORGANIZER_LOGIN_MAX_FAILS - failed organizer login attempts per login name before the lock kicks in
// - ORGANIZER_LOGIN_WINDOW_SECONDS - TTL of the failure counter (60s), which doubles as the lock
// - OrganizerLoginResult - organizerLogin outcome: { token, user, organization } | "disabled" (no account and no env credentials) | "locked" (rate limited) | null (bad credentials)
// - AuthService.organizerLogin - organization-account credential check, rate limit, find-or-create organizer user, store token in Redis
// - AuthService.organizerLogout - delete organizer-session:{token} from Redis
// - AuthService.authenticateOrganizerSession - Bearer token -> Redis lookup -> organizer user + organization
// - AuthService.authenticateOrganizerToken - Bearer token -> organizer user (session.user)
// - BROWSER_DEFAULT_USER - owner MAX payload minted for AUTH_ALLOW_BROWSER (keep in sync with tools/max-dev-accounts.json)
// - BROWSER_DEMO_USER - alias of BROWSER_DEFAULT_USER
// - AuthService.issueBrowserInitData - signed initData for the staging browser host, or "disabled"; does not copy a stored avatar into photo_url
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
import { OrganizationEntity } from "../organizations/organization.entity";
import { OrganizationsService } from "../organizations/organizations.service";
import { organizerMaxUserId } from "../organizations/organizer-account";
import { isPasswordUnset } from "../organizations/password";
import { REDIS_CLIENT } from "../redis/redis.module";
import { organizerSessionKey } from "./organizer-session-key";
import { signInitData, validateInitData } from "./max-init-data";

/** Staging browser contour. Same person as tools/max-dev-accounts.json `owner`. Override with AUTH_BROWSER_USER JSON. */
export const BROWSER_DEFAULT_USER = { id: 88847255, first_name: "Михаил", username: "seaG7", language_code: "ru" };
export const BROWSER_DEMO_USER = BROWSER_DEFAULT_USER;

export const ORGANIZER_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export const ORGANIZER_LOGIN_MAX_FAILS = 5;
export const ORGANIZER_LOGIN_WINDOW_SECONDS = 60;

export type OrganizerLoginResult = { token: string; user: UserEntity; organization: OrganizationEntity } | "disabled" | "locked" | null;

// Hashing both sides normalizes length so timingSafeEqual never throws and leaks nothing about length.
function credentialsEqual(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

function isEnabled(value: unknown): boolean {
  return value === true || value === "true";
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
    @Inject(OrganizationsService) private readonly organizations: OrganizationsService,
  ) {
    if (!this.config.get<string>("MAX_BOT_TOKEN")) {
      this.logger.warn("MAX_BOT_TOKEN is not set: every initData authentication will be rejected (fail-closed)");
    }
    if (!this.config.get<string>("ORGANIZER_LOGIN") || !this.config.get<string>("ORGANIZER_PASSWORD")) {
      this.logger.warn("ORGANIZER_LOGIN/ORGANIZER_PASSWORD are not set: only organization accounts already in the database can log in");
    }
  }

  async issueBrowserInitData(nowSeconds: number = Math.floor(Date.now() / 1000)): Promise<string | "disabled"> {
    if (!isEnabled(this.config.get("AUTH_ALLOW_BROWSER"))) return "disabled";
    const botToken = this.config.get<string>("MAX_BOT_TOKEN");
    if (!botToken) return "disabled";
    const base = this.browserUser();
    return signInitData({ auth_date: String(nowSeconds), user: JSON.stringify(base) }, botToken);
  }

  private browserUser(): { id: number; first_name: string; username?: string | null; language_code?: string } {
    const raw = this.config.get<string>("AUTH_BROWSER_USER");
    if (!raw) return BROWSER_DEFAULT_USER;
    try {
      const parsed = JSON.parse(raw) as { id: number; first_name: string; username?: string | null; language_code?: string };
      if (typeof parsed.id === "number" && parsed.id > 0 && typeof parsed.first_name === "string" && parsed.first_name.length > 0) return parsed;
    } catch {
      this.logger.warn("AUTH_BROWSER_USER is not valid JSON; using BROWSER_DEFAULT_USER");
    }
    return BROWSER_DEFAULT_USER;
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
    // "disabled" must not depend on the submitted login, or the 503/401 split would tell an
    // anonymous caller which organizer logins exist. Both checks below are login-independent.
    const envLogin = this.config.get<string>("ORGANIZER_LOGIN");
    const envPassword = this.config.get<string>("ORGANIZER_PASSWORD");
    // countWithPassword, not count: the seeded account has no credentials, so a host with nothing
    // configured still answers "disabled" instead of failing logins against a row nobody can use.
    if ((!envLogin || !envPassword) && (await this.organizations.countWithPassword()) === 0) return "disabled";
    // INCR-first: the counter itself is the lock. Redis serializes INCR, so a concurrent burst
    // cannot slip past the limit. TTL is set once via SET NX — never refreshed, so flooding
    // cannot extend the lock — and the key always carries a TTL (no INCR/EXPIRE crash gap).
    // It also runs before any lookup, so an anonymous caller cannot probe the table for free.
    const failKey = `organizer-login-fail:${login}`;
    await this.redis.set(failKey, "0", "EX", ORGANIZER_LOGIN_WINDOW_SECONDS, "NX");
    const fails = await this.redis.incr(failKey);
    if (fails > ORGANIZER_LOGIN_MAX_FAILS) return "locked";
    const stored = await this.organizations.findByLogin(login);
    const organization = stored ? await this.openStored(stored, login, password) : await this.provisionFromEnv(login, password);
    if (!organization) return null;
    await this.redis.del(failKey);
    const user = await this.findOrCreateOrganizer(login);
    // The panel reads the organization id; its content is still keyed by the organizer user, so the
    // row keeps the link until T-004 moves the binding onto the organization itself.
    const linked = await this.organizations.linkOrganizerUser(organization, user.id);
    const token = randomBytes(32).toString("hex");
    await this.redis.set(organizerSessionKey(token), linked.id, "EX", ORGANIZER_SESSION_TTL_SECONDS);
    return { token, user, organization: linked };
  }

  /**
   * The seed creates the account that owns the starter catalog, but chooses no password for it, so the
   * documented env pair has to be able to claim an existing credential-less row — otherwise seeding a
   * host would lock its operator out of the panel forever.
   */
  private async openStored(stored: OrganizationEntity, login: string, password: string): Promise<OrganizationEntity | null> {
    if (await this.organizations.verifyPassword(stored, password)) return stored;
    if (!isPasswordUnset(stored.passwordHash) || !this.envCredentialsMatch(login, password)) return null;
    this.logger.warn(`Organizer account "${login}" had no password: claimed by the configured credentials`);
    return this.organizations.setPassword(stored, password);
  }

  /**
   * First login for operator-configured credentials creates the account row, after which the database is
   * the only source of truth. The env pair is supplied by the operator, so this is provisioning, not sign-up.
   */
  private async provisionFromEnv(login: string, password: string): Promise<OrganizationEntity | null> {
    if (!this.envCredentialsMatch(login, password)) return null;
    return this.organizations.provision({ login, password });
  }

  private envCredentialsMatch(login: string, password: string): boolean {
    const envLogin = this.config.get<string>("ORGANIZER_LOGIN");
    const envPassword = this.config.get<string>("ORGANIZER_PASSWORD");
    if (!envLogin || !envPassword) return false;
    return credentialsEqual(login, envLogin) && credentialsEqual(password, envPassword);
  }

  async organizerLogout(token: string): Promise<void> {
    await this.redis.del(organizerSessionKey(token));
  }

  async authenticateOrganizerSession(token: string): Promise<{ user: UserEntity; organization: OrganizationEntity } | null> {
    const stored = await this.redis.get(organizerSessionKey(token));
    if (!stored) return null;
    const byOrg = await this.organizations.findById(stored);
    if (byOrg?.organizerUserId) {
      const user = await this.userRepo.findOneBy({ id: byOrg.organizerUserId });
      if (user) return { user, organization: byOrg };
    }
    // Sessions issued before T-003 stored the organizer user id. Resolve the linked organization.
    const user = await this.userRepo.findOneBy({ id: stored });
    if (!user) return null;
    const organization = await this.organizations.findByOrganizerUserId(user.id);
    if (!organization) return null;
    return { user, organization };
  }

  async authenticateOrganizerToken(token: string): Promise<UserEntity | null> {
    const session = await this.authenticateOrganizerSession(token);
    return session?.user ?? null;
  }

  private async findOrCreateOrganizer(login: string): Promise<UserEntity> {
    const maxUserId = organizerMaxUserId(login);
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
