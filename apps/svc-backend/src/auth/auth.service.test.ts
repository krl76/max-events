import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FriendsService } from "../friends/friends.service";
import type { UsersService } from "../users/users.service";
import { AuthService } from "./auth.service";

const friends = { sync: async () => [] } as unknown as FriendsService;

describe("AuthService bootstrap", () => {
  afterEach(() => vi.restoreAllMocks());

  it("warns once when MAX_BOT_TOKEN is not configured", () => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    new AuthService(new ConfigService({}), {} as UsersService, friends);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).not.toContain("MAX_BOT_TOKEN=");
  });

  it("does not warn when MAX_BOT_TOKEN is set", () => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    new AuthService(new ConfigService({ MAX_BOT_TOKEN: "token" }), {} as UsersService, friends);
    expect(warn).not.toHaveBeenCalled();
  });
});
