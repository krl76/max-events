// START_MODULE_CONTRACT
// PURPOSE: Periodic payment reconciliation against the provider.
// SCOPE: 60s interval; logs mismatch count; tests call PaymentsService.reconcile directly.
// DEPENDS: @nestjs/common, ./payments.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PAYMENT_RECONCILE_INTERVAL_MS - tick interval
// - PaymentsScheduler - single-flight reconcile
// END_MODULE_MAP

import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PaymentsService } from "./payments.service";

export const PAYMENT_RECONCILE_INTERVAL_MS = 60_000;

@Injectable()
export class PaymentsScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentsScheduler.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private ticking = false;

  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.tick();
    }, PAYMENT_RECONCILE_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const mismatches = await this.payments.reconcile();
      if (mismatches.length > 0) {
        const sample = mismatches
          .slice(0, 5)
          .map((row) => `${row.paymentId}:${row.internal}/${row.provider}`)
          .join(",");
        this.logger.warn(`Payment reconciliation found ${mismatches.length} mismatch(es): ${sample}`);
      }
    } catch (error: unknown) {
      this.logger.error("Payment reconciliation failed", error instanceof Error ? error.stack : String(error));
    } finally {
      this.ticking = false;
    }
  }
}
