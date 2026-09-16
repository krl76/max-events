// START_MODULE_CONTRACT
// PURPOSE: In-process 60s interval that reminds plan hosts and invitees about the meeting time.
// SCOPE: Starts on module init, clears on destroy; tests call remindMeeting directly.
// DEPENDS: @nestjs/common, ./plans.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PlansScheduler - 60s setInterval around remindMeeting()
// END_MODULE_MAP

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PlansService } from "./plans.service";

export const PLAN_REMINDER_INTERVAL_MS = 60_000;

@Injectable()
export class PlansScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlansScheduler.name);
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly plans: PlansService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.plans.remindMeeting().catch((error: unknown) => {
        this.logger.warn(`Plan reminder tick failed: ${error instanceof Error ? error.message : "unknown"}`);
      });
    }, PLAN_REMINDER_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
