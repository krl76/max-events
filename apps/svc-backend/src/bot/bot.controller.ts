// START_MODULE_CONTRACT
// PURPOSE: Public webhook endpoint where MAX delivers bot updates.
// SCOPE: POST /bot/webhook; @Public. Authenticates the delivery by the X-Max-Bot-Api-Secret header against BOT_WEBHOOK_SECRET (timing-safe): a configured secret is mandatory, and when none is configured the endpoint answers 404 unless NODE_ENV is development or test. Always 200 on an accepted delivery — MAX retries a non-200 for up to 8 hours and then unsubscribes the bot; processing happens after the answer via setImmediate so a slow model call cannot time the delivery out. Never logs update bodies.
// DEPENDS: @nestjs/common, @nestjs/config, node:crypto, node:timers, express (types), ../auth/auth.guard (Public), ../max-bot/max-bot.client (header name), ./bot.service
// LINKS: M-SVC-BACKEND, https://dev.max.ru/docs-api/methods/POST/subscriptions
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - secretsEqual - length-normalized timingSafeEqual, so a mismatched length cannot throw
// - webhookSecretOk - fail-closed delivery authentication against BOT_WEBHOOK_SECRET / NODE_ENV
// - parseWebhookBody - utf8 rawBody -> unknown, null when absent or not JSON
// - BotController - POST /bot/webhook
// END_MODULE_MAP

import { createHash, timingSafeEqual } from "node:crypto";
import { setImmediate } from "node:timers";
import { Body, Controller, Headers, HttpCode, Inject, Logger, NotFoundException, Post } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Public } from "../auth/auth.guard";
import { MAX_WEBHOOK_SECRET_HEADER } from "../max-bot/max-bot.client";
import { BotService } from "./bot.service";

/** Hashing both sides normalizes length so timingSafeEqual never throws and leaks nothing about it. */
export function secretsEqual(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

/**
 * Fail-closed: with a secret configured, only a matching header is MAX. Without one the endpoint
 * exists only on development and test stacks — on a production host an unauthenticated public
 * message-injection point is not an option, so it pretends not to exist (the caller answers 404).
 */
export function webhookSecretOk(header: string | undefined, configured: string | undefined, nodeEnv: string | undefined): boolean {
  if (configured) return typeof header === "string" && secretsEqual(header, configured);
  return nodeEnv === "development" || nodeEnv === "test";
}

/** main.ts attaches rawBody via the json() verify hook; read it back so a non-JSON body is just null. */
export function parseWebhookBody(req: { rawBody?: Buffer }): unknown {
  if (!req.rawBody || req.rawBody.length === 0) return null;
  try {
    return JSON.parse(req.rawBody.toString("utf8"));
  } catch {
    return null;
  }
}

@Public()
@Controller("bot")
export class BotController {
  private readonly logger = new Logger(BotController.name);

  constructor(
    @Inject(BotService) private readonly botService: BotService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  @Post("webhook")
  @HttpCode(200)
  webhook(@Headers(MAX_WEBHOOK_SECRET_HEADER) secret: string | undefined, @Body() body: unknown): { ok: boolean } {
    if (!webhookSecretOk(secret, this.config.get<string>("BOT_WEBHOOK_SECRET"), this.config.get<string>("NODE_ENV"))) {
      throw new NotFoundException();
    }
    // The body reaches here already JSON-parsed by the express json() middleware (main.ts sets a 12mb
    // limit and attaches rawBody). Answering first keeps MAX's 30s delivery window safe even when an
    // NL query spends seconds in the model API; MAX retries a non-200 for up to 8 hours.
    setImmediate(() => {
      void (async () => {
        try {
          for (const inbound of this.botService.parse(body)) {
            await this.botService.handleInbound(inbound);
          }
        } catch (error: unknown) {
          this.logger.warn(`Webhook processing failed: ${error instanceof Error ? error.message : "unknown"}`);
        }
      })();
    });
    return { ok: true };
  }
}
