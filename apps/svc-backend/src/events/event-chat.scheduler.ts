// START_MODULE_CONTRACT
// PURPOSE: 60s interval that retries the MAX auto-chat for events left with chatSyncPending.
// SCOPE: Starts on module init; single-flight tick; unit tests that skip AppModule do not run this.
// DEPENDS: @nestjs/common, ./events.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - EVENT_CHAT_SYNC_INTERVAL_MS - scheduler tick interval
// - EventChatScheduler - 60s setInterval around EventsService.syncPendingChats()
// END_MODULE_MAP

import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { EventsService } from "./events.service";

export const EVENT_CHAT_SYNC_INTERVAL_MS = 60_000;

@Injectable()
export class EventChatScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventChatScheduler.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private ticking = false;

  constructor(@Inject(EventsService) private readonly events: EventsService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.tick();
    }, EVENT_CHAT_SYNC_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const linked = await this.events.syncPendingChats();
      if (linked > 0) this.logger.log(`Attached a MAX chat to ${linked} pending event(s)`);
    } catch (error: unknown) {
      this.logger.warn(`Event chat sync tick failed: ${error instanceof Error ? error.message : "unknown"}`);
    } finally {
      this.ticking = false;
    }
  }
}
