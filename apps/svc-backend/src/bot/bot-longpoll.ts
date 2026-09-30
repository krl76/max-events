// START_MODULE_CONTRACT
// PURPOSE: Development contour for bot updates — long-poll GET /updates when the stack has no public HTTPS webhook.
// SCOPE: Starts on module init only when BOT_LONGPOLL=true, otherwise inert (production is webhook-only and the two contours cannot be combined: while a webhook subscription is active MAX does not answer /updates). One poll at a time: the next request goes out only after the previous page is processed, so a slow NL reply never overlaps itself; the marker advances per page and a failed page is retried from the same marker. Stops on module destroy. Never throws out of the loop.
// DEPENDS: @nestjs/common, @nestjs/config, ../max-bot/max-bot.client, ./bot.service
// LINKS: M-SVC-BACKEND, https://dev.max.ru/docs-api/methods/GET/updates
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - LONGPOLL_BACKOFF_MS - pause after an empty or failed page
// - pollPage - fetch one page, feed it to the bot service, return the next marker and whether anything ran
// - BotLongPoll - the loop around pollPage with the BOT_LONGPOLL switch and the stop flag
// END_MODULE_MAP

import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MaxBotClient, type MaxBotUpdatesResult } from "../max-bot/max-bot.client";
import { BotService } from "./bot.service";
import { flagOn } from "./bot-stack";

/** A failed GET /updates or an idle answer pauses this long before the next poll. */
export const LONGPOLL_BACKOFF_MS = 2_000;

/**
 * Process one long-poll page: advance the marker even when the page is empty (MAX moves it), then
 * hand every parsed update to the bot service. `ran` is false when nothing was processed, which the
 * loop reads as "idle, back off a moment". A throw leaves the marker untouched so the page is retried.
 */
export async function pollPage(fetcher: Pick<MaxBotClient, "getUpdates">, service: Pick<BotService, "parse" | "handleInbound">, marker: number | null): Promise<{ marker: number | null; ran: boolean }> {
  const page: MaxBotUpdatesResult = await fetcher.getUpdates(marker);
  const next = page.marker ?? marker;
  if (page.updates.length === 0) return { marker: next, ran: false };
  let ran = false;
  for (const inbound of service.parse(page.updates)) {
    await service.handleInbound(inbound);
    ran = true;
  }
  return { marker: next, ran };
}

@Injectable()
export class BotLongPoll implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotLongPoll.name);
  private stopped = true;
  private marker: number | null = null;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(MaxBotClient) private readonly bot: MaxBotClient,
    @Inject(BotService) private readonly service: BotService,
  ) {}

  onModuleInit(): void {
    if (!flagOn(this.config.get("BOT_LONGPOLL"))) return;
    this.stopped = false;
    this.logger.log("BOT_LONGPOLL is on: polling GET /updates (dev contour; production uses the webhook)");
    void this.loop();
  }

  onModuleDestroy(): void {
    this.stopped = true;
  }

  private async loop(): Promise<void> {
    while (!this.stopped) {
      let ran = false;
      try {
        const page = await pollPage(this.bot, this.service, this.marker);
        this.marker = page.marker;
        ran = page.ran;
      } catch (error: unknown) {
        this.logger.warn(`Long poll failed: ${error instanceof Error ? error.message : "unknown"}`);
      }
      if (!ran && !this.stopped) await this.pause();
    }
  }

  private async pause(): Promise<void> {
    const until = Date.now() + LONGPOLL_BACKOFF_MS;
    while (!this.stopped && Date.now() < until) {
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }
  }
}
