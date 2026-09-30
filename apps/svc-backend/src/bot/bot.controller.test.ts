import { NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import { BotController, parseWebhookBody, secretsEqual, webhookSecretOk } from "./bot.controller";
import type { BotService } from "./bot.service";

const secret = "test-secret-value";

describe("secretsEqual", () => {
  it("is true only for the same secret and never throws on a length mismatch", () => {
    expect(secretsEqual(secret, secret)).toBe(true);
    expect(secretsEqual(secret, "other-secret-value")).toBe(false);
    expect(secretsEqual(secret, "short")).toBe(false);
    expect(secretsEqual("", secret)).toBe(false);
  });
});

describe("webhookSecretOk", () => {
  it("requires the exact header when a secret is configured, on any NODE_ENV", () => {
    expect(webhookSecretOk(secret, secret, "production")).toBe(true);
    expect(webhookSecretOk("wrong", secret, "production")).toBe(false);
    expect(webhookSecretOk(undefined, secret, "production")).toBe(false);
    expect(webhookSecretOk(secret, secret, "development")).toBe(true);
  });

  it("without a configured secret answers only on development and test stacks — fail-closed in production", () => {
    expect(webhookSecretOk(undefined, undefined, "production")).toBe(false);
    expect(webhookSecretOk("anything", undefined, "production")).toBe(false);
    expect(webhookSecretOk(undefined, undefined, "development")).toBe(true);
    expect(webhookSecretOk(undefined, undefined, "test")).toBe(true);
    expect(webhookSecretOk(undefined, undefined, undefined)).toBe(false);
  });
});

describe("parseWebhookBody", () => {
  it("reads the raw JSON body main.ts attaches and nulls anything unusable", () => {
    expect(parseWebhookBody({ rawBody: Buffer.from('{"updates":[]}', "utf8") })).toEqual({ updates: [] });
    expect(parseWebhookBody({})).toBeNull();
    expect(parseWebhookBody({ rawBody: Buffer.alloc(0) })).toBeNull();
    expect(parseWebhookBody({ rawBody: Buffer.from("not json", "utf8") })).toBeNull();
  });
});

function createController(config: Record<string, string>) {
  const handled: unknown[] = [];
  const service = {
    parse: (body: unknown) => (Array.isArray((body as { updates?: unknown }).updates) ? [{ marker: true }] : []),
    handleInbound: async (inbound: unknown) => {
      handled.push(inbound);
    },
  } as unknown as BotService;
  const controller = new BotController(service, new ConfigService({ NODE_ENV: "test", BOT_WEBHOOK_SECRET: secret, ...config }));
  return { controller, handled };
}

describe("BotController.webhook", () => {
  it("answers 200 with the secret header and processes the updates after the answer", async () => {
    const { controller, handled } = createController({});
    const answer = controller.webhook(secret, { updates: [{ update_type: "bot_started" }] });
    expect(answer).toEqual({ ok: true });
    // setImmediate: the delivery answer does not wait for the processing loop.
    await new Promise((resolve) => setImmediate(resolve));
    expect(handled).toEqual([{ marker: true }]);
  });

  it("404s without the header, with a wrong header, and on a production stack with no secret configured", () => {
    const secured = createController({});
    expect(() => secured.controller.webhook(undefined, { updates: [] })).toThrow(NotFoundException);
    expect(() => secured.controller.webhook("wrong", { updates: [] })).toThrow(NotFoundException);

    const bare = createController({ NODE_ENV: "production", BOT_WEBHOOK_SECRET: "" });
    expect(() => bare.controller.webhook(undefined, { updates: [] })).toThrow(NotFoundException);
  });

  it("answers 200 even for a body it cannot use, so MAX does not retry for hours", async () => {
    const { controller, handled } = createController({});
    expect(controller.webhook(secret, null)).toEqual({ ok: true });
    await new Promise((resolve) => setImmediate(resolve));
    expect(handled).toEqual([]);
  });

  it("survives a handler that throws after the answer was given", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const service = {
      parse: () => [{ marker: true }],
      handleInbound: async () => {
        throw new Error("db down");
      },
    } as unknown as BotService;
    const controller = new BotController(service, new ConfigService({ NODE_ENV: "test", BOT_WEBHOOK_SECRET: secret }));
    expect(controller.webhook(secret, { updates: [{}] })).toEqual({ ok: true });
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    error.mockRestore();
  });
});
