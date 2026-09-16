// START_MODULE_CONTRACT
// PURPOSE: In-process 60s interval that reminds unanswered gathering invitees.
// SCOPE: Starts on module init, clears on destroy; tests call remindUnanswered directly.
// DEPENDS: @nestjs/common, ./gatherings.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - GatheringsScheduler - 60s setInterval around remindUnanswered()
// END_MODULE_MAP

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { GatheringsService } from "./gatherings.service";

export const GATHERING_REMINDER_INTERVAL_MS = 60_000;

@Injectable()
export class GatheringsScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GatheringsScheduler.name);
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly gatherings: GatheringsService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.gatherings.remindUnanswered().catch((error: unknown) => {
        this.logger.warn(`Gathering reminder tick failed: ${error instanceof Error ? error.message : "unknown"}`);
      });
    }, GATHERING_REMINDER_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
