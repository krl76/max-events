// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring PaymentProvider from env (sandbox or none).
// SCOPE: Factory selects SandboxPaymentProvider or NonePaymentProvider; exports PaymentsService.
// DEPENDS: @nestjs/config, ./sandbox-payment.provider, ./none-payment.provider, ./payments.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PaymentsModule - provides PAYMENT_PROVIDER and PaymentsService
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NonePaymentProvider } from "./none-payment.provider";
import { PAYMENT_PROVIDER } from "./payment-provider";
import { PaymentsService } from "./payments.service";
import { SANDBOX_FAIL_AMOUNT, SandboxPaymentProvider } from "./sandbox-payment.provider";

@Module({
  providers: [
    {
      provide: PAYMENT_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const kind = config.get<string>("PAYMENT_PROVIDER") ?? "sandbox";
        if (kind === "none") return new NonePaymentProvider();
        const failAmount = config.get<number>("PAYMENT_SANDBOX_FAIL_AMOUNT") ?? SANDBOX_FAIL_AMOUNT;
        return new SandboxPaymentProvider(failAmount);
      },
    },
    PaymentsService,
  ],
  exports: [PaymentsService, PAYMENT_PROVIDER],
})
export class PaymentsModule {}
