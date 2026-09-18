// START_MODULE_CONTRACT
// PURPOSE: Domain facade for payments — only talks to PaymentProvider, never to an SDK.
// SCOPE: create / getStatus / refund delegated to the injected provider.
// DEPENDS: @nestjs/common, ./payment-provider
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PaymentsService - domain entry for charges and refunds
// END_MODULE_MAP

import { Inject, Injectable } from "@nestjs/common";
import { PAYMENT_PROVIDER, type CreatePaymentInput, type PaymentCharge, type PaymentProvider, type PaymentRefund } from "./payment-provider";

@Injectable()
export class PaymentsService {
  constructor(@Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider) {}

  create(input: CreatePaymentInput): Promise<PaymentCharge> {
    return this.provider.create(input);
  }

  getStatus(paymentId: string): Promise<PaymentCharge> {
    return this.provider.getStatus(paymentId);
  }

  refund(paymentId: string, amountRub?: number): Promise<PaymentRefund> {
    return this.provider.refund(paymentId, amountRub);
  }
}
