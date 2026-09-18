// START_MODULE_CONTRACT
// PURPOSE: Domain facade for payments — only talks to PaymentProvider, never to an SDK.
// SCOPE: create / getStatus / refund; ensureForBooking persists 1:1 booking payment.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, ./payment-provider, ./payment.entity
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PaymentsService - domain entry for charges, refunds, booking payment rows
// - toPaymentDto - PaymentEntity to Payment
// END_MODULE_MAP

import { Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository } from "typeorm";
import type { Payment } from "@max-events/api-contracts";
import { PaymentEntity } from "./payment.entity";
import { PAYMENT_PROVIDER, type CreatePaymentInput, type PaymentCharge, type PaymentProvider, type PaymentRefund } from "./payment-provider";

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @InjectRepository(PaymentEntity) private readonly rows: Repository<PaymentEntity>,
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
    if (existing) return toPaymentDto(existing);
    const charge = await this.provider.create({
      amountRub,
      currency: "RUB",
      description,
      idempotencyKey: `booking:${bookingId}`,
    });
    try {
      const saved = await this.rows.save(
        this.rows.create({
          bookingId,
          providerPaymentId: charge.id,
          status: charge.status,
          amountRub: charge.amountRub,
          currency: "RUB",
          description: charge.description,
        }),
      );
      return toPaymentDto(saved);
    } catch (error) {
      if (!(error instanceof QueryFailedError && error.driverError?.code === "23505")) throw error;
      const row = await this.rows.findOneBy({ bookingId });
      if (!row) throw error;
      return toPaymentDto(row);
    }
  }
}

export function toPaymentDto(row: PaymentEntity): Payment {
  return {
    id: row.id,
    bookingId: row.bookingId,
    providerPaymentId: row.providerPaymentId,
    status: row.status,
    amountRub: row.amountRub,
    currency: row.currency,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
