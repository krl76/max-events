// START_MODULE_CONTRACT
// PURPOSE: Disabled payment provider — all operations fail closed when PAYMENT_PROVIDER=none.
// SCOPE: create/getStatus/refund throw PaymentProviderError payments_disabled.
// DEPENDS: ./payment-provider
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - NonePaymentProvider - no-op PaymentProvider that rejects
// END_MODULE_MAP

import { PaymentProviderError, type CreatePaymentInput, type PaymentProvider } from "./payment-provider";

export class NonePaymentProvider implements PaymentProvider {
  async create(_input: CreatePaymentInput): Promise<never> {
    throw new PaymentProviderError("payments_disabled", "Payments are disabled");
  }

  async getStatus(_paymentId: string): Promise<never> {
    throw new PaymentProviderError("payments_disabled", "Payments are disabled");
  }

  async refund(_paymentId: string, _amountRub?: number): Promise<never> {
    throw new PaymentProviderError("payments_disabled", "Payments are disabled");
  }
}
