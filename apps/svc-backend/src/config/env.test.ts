import { describe, expect, it } from "vitest";
import { envSchema, parseModeratorIds, validateEnv } from "./env";

const valid = {
  DATABASE_URL: "postgres://max_events:max_events@localhost:5443/max_events",
  REDIS_URL: "redis://localhost:6391",
};

describe("validateEnv", () => {
  it("accepts a valid environment and defaults PORT to 3100", () => {
    expect(validateEnv(valid)).toMatchObject({ PORT: 3100 });
  });

  it("fails fast when DATABASE_URL is missing", () => {
    expect(() => validateEnv({ REDIS_URL: valid.REDIS_URL })).toThrow(/DATABASE_URL/);
  });

  it("fails fast when REDIS_URL is not a redis connection string", () => {
    expect(() => validateEnv({ ...valid, REDIS_URL: "postgres://nope" })).toThrow(/REDIS_URL/);
  });

  it("coerces PORT and rejects non-positive values", () => {
    expect(validateEnv({ ...valid, PORT: "3001" }).PORT).toBe(3001);
    expect(() => validateEnv({ ...valid, PORT: "-1" })).toThrow(/PORT/);
  });

  it("rejects a DATABASE_URL pointing at a non-postgres scheme", () => {
    expect(() => validateEnv({ ...valid, DATABASE_URL: "mysql://localhost/db" })).toThrow(/DATABASE_URL/);
  });

  it("schema is exported so consumers can extend it additively", () => {
    expect(envSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts an optional moderator allowlist", () => {
    expect(validateEnv({ ...valid, MODERATOR_MAX_USER_IDS: "1, 2" }).MODERATOR_MAX_USER_IDS).toBe("1, 2");
  });

  it("defaults the payment provider to none and accepts sandbox", () => {
    expect(validateEnv(valid).PAYMENT_PROVIDER).toBe("none");
    expect(validateEnv(valid).PAYMENT_SANDBOX_FAIL_AMOUNT).toBe(13);
    expect(validateEnv({ ...valid, PAYMENT_PROVIDER: "sandbox" }).PAYMENT_PROVIDER).toBe("sandbox");
    expect(() => validateEnv({ ...valid, PAYMENT_PROVIDER: "live" })).toThrow(/PAYMENT_PROVIDER/);
  });
});

describe("parseModeratorIds", () => {
  it("is empty when unset and splits a comma list", () => {
    expect(parseModeratorIds(undefined).size).toBe(0);
    expect([...parseModeratorIds("1, 42,")]).toEqual(["1", "42"]);
  });
});
