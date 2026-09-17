import { ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";
import { UserEntity } from "../users/user.entity";
import { assertModerator } from "./moderators";

const user = { maxUserId: "42" } as UserEntity;

describe("assertModerator", () => {
  it("forbids when the allowlist is empty (fail-closed)", () => {
    expect(() => assertModerator(new ConfigService({}), user)).toThrow(ForbiddenException);
  });

  it("forbids a user who is not on the allowlist", () => {
    expect(() => assertModerator(new ConfigService({ MODERATOR_MAX_USER_IDS: "1,2" }), user)).toThrow(ForbiddenException);
  });

  it("allows a listed MAX user id", () => {
    expect(() => assertModerator(new ConfigService({ MODERATOR_MAX_USER_IDS: "1, 42" }), user)).not.toThrow();
  });
});
