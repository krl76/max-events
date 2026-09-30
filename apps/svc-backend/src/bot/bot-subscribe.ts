// START_MODULE_CONTRACT
// PURPOSE: On boot, point MAX at this stack's webhook and publish the slash-command menu — no extra env and no CLI.
// SCOPE: OnModuleInit. Runs only on the MAX production contour (shouldSubscribe). Uses stackOrigin + derived webhookSecret already implied by MAX_BOT_TOKEN. Best-effort: a failed POST is logged without the token or secret; the process stays up. Inert when long polling is on or on the kku browser-auth stack, so a shared token cannot move live deliveries to the demo host.
// DEPENDS: @nestjs/common, @nestjs/config, ../max-bot/max-bot.client, ./bot.service (BOT_COMMANDS), ./bot.types (MAX_UPDATE_TYPES), ./bot-stack
// LINKS: M-SVC-BACKEND, https://dev.max.ru/docs-api/methods/POST/subscriptions
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - BotSubscribe - OnModuleInit subscribe + setCommands
// END_MODULE_MAP

import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MaxBotClient } from "../max-bot/max-bot.client";
import { BOT_COMMANDS } from "./bot.service";
import { MAX_UPDATE_TYPES } from "./bot.types";
import { shouldSubscribe, stackOrigin, webhookSecret, webhookUrl } from "./bot-stack";

@Injectable()
export class BotSubscribe implements OnModuleInit {
  private readonly logger = new Logger(BotSubscribe.name);

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(MaxBotClient) private readonly bot: MaxBotClient,
  ) {}

  onModuleInit(): void {
    const env = {
      MAX_BOT_TOKEN: this.config.get<string>("MAX_BOT_TOKEN"),
      BOT_LONGPOLL: this.config.get("BOT_LONGPOLL"),
      AUTH_ALLOW_BROWSER: this.config.get("AUTH_ALLOW_BROWSER"),
      BOT_PUBLIC_URL: this.config.get<string>("BOT_PUBLIC_URL"),
      PUBLIC_APP_URL: this.config.get<string>("PUBLIC_APP_URL"),
      BOT_WEBHOOK_SECRET: this.config.get<string>("BOT_WEBHOOK_SECRET"),
    };
    if (!shouldSubscribe(env)) return;
    const url = webhookUrl(stackOrigin(env));
    const secret = webhookSecret(env);
    void this.register(url, secret);
  }

  /** Exposed for tests: one subscribe + commands pass, never throws. */
  async register(url: string, secret: string | null): Promise<boolean> {
    const subscribed = await this.bot.subscribe(url, MAX_UPDATE_TYPES, secret ?? undefined);
    if (!subscribed) {
      this.logger.warn(`Webhook subscribe failed for ${url}`);
      return false;
    }
    const commands = await this.bot.setCommands(BOT_COMMANDS);
    if (!commands) this.logger.warn("Bot command menu was not published");
    this.logger.log(`Webhook subscribed: ${url}`);
    return true;
  }
}
