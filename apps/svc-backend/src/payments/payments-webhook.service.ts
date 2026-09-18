// START_MODULE_CONTRACT
// PURPOSE: Payment webhook intake — HMAC verify, journal dedup, safe payment status transitions.
// SCOPE: handleWebhook; duplicate providerEventId is a no-op; illegal transitions are journaled but not applied.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, ./payment.entity, ./payment-webhook-event.entity, ./webhook-signature
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PaymentWebhookResult - applied / duplicate flags
// - canTransitionPaymentStatus - allowed status graph
// - PaymentsWebhookService - signed webhook handler
// END_MODULE_MAP

import { BadRequestException, Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, QueryFailedError } from "typeorm";
import { PaymentWebhookWriteSchema, type PaymentStatus } from "@max-events/api-contracts";
import { DEFAULT_COMMISSION_BPS, freezeCommission } from "./commission";
import { PaymentWebhookEventEntity } from "./payment-webhook-event.entity";
import { PaymentEntity } from "./payment.entity";
import { verifyPaymentWebhook } from "./webhook-signature";

export type PaymentWebhookResult = { duplicate: boolean; applied: boolean };

const ALLOWED: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ["pending", "succeeded", "failed", "cancelled"],
  failed: ["failed", "succeeded", "cancelled"],
  succeeded: ["succeeded", "refunded"],
  cancelled: ["cancelled"],
  refunded: ["refunded"],
};

export function canTransitionPaymentStatus(from: PaymentStatus, to: PaymentStatus): boolean {
  return ALLOWED[from]?.includes(to) === true;
}

@Injectable()
export class PaymentsWebhookService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async handleWebhook(rawBody: string, signature: string | undefined, secret: string | undefined): Promise<PaymentWebhookResult> {
    if (!secret) throw new UnauthorizedException("Payment webhook is not configured");
    if (!verifyPaymentWebhook(secret, rawBody, signature)) throw new UnauthorizedException("Invalid payment webhook signature");
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody) as unknown;
    } catch {
      throw new BadRequestException("Invalid payment webhook payload");
    }
    const parsed = PaymentWebhookWriteSchema.safeParse(parsedJson);
    if (!parsed.success) throw new BadRequestException("Invalid payment webhook payload");
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(PaymentWebhookEventEntity, { where: { providerEventId: parsed.data.eventId } });
      if (existing) return { duplicate: true, applied: false };
      try {
        await manager.save(
          PaymentWebhookEventEntity,
          manager.create(PaymentWebhookEventEntity, {
            providerEventId: parsed.data.eventId,
            providerPaymentId: parsed.data.paymentId,
            status: parsed.data.status,
          }),
        );
      } catch (error) {
        if (error instanceof QueryFailedError && error.driverError?.code === "23505") return { duplicate: true, applied: false };
        throw error;
      }
      const payment = await manager.findOne(PaymentEntity, { where: { providerPaymentId: parsed.data.paymentId }, lock: { mode: "pessimistic_write" } });
      if (!payment) throw new ServiceUnavailableException("Payment not found");
      if (!canTransitionPaymentStatus(payment.status, parsed.data.status) || payment.status === parsed.data.status) {
        return { duplicate: false, applied: false };
      }
      payment.status = parsed.data.status;
      freezeCommission(payment, this.config.get<number>("PAYMENT_COMMISSION_BPS") ?? DEFAULT_COMMISSION_BPS);
      await manager.save(PaymentEntity, payment);
      return { duplicate: false, applied: true };
    });
  }
}
