// START_MODULE_CONTRACT
// PURPOSE: In-process sandbox payment provider for success/fail/refund without a live SDK.
// SCOPE: Idempotent create; failAmount or "[fail]" description → failed; refund only succeeded charges.
// DEPENDS: ./payment-provider
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SANDBOX_FAIL_AMOUNT - default amount that the sandbox declines
// - SandboxPaymentProvider - in-memory PaymentProvider
// END_MODULE_MAP

import { PaymentProviderError, type CreatePaymentInput, type PaymentCharge, type PaymentProvider, type PaymentRefund } from "./payment-provider";

export const SANDBOX_FAIL_AMOUNT = 13;

export class SandboxPaymentProvider implements PaymentProvider {
  private readonly charges = new Map<string, PaymentCharge>();
  private readonly byIdempotency = new Map<string, string>();
  private readonly refunds = new Map<string, PaymentRefund>();
  private seq = 0;

  constructor(private readonly failAmount = SANDBOX_FAIL_AMOUNT) {}

  async create(input: CreatePaymentInput): Promise<PaymentCharge> {
    const existingId = this.byIdempotency.get(input.idempotencyKey);
    if (existingId) {
      const existing = this.charges.get(existingId);
      if (existing) return existing;
    }
    if (!Number.isInteger(input.amountRub) || input.amountRub <= 0) {
      throw new PaymentProviderError("invalid_amount", "Payment amount must be a positive integer");
    }
    const failed = input.amountRub === this.failAmount || input.description.includes("[fail]");
    const id = `pay_sandbox_${++this.seq}`;
    const charge: PaymentCharge = {
      id,
      status: failed ? "failed" : "succeeded",
      amountRub: input.amountRub,
      currency: input.currency,
      description: input.description,
    };
    this.charges.set(id, charge);
    this.byIdempotency.set(input.idempotencyKey, id);
    return charge;
  }

  async getStatus(paymentId: string): Promise<PaymentCharge> {
    const charge = this.charges.get(paymentId);
    if (!charge) throw new PaymentProviderError("payment_not_found", "Payment not found");
    return charge;
  }

  async refund(paymentId: string, amountRub?: number): Promise<PaymentRefund> {
    const existing = this.refunds.get(paymentId);
    if (existing) return existing;
    const charge = await this.getStatus(paymentId);
    if (charge.status !== "succeeded") {
      return { id: `ref_sandbox_${paymentId}`, paymentId, status: "failed", amountRub: amountRub ?? charge.amountRub };
    }
    const refundAmount = amountRub ?? charge.amountRub;
    if (!Number.isInteger(refundAmount) || refundAmount <= 0 || refundAmount > charge.amountRub) {
      return { id: `ref_sandbox_${paymentId}`, paymentId, status: "failed", amountRub: refundAmount };
    }
    charge.status = "refunded";
    const refund: PaymentRefund = { id: `ref_sandbox_${++this.seq}`, paymentId, status: "succeeded", amountRub: refundAmount };
    this.refunds.set(paymentId, refund);
    return refund;
  }
}
