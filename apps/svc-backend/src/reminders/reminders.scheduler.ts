// START_MODULE_CONTRACT
// PURPOSE: In-process 60s interval that runs RemindersService.tick while the Nest app is up.
// SCOPE: Starts on module init, clears on destroy; does not run inside unit tests that skip AppModule bootstrap.
// DEPENDS: @nestjs/common, ./reminders.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - REMINDER_TICK_INTERVAL_MS - scheduler tick interval
// - RemindersScheduler - 60s setInterval around tick()
// END_MODULE_MAP

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { RemindersService } from "./reminders.service";

export const REMINDER_TICK_INTERVAL_MS = 60_000;

@Injectable()
export class RemindersScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RemindersScheduler.name);
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly reminders: RemindersService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.reminders.tick().catch((error: unknown) => {
        this.logger.warn(`Reminder tick failed: ${error instanceof Error ? error.message : "unknown"}`);
      });
    }, REMINDER_TICK_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
