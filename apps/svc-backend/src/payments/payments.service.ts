// START_MODULE_CONTRACT
// PURPOSE: Domain facade for payments — only talks to PaymentProvider, never to an SDK.
// SCOPE: create / getStatus / refund; ensureForBooking (null when payments_disabled, failed and cancelled re-armed as a new charge); refundForBooking claims the row before calling the provider so concurrent cancels refund once; freeze commission; organizer sales report.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, ./payment-provider, ./payment.entity, ./commission
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PaymentMismatch - internal vs provider status
// - PaymentsService - domain entry for charges, refunds, booking payment rows, sales report, reconcile
// - toPaymentDto - PaymentEntity to Payment
// END_MODULE_MAP

import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { In, QueryFailedError, Repository } from "typeorm";
import type { EventSalesReport, Payment, PaymentStatus } from "@max-events/api-contracts";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import { DEFAULT_COMMISSION_BPS, freezeCommission } from "./commission";
import { PaymentEntity } from "./payment.entity";
import { PAYMENT_PROVIDER, PaymentProviderError, type CreatePaymentInput, type PaymentCharge, type PaymentProvider, type PaymentRefund } from "./payment-provider";

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @InjectRepository(PaymentEntity) private readonly rows: Repository<PaymentEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(BookingEntity) private readonly bookings: Repository<BookingEntity>,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  create(input: CreatePaymentInput): Promise<PaymentCharge> {
    return this.provider.create(input);
  }

  getStatus(paymentId: string): Promise<PaymentCharge> {
    return this.provider.getStatus(paymentId);
  }

  refund(paymentId: string, amountRub?: number, idempotencyKey?: string): Promise<PaymentRefund> {
    return this.provider.refund(paymentId, amountRub, idempotencyKey);
  }

  async ensureForBooking(bookingId: string, amountRub: number, description: string): Promise<Payment | null> {
    const existing = await this.rows.findOneBy({ bookingId });
    if (existing && !RE_ARMABLE.includes(existing.status)) return toPaymentDto(await this.healCommission(existing));
    const idempotencyKey = existing ? `booking:${bookingId}:retry:${existing.providerPaymentId}` : `booking:${bookingId}`;
    let charge: PaymentCharge;
    try {
      charge = await this.provider.create({ amountRub, currency: "RUB", description, idempotencyKey });
    } catch (error) {
      if (error instanceof PaymentProviderError && error.code === "payments_disabled") return null;
      throw error;
    }
    if (existing) {
      existing.providerPaymentId = charge.id;
      existing.status = charge.status;
      existing.amountRub = charge.amountRub;
      existing.description = charge.description;
      existing.commissionRub = null;
      existing.netRub = null;
      existing.commissionBps = null;
      existing.commissionFixedAt = null;
      freezeCommission(existing, this.commissionBps());
      return toPaymentDto(await this.rows.save(existing));
    }
    const draft = this.rows.create({
      bookingId,
      providerPaymentId: charge.id,
      status: charge.status,
      amountRub: charge.amountRub,
      currency: "RUB",
      description: charge.description,
      commissionRub: null,
      netRub: null,
      commissionBps: null,
      commissionFixedAt: null,
    });
    freezeCommission(draft, this.commissionBps());
    try {
      const saved = await this.rows.save(draft);
      return toPaymentDto(saved);
    } catch (error) {
      if (!(error instanceof QueryFailedError && error.driverError?.code === "23505")) throw error;
      const row = await this.rows.findOneBy({ bookingId });
      if (!row) throw error;
      return toPaymentDto(await this.healCommission(row));
    }
  }

  async refundForBooking(bookingId: string): Promise<Payment | null> {
    const row = await this.rows.findOneBy({ bookingId });
    if (!row) return null;
    if (row.status !== "succeeded") return toPaymentDto(row);
    // Claim the row with a conditional update before touching the provider: concurrent cancels of the
    // same booking race here, and only the writer that flips succeeded -> refunded may move money.
    const claim = await this.rows.update({ id: row.id, status: "succeeded" }, { status: "refunded" });
    if (!claim.affected) {
      const current = await this.rows.findOneBy({ bookingId });
      return current ? toPaymentDto(current) : null;
    }
    try {
      const refund = await this.provider.refund(row.providerPaymentId, undefined, `booking:${bookingId}:refund`);
      if (refund.status !== "succeeded") throw new ConflictException("Refund failed");
    } catch (error) {
      // Release the claim so a retried cancel can refund again; the idempotency key keeps a
      // provider-side success that failed on our side from paying out twice.
      await this.rows.update({ id: row.id, status: "refunded" }, { status: "succeeded" });
      throw error;
    }
    const refunded = await this.rows.findOneBy({ bookingId });
    return toPaymentDto(refunded ?? Object.assign(row, { status: "refunded" as const }));
  }

  async salesReport(organizerId: string, eventId: string): Promise<EventSalesReport> {
    const event = await this.events.findOneBy({ id: eventId, organizerUserId: organizerId });
    if (!event) throw new NotFoundException("Event not found");
    const bookings = await this.bookings.find({ where: { eventId } });
    const ids = bookings.map((row) => row.id);
    const payments = ids.length === 0 ? [] : await this.rows.find({ where: { bookingId: In(ids) } });
    const frozen = payments.filter((row) => row.status === "succeeded" && row.commissionFixedAt && row.commissionRub != null && row.netRub != null && row.commissionBps != null).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
    return {
      eventId,
      rows: frozen.map((row) => ({
        paymentId: row.id,
        bookingId: row.bookingId,
        status: row.status,
        grossRub: row.amountRub,
        commissionRub: row.commissionRub!,
        netRub: row.netRub!,
        commissionBps: row.commissionBps!,
        commissionFixedAt: row.commissionFixedAt!.toISOString(),
      })),
      grossRub: frozen.reduce((sum, row) => sum + row.amountRub, 0),
      commissionRub: frozen.reduce((sum, row) => sum + (row.commissionRub ?? 0), 0),
      netRub: frozen.reduce((sum, row) => sum + (row.netRub ?? 0), 0),
    };
  }

  async reconcile(): Promise<PaymentMismatch[]> {
    const rows = await this.rows.find({ where: { status: In(["pending", "succeeded"]) } });
    const mismatches: PaymentMismatch[] = [];
    for (const row of rows) {
      try {
        const charge = await this.provider.getStatus(row.providerPaymentId);
        if (charge.status !== row.status) {
          mismatches.push({ paymentId: row.id, bookingId: row.bookingId, internal: row.status, provider: charge.status });
        }
      } catch (error) {
        if (error instanceof PaymentProviderError && error.code === "payment_not_found") {
          mismatches.push({ paymentId: row.id, bookingId: row.bookingId, internal: row.status, provider: "missing" });
          continue;
        }
        throw error;
      }
    }
    return mismatches;
  }

  private commissionBps(): number {
    return this.config.get<number>("PAYMENT_COMMISSION_BPS") ?? DEFAULT_COMMISSION_BPS;
  }

  private async healCommission(row: PaymentEntity): Promise<PaymentEntity> {
    if (row.commissionFixedAt || row.status !== "succeeded") return row;
    freezeCommission(row, this.commissionBps());
    if (!row.commissionFixedAt) return row;
    return this.rows.save(row);
  }
}

// A charge in one of these states never took the user's money, so a new charge may replace it.
const RE_ARMABLE: PaymentStatus[] = ["failed", "cancelled"];

export type PaymentMismatch = {
  paymentId: string;
  bookingId: string;
  internal: PaymentStatus;
  provider: PaymentStatus | "missing";
};

export function toPaymentDto(row: PaymentEntity): Payment {
  return {
    id: row.id,
    bookingId: row.bookingId,
    providerPaymentId: row.providerPaymentId,
    status: row.status,
    amountRub: row.amountRub,
    currency: row.currency,
    description: row.description,
    commissionRub: row.commissionRub,
    netRub: row.netRub,
    commissionBps: row.commissionBps,
    commissionFixedAt: row.commissionFixedAt ? row.commissionFixedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
