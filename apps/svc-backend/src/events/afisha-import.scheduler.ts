// START_MODULE_CONTRACT
// PURPOSE: Pull the public afisha into the catalog on boot and every six hours.
// SCOPE: Skips unit tests and AFISHA_IMPORT=0. A failed pull is logged and retried on the next tick.
// DEPENDS: @nestjs/common, ./afisha-import.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AFISHA_IMPORT_INTERVAL_MS - six hours between catalog pulls
// - AfishaImportScheduler - boot pull plus the interval
// END_MODULE_MAP

import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { afishaImportEnabled, AfishaImportService } from "./afisha-import.service";

export const AFISHA_IMPORT_INTERVAL_MS = 6 * 60 * 60 * 1000;
const BOOT_DELAY_MS = 15_000;

@Injectable()
export class AfishaImportScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AfishaImportScheduler.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private boot: ReturnType<typeof setTimeout> | undefined;
  private running = false;

  constructor(@Inject(AfishaImportService) private readonly afisha: AfishaImportService) {}

  onModuleInit() {
    if (!afishaImportEnabled()) return;
    this.boot = setTimeout(() => void this.run(), BOOT_DELAY_MS);
    this.timer = setInterval(() => void this.run(), AFISHA_IMPORT_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.boot) clearTimeout(this.boot);
    if (this.timer) clearInterval(this.timer);
  }

  private async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.afisha.sync();
    } catch (error: unknown) {
      this.logger.warn(`Afisha import failed: ${error instanceof Error ? error.message : "unknown"}`);
    } finally {
      this.running = false;
    }
  }
}
