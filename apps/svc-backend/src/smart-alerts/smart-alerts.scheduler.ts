// START_MODULE_CONTRACT
// PURPOSE: 60s interval that runs weather and friend-left smart alerts while Nest is up.
// SCOPE: Starts on module init; unit tests that skip AppModule do not run this.
// DEPENDS: @nestjs/common, ./smart-alerts.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SMART_ALERT_TICK_INTERVAL_MS - scheduler tick interval
// - SmartAlertsScheduler - 60s setInterval around tick()
// END_MODULE_MAP

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { SmartAlertsService } from "./smart-alerts.service";

export const SMART_ALERT_TICK_INTERVAL_MS = 60_000;

@Injectable()
export class SmartAlertsScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SmartAlertsScheduler.name);
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly alerts: SmartAlertsService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.alerts.tick().catch((error: unknown) => {
        this.logger.warn(`Smart-alert tick failed: ${error instanceof Error ? error.message : "unknown"}`);
      });
    }, SMART_ALERT_TICK_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
