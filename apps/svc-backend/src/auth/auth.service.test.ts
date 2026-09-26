import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type Redis from "ioredis";
import type { Repository } from "typeorm";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FriendsService } from "../friends/friends.service";
import type { OrganizationsService } from "../organizations/organizations.service";
import type { UsersService } from "../users/users.service";
import { UserEntity } from "../users/user.entity";
import { AuthService, BROWSER_DEMO_USER } from "./auth.service";
import { validateInitData } from "./max-init-data";

const friends = { sync: async () => [] } as unknown as FriendsService;
const redis = {} as Redis;
const userRepo = { findOneBy: async () => null } as unknown as Repository<UserEntity>;
const organizations = { findByLogin: async () => null } as unknown as OrganizationsService;

function createService(config: Record<string, string>) {
  return new AuthService(new ConfigService(config), {} as UsersService, friends, redis, userRepo, organizations);
}

describe("AuthService bootstrap", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rejects initData when MAX_BOT_TOKEN is not configured", async () => {
    const service = createService({ ORGANIZER_LOGIN: "demo", ORGANIZER_PASSWORD: "demo" });
    await expect(service.authenticate("auth_date=1&hash=abc")).resolves.toBeNull();
  });

  it("does not warn when MAX_BOT_TOKEN is set", () => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    createService({ MAX_BOT_TOKEN: "token", ORGANIZER_LOGIN: "demo", ORGANIZER_PASSWORD: "demo" });
    expect(warn).not.toHaveBeenCalled();
  });

  it("mints signed browser initData only when AUTH_ALLOW_BROWSER is on", async () => {
    await expect(createService({ MAX_BOT_TOKEN: "token" }).issueBrowserInitData(1_800_000_000)).resolves.toBe("disabled");
    const signed = await createService({ MAX_BOT_TOKEN: "token", AUTH_ALLOW_BROWSER: "true" }).issueBrowserInitData(1_800_000_000);
    expect(signed).not.toBe("disabled");
    const parsed = validateInitData(signed as string, "token", 1_800_000_000);
    expect(parsed?.user.id).toBe(BROWSER_DEMO_USER.id);
    expect(parsed?.user.first_name).toBe(BROWSER_DEMO_USER.first_name);
  });

  it("does not put a stored profile avatar into browser initData photo_url", async () => {
    const userRepoWithAvatar = { findOneBy: async () => ({ avatarUrl: "data:image/jpeg;base64,abc" }) } as unknown as Repository<UserEntity>;
    const service = new AuthService(new ConfigService({ MAX_BOT_TOKEN: "token", AUTH_ALLOW_BROWSER: "true" }), {} as UsersService, friends, redis, userRepoWithAvatar, organizations);
    const signed = await service.issueBrowserInitData(1_800_000_000);
    const parsed = validateInitData(signed as string, "token", 1_800_000_000);
    expect(parsed?.user.photo_url).toBeUndefined();
  });

  it("warns when organizer credentials are not configured", () => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    createService({ MAX_BOT_TOKEN: "token" });
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).not.toContain("ORGANIZER_PASSWORD=");
  });
});
