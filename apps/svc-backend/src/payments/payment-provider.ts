// START_MODULE_CONTRACT
// PURPOSE: Payment provider port — create, status, refund. Domain talks only to this interface.
// SCOPE: PaymentCharge/Refund types, PaymentProvider, PaymentProviderError. No SDK imports.
// DEPENDS: none
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PAYMENT_PROVIDER - Nest injection token
// - PaymentStatus - charge lifecycle
// - CreatePaymentInput - create payload
// - PaymentCharge - provider charge
// - PaymentRefund - provider refund
// - PaymentProvider - create / getStatus / refund
// - PaymentProviderError - typed provider failure
// END_MODULE_MAP

export const PAYMENT_PROVIDER = "PAYMENT_PROVIDER";

export type PaymentStatus = "pending" | "succeeded" | "failed" | "cancelled" | "refunded";

export type CreatePaymentInput = {
  amountRub: number;
  currency: "RUB";
  description: string;
  idempotencyKey: string;
};

export type PaymentCharge = {
  id: string;
  status: PaymentStatus;
  amountRub: number;
  currency: "RUB";
  description: string;
};

export type PaymentRefund = {
  id: string;
  paymentId: string;
  status: "succeeded" | "failed";
  amountRub: number;
};

export interface PaymentProvider {
  create(input: CreatePaymentInput): Promise<PaymentCharge>;
  getStatus(paymentId: string): Promise<PaymentCharge>;
  refund(paymentId: string, amountRub?: number): Promise<PaymentRefund>;
}

export class PaymentProviderError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PaymentProviderError";
  }
}
