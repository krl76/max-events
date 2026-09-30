import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DEFAULT_KKU_ORIGIN, DEFAULT_PROD_ORIGIN, derivedWebhookSecret, flagOn, shouldSubscribe, stackOrigin, webhookSecret, webhookUrl } from "./bot-stack";

describe("flagOn", () => {
  it("accepts the boolean and the string ConfigService may store", () => {
    expect(flagOn(true)).toBe(true);
    expect(flagOn("true")).toBe(true);
    expect(flagOn(false)).toBe(false);
    expect(flagOn("false")).toBe(false);
    expect(flagOn(undefined)).toBe(false);
  });
});

describe("stackOrigin", () => {
  it("defaults to the production mini-app host", () => {
    expect(stackOrigin({})).toBe(DEFAULT_PROD_ORIGIN);
  });

  it("uses the kku host when browser auth marks that contour", () => {
    expect(stackOrigin({ AUTH_ALLOW_BROWSER: true })).toBe(DEFAULT_KKU_ORIGIN);
    expect(stackOrigin({ AUTH_ALLOW_BROWSER: "true" })).toBe(DEFAULT_KKU_ORIGIN);
  });

  it("prefers BOT_PUBLIC_URL, then PUBLIC_APP_URL already on some stacks", () => {
    expect(stackOrigin({ BOT_PUBLIC_URL: "https://events.versacegus.cc/", PUBLIC_APP_URL: "https://ignored.example" })).toBe("https://events.versacegus.cc");
    expect(stackOrigin({ PUBLIC_APP_URL: "https://events.versacegus.cc" })).toBe("https://events.versacegus.cc");
    expect(stackOrigin({ BOT_PUBLIC_URL: "   " })).toBe(DEFAULT_PROD_ORIGIN);
  });
});

describe("webhookUrl", () => {
  it("is the public /api/bot/webhook on that origin", () => {
    expect(webhookUrl(DEFAULT_PROD_ORIGIN)).toBe("https://events.versacegus.cc/api/bot/webhook");
  });
});

describe("webhookSecret", () => {
  it("is a 64-char hex SHA-256 of the token and a purpose string, not the token itself", () => {
    const token = "prod-bot-token";
    const secret = derivedWebhookSecret(token);
    expect(secret).toMatch(/^[0-9a-f]{64}$/);
    expect(secret).toBe(createHash("sha256").update(`max-events.bot.webhook.v1\0${token}`).digest("hex"));
    expect(secret).not.toBe(token);
    expect(webhookSecret({ MAX_BOT_TOKEN: token })).toBe(secret);
  });

  it("keeps an explicit BOT_WEBHOOK_SECRET and treats a blank as unset", () => {
    expect(webhookSecret({ BOT_WEBHOOK_SECRET: "explicit-secret", MAX_BOT_TOKEN: "token" })).toBe("explicit-secret");
    expect(webhookSecret({ BOT_WEBHOOK_SECRET: "  ", MAX_BOT_TOKEN: "token" })).toBe(derivedWebhookSecret("token"));
    expect(webhookSecret({})).toBeNull();
  });
});

describe("shouldSubscribe", () => {
  it("subscribes only on the MAX production contour", () => {
    expect(shouldSubscribe({ MAX_BOT_TOKEN: "token" })).toBe(true);
    expect(shouldSubscribe({})).toBe(false);
    expect(shouldSubscribe({ MAX_BOT_TOKEN: "token", BOT_LONGPOLL: true })).toBe(false);
    expect(shouldSubscribe({ MAX_BOT_TOKEN: "token", AUTH_ALLOW_BROWSER: true })).toBe(false);
  });
});
