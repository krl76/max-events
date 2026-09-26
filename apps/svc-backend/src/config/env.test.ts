import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL_API_MODELS, DEFAULT_MODEL_API_URL, envSchema, parseModeratorIds, validateEnv } from "./env";

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
    expect(validateEnv(valid).PAYMENT_COMMISSION_BPS).toBe(1000);
    expect(validateEnv({ ...valid, PAYMENT_PROVIDER: "sandbox" }).PAYMENT_PROVIDER).toBe("sandbox");
    expect(() => validateEnv({ ...valid, PAYMENT_PROVIDER: "live" })).toThrow(/PAYMENT_PROVIDER/);
  });

  it("keeps browser auth off unless AUTH_ALLOW_BROWSER is explicitly true", () => {
    expect(validateEnv(valid).AUTH_ALLOW_BROWSER).toBe(false);
    expect(validateEnv({ ...valid, AUTH_ALLOW_BROWSER: "true" }).AUTH_ALLOW_BROWSER).toBe(true);
    expect(() => validateEnv({ ...valid, AUTH_ALLOW_BROWSER: "yes" })).toThrow(/AUTH_ALLOW_BROWSER/);
  });

  it("reads an unset NODE_ENV as production, so demo-only switches stay locked", () => {
    expect(validateEnv(valid).NODE_ENV).toBe("production");
    expect(validateEnv({ ...valid, NODE_ENV: "development" }).NODE_ENV).toBe("development");
  });

  it("keeps the friends demo fallback off unless it is switched on explicitly", () => {
    expect(validateEnv(valid).FRIENDS_DEMO_ALL_USERS).toBe(false);
    expect(validateEnv({ ...valid, FRIENDS_DEMO_ALL_USERS: "true" }).FRIENDS_DEMO_ALL_USERS).toBe(true);
    expect(() => validateEnv({ ...valid, FRIENDS_DEMO_ALL_USERS: "yes" })).toThrow(/FRIENDS_DEMO_ALL_USERS/);
  });

  it("accepts optional organizer panel credentials and defaults them to unset", () => {
    expect(validateEnv(valid).ORGANIZER_LOGIN).toBeUndefined();
    expect(validateEnv({ ...valid, ORGANIZER_LOGIN: "demo", ORGANIZER_PASSWORD: "s3cret" })).toMatchObject({ ORGANIZER_LOGIN: "demo", ORGANIZER_PASSWORD: "s3cret" });
    expect(() => validateEnv({ ...valid, ORGANIZER_PASSWORD: "" })).toThrow(/ORGANIZER_PASSWORD/);
  });

  it("keeps the model API off until a key is set and parses the model list", () => {
    expect(validateEnv(valid).MODEL_API_KEY).toBeUndefined();
    expect(validateEnv(valid).MODEL_API_URL).toBe(DEFAULT_MODEL_API_URL);
    expect(validateEnv(valid).MODEL_API_MODELS).toEqual([...DEFAULT_MODEL_API_MODELS]);
    expect(validateEnv(valid).MODEL_API_MODELS[0]).toBe("qwen/qwen3.8-27b:free");
    expect(validateEnv(valid).MODEL_API_MODELS[1]).toBe("z-ai/glm-5.2:free");
    expect(validateEnv(valid).MODEL_API_MODELS.at(-1)).toBe("liquid/lfm-2.5-2.6b:free");
    expect(validateEnv({ ...valid, MODEL_API_KEY: "replace-with-your-model-api-key", MODEL_API_MODELS: "fast, fast, slow" }).MODEL_API_MODELS).toEqual(["fast", "slow"]);
    expect(() => validateEnv({ ...valid, MODEL_API_URL: "not-a-url" })).toThrow(/MODEL_API_URL/);
    expect(() => validateEnv({ ...valid, MODEL_API_KEY: "" })).toThrow(/MODEL_API_KEY/);
  });
});

describe("parseModeratorIds", () => {
  it("is empty when unset and splits a comma list", () => {
    expect(parseModeratorIds(undefined).size).toBe(0);
    expect([...parseModeratorIds("1, 42,")]).toEqual(["1", "42"]);
  });
});
