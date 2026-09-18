// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring PaymentProvider from env (sandbox or none).
// SCOPE: Factory selects SandboxPaymentProvider or NonePaymentProvider; exports PaymentsService.
// DEPENDS: @nestjs/config, ./sandbox-payment.provider, ./none-payment.provider, ./payments.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - createPaymentProvider - sandbox / none / unknown→none
// - PaymentsModule - provides PAYMENT_PROVIDER and PaymentsService
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NonePaymentProvider } from "./none-payment.provider";
import { PaymentWebhookEventEntity } from "./payment-webhook-event.entity";
import { PaymentEntity } from "./payment.entity";
import { PAYMENT_PROVIDER, type PaymentProvider } from "./payment-provider";
import { PaymentsController } from "./payments.controller";
import { PaymentsWebhookService } from "./payments-webhook.service";
import { PaymentsService } from "./payments.service";
import { SANDBOX_FAIL_AMOUNT, SandboxPaymentProvider } from "./sandbox-payment.provider";

export function createPaymentProvider(kind: string | undefined, failAmount = SANDBOX_FAIL_AMOUNT): PaymentProvider {
  if (kind === "none") return new NonePaymentProvider();
  if (kind === "sandbox" || kind == null || kind === "") return new SandboxPaymentProvider(failAmount);
  return new NonePaymentProvider();
}

@Module({
  imports: [TypeOrmModule.forFeature([PaymentEntity, PaymentWebhookEventEntity])],
  controllers: [PaymentsController],
  providers: [
    {
      provide: PAYMENT_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createPaymentProvider(config.get<string>("PAYMENT_PROVIDER"), config.get<number>("PAYMENT_SANDBOX_FAIL_AMOUNT") ?? SANDBOX_FAIL_AMOUNT),
    },
    PaymentsService,
    PaymentsWebhookService,
  ],
  exports: [PaymentsService, PAYMENT_PROVIDER],
})
export class PaymentsModule {}
