import { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";
import type { MaxBotClient } from "../max-bot/max-bot.client";
import { BOT_COMMANDS } from "./bot.service";
import { MAX_UPDATE_TYPES } from "./bot.types";
import { BotSubscribe } from "./bot-subscribe";
import { derivedWebhookSecret } from "./bot-stack";

function createHarness(config: Record<string, unknown> = {}) {
  const calls: Array<{ kind: "subscribe" | "commands"; url?: string; types?: readonly string[]; secret?: string; commands?: unknown }> = [];
  const bot = {
    subscribe: async (url: string, types: readonly string[], secret?: string) => {
      calls.push({ kind: "subscribe", url, types, secret });
      return true;
    },
    setCommands: async (commands: unknown) => {
      calls.push({ kind: "commands", commands });
      return true;
    },
  } as unknown as MaxBotClient;
  const service = new BotSubscribe(new ConfigService({ MAX_BOT_TOKEN: "prod-token", ...config }), bot);
  return { service, calls };
}

describe("BotSubscribe", () => {
  it("points MAX at the prod webhook with the derived secret and publishes commands", async () => {
    const { service, calls } = createHarness();
    await service.register("https://events.versacegus.cc/api/bot/webhook", derivedWebhookSecret("prod-token"));
    expect(calls[0]).toEqual({
      kind: "subscribe",
      url: "https://events.versacegus.cc/api/bot/webhook",
      types: [...MAX_UPDATE_TYPES],
      secret: derivedWebhookSecret("prod-token"),
    });
    expect(calls[1]).toEqual({ kind: "commands", commands: BOT_COMMANDS });
  });

  it("stays inert on kku, without a token, and when long polling is on", () => {
    const kku = createHarness({ AUTH_ALLOW_BROWSER: true });
    kku.service.onModuleInit();
    expect(kku.calls).toEqual([]);

    const bare = createHarness({ MAX_BOT_TOKEN: "" });
    bare.service.onModuleInit();
    expect(bare.calls).toEqual([]);

    const poll = createHarness({ BOT_LONGPOLL: true });
    poll.service.onModuleInit();
    expect(poll.calls).toEqual([]);
  });
});
