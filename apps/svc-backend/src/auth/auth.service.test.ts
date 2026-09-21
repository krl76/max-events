import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type Redis from "ioredis";
import type { Repository } from "typeorm";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FriendsService } from "../friends/friends.service";
import type { UsersService } from "../users/users.service";
import { UserEntity } from "../users/user.entity";
import { AuthService } from "./auth.service";

const friends = { sync: async () => [] } as unknown as FriendsService;
const redis = {} as Redis;
const userRepo = {} as Repository<UserEntity>;

function createService(config: Record<string, string>) {
  return new AuthService(new ConfigService(config), {} as UsersService, friends, redis, userRepo);
}

describe("AuthService bootstrap", () => {
  afterEach(() => vi.restoreAllMocks());

  it("warns once when MAX_BOT_TOKEN is not configured", () => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    createService({ ORGANIZER_LOGIN: "demo", ORGANIZER_PASSWORD: "demo" });
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).not.toContain("MAX_BOT_TOKEN=");
  });

  it("does not warn when MAX_BOT_TOKEN is set", () => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    createService({ MAX_BOT_TOKEN: "token", ORGANIZER_LOGIN: "demo", ORGANIZER_PASSWORD: "demo" });
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns when organizer credentials are not configured", () => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    createService({ MAX_BOT_TOKEN: "token" });
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).not.toContain("ORGANIZER_PASSWORD=");
  });
});
