// START_MODULE_CONTRACT
// PURPOSE: 60s interval that runs the leave-now engine while Nest is up.
// SCOPE: Starts on module init; unit tests that skip AppModule do not run this.
// DEPENDS: @nestjs/common, ./leave-now.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - LEAVE_NOW_TICK_INTERVAL_MS - scheduler tick interval
// - LeaveNowScheduler - 60s setInterval around tick()
// END_MODULE_MAP

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { LeaveNowService } from "./leave-now.service";

export const LEAVE_NOW_TICK_INTERVAL_MS = 60_000;

@Injectable()
export class LeaveNowScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LeaveNowScheduler.name);
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly leaveNow: LeaveNowService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.leaveNow.tick().catch((error: unknown) => {
        this.logger.warn(`Leave-now tick failed: ${error instanceof Error ? error.message : "unknown"}`);
      });
    }, LEAVE_NOW_TICK_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
