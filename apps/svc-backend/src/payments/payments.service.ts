// START_MODULE_CONTRACT
// PURPOSE: Domain facade for payments — only talks to PaymentProvider, never to an SDK.
// SCOPE: create / getStatus / refund; ensureForBooking; freeze commission; organizer sales report.
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

  refund(paymentId: string, amountRub?: number): Promise<PaymentRefund> {
    return this.provider.refund(paymentId, amountRub);
  }

  async ensureForBooking(bookingId: string, amountRub: number, description: string): Promise<Payment> {
    const existing = await this.rows.findOneBy({ bookingId });
    if (existing) return toPaymentDto(await this.healCommission(existing));
    const charge = await this.provider.create({
      amountRub,
      currency: "RUB",
      description,
      idempotencyKey: `booking:${bookingId}`,
    });
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
    if (row.status === "refunded") return toPaymentDto(row);
    if (row.status !== "succeeded") return toPaymentDto(row);
    const refund = await this.provider.refund(row.providerPaymentId);
    if (refund.status !== "succeeded") throw new ConflictException("Refund failed");
    row.status = "refunded";
    await this.rows.save(row);
    return toPaymentDto(row);
  }

  async salesReport(organizerId: string, eventId: string): Promise<EventSalesReport> {
    const event = await this.events.findOneBy({ id: eventId, organizerUserId: organizerId });
    if (!event) throw new NotFoundException("Event not found");
    const bookings = await this.bookings.find({ where: { eventId } });
    const ids = bookings.map((row) => row.id);
    const payments = ids.length === 0 ? [] : await this.rows.find({ where: { bookingId: In(ids) } });
    const frozen = payments
      .filter((row) => row.status === "succeeded" && row.commissionFixedAt && row.commissionRub != null && row.netRub != null && row.commissionBps != null)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
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
