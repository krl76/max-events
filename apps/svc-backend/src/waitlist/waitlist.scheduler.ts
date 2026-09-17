// START_MODULE_CONTRACT
// PURPOSE: 60s interval that expires waitlist offers and passes the seat down the queue.
// SCOPE: Starts on module init; unit tests that skip AppModule do not run this.
// DEPENDS: @nestjs/common, ./waitlist.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - WaitlistScheduler - 60s setInterval around expireOffers()
// END_MODULE_MAP

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { WaitlistService } from "./waitlist.service";

export const WAITLIST_TICK_INTERVAL_MS = 60_000;

@Injectable()
export class WaitlistScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WaitlistScheduler.name);
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly waitlist: WaitlistService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.waitlist.expireOffers().catch((error: unknown) => {
        this.logger.warn(`Waitlist tick failed: ${error instanceof Error ? error.message : "unknown"}`);
      });
    }, WAITLIST_TICK_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
