// START_MODULE_CONTRACT
// PURPOSE: Public HMAC-signed payment webhook surface.
// SCOPE: POST /payments/webhook; @Public; 401 on bad/missing signature.
// DEPENDS: @nestjs/common, @nestjs/config, ./payments-webhook.service, ./webhook-signature
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PaymentsController - POST /payments/webhook
// END_MODULE_MAP

import { Body, Controller, Headers, HttpCode, Inject, Post } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Public } from "../auth/auth.guard";
import { PaymentsWebhookService, type PaymentWebhookResult } from "./payments-webhook.service";
import { PAYMENT_SIGNATURE_HEADER } from "./webhook-signature";

@Public()
@Controller("payments")
export class PaymentsController {
  constructor(
    @Inject(PaymentsWebhookService) private readonly webhooks: PaymentsWebhookService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  @Post("webhook")
  @HttpCode(200)
  async webhook(@Headers(PAYMENT_SIGNATURE_HEADER) signature: string | undefined, @Body() body: unknown): Promise<PaymentWebhookResult> {
    const rawBody = JSON.stringify(body);
    return this.webhooks.handleWebhook(rawBody, signature, this.config.get<string>("PAYMENT_SECRET"));
  }
}
