// START_MODULE_CONTRACT
// PURPOSE: Payment webhook intake — HMAC verify, journal dedup, safe payment status transitions.
// SCOPE: handleWebhook; duplicate providerEventId is a no-op; illegal transitions are journaled but not applied; an unknown providerPaymentId is acked; a refund frees the booking seat.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, ../bookings/booking.entity, ../events/event.entity, ../promo/promo.service, ./payment.entity, ./payment-webhook-event.entity, ./webhook-signature
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PaymentWebhookResult - applied / duplicate flags
// - canTransitionPaymentStatus - allowed status graph
// - PaymentsWebhookService - signed webhook handler
// END_MODULE_MAP

import { BadRequestException, Inject, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, EntityManager, QueryFailedError } from "typeorm";
import { PaymentWebhookWriteSchema, type PaymentStatus } from "@max-events/api-contracts";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import { PromoService } from "../promo/promo.service";
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
  private readonly logger = new Logger(PaymentsWebhookService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PromoService) private readonly promo: PromoService,
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
      if (!payment) {
        // A re-armed charge replaces providerPaymentId on the same row, so a late webhook for the
        // retired id has nothing to apply. Ack it: a 5xx here only buys empty provider retries.
        this.logger.warn(`Payment webhook ${parsed.data.eventId} references an unknown provider payment; acknowledged without applying`);
        return { duplicate: false, applied: false };
      }
      if (!canTransitionPaymentStatus(payment.status, parsed.data.status)) {
        return { duplicate: false, applied: false };
      }
      const statusChanged = payment.status !== parsed.data.status;
      const wasFrozen = Boolean(payment.commissionFixedAt);
      payment.status = parsed.data.status;
      freezeCommission(payment, this.config.get<number>("PAYMENT_COMMISSION_BPS") ?? DEFAULT_COMMISSION_BPS);
      const healed = Boolean(payment.commissionFixedAt) && !wasFrozen;
      if (!statusChanged && !healed) return { duplicate: false, applied: false };
      await manager.save(PaymentEntity, payment);
      if (statusChanged && payment.status === "refunded") await this.releaseBooking(manager, payment.bookingId);
      return { duplicate: false, applied: true };
    });
  }

  /**
   * A refund that originates at the provider has to reach the booking too, or the seat stays sold
   * while the money is back with the user. The freed seat is handed to the waitlist by the next
   * WaitlistScheduler tick (expireOffers -> fillVacancies), which keeps this module free of a
   * cycle back into WaitlistModule.
   */
  private async releaseBooking(manager: EntityManager, bookingId: string): Promise<void> {
    const peek = await manager.findOne(BookingEntity, { where: { id: bookingId } });
    if (!peek) return;
    // Same lock order as BookingsService.cancel — event first, then booking — so the two paths
    // cannot deadlock against each other.
    const event = await manager.findOne(EventEntity, { where: { id: peek.eventId }, lock: { mode: "pessimistic_write" } });
    if (!event) return;
    const booking = await manager.findOne(BookingEntity, { where: { id: bookingId }, lock: { mode: "pessimistic_write" } });
    if (!booking || booking.status !== "active") return;
    booking.status = "cancelled";
    event.bookedCount = Math.max(0, event.bookedCount - 1);
    await this.promo.releaseInTransaction(manager, event, booking.promoCode);
    await this.promo.releaseFulfillmentInTransaction(manager, booking.id);
    await manager.save(BookingEntity, booking);
    await manager.save(EventEntity, event);
  }
}
