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

import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository } from "typeorm";
import { PaymentWebhookWriteSchema, type PaymentStatus } from "@max-events/api-contracts";
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
    @InjectRepository(PaymentEntity) private readonly payments: Repository<PaymentEntity>,
    @InjectRepository(PaymentWebhookEventEntity) private readonly events: Repository<PaymentWebhookEventEntity>,
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
    const existing = await this.events.findOneBy({ providerEventId: parsed.data.eventId });
    if (existing) return { duplicate: true, applied: false };
    try {
      await this.events.save(
        this.events.create({
          providerEventId: parsed.data.eventId,
          providerPaymentId: parsed.data.paymentId,
          status: parsed.data.status,
        }),
      );
    } catch (error) {
      if (error instanceof QueryFailedError && error.driverError?.code === "23505") return { duplicate: true, applied: false };
      throw error;
    }
    const payment = await this.payments.findOneBy({ providerPaymentId: parsed.data.paymentId });
    if (!payment) return { duplicate: false, applied: false };
    if (!canTransitionPaymentStatus(payment.status, parsed.data.status)) return { duplicate: false, applied: false };
    if (payment.status === parsed.data.status) return { duplicate: false, applied: false };
    payment.status = parsed.data.status;
    await this.payments.save(payment);
    return { duplicate: false, applied: true };
  }
}
