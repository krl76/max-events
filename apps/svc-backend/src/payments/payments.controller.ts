// START_MODULE_CONTRACT
// PURPOSE: Public HMAC-signed payment webhook surface.
// SCOPE: POST /payments/webhook; @Public; 401 on bad/missing signature.
// DEPENDS: @nestjs/common, @nestjs/config, ./payments-webhook.service, ./webhook-signature
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - paymentWebhookRawBody - utf8 rawBody or 400
// - PaymentsController - POST /payments/webhook
// END_MODULE_MAP

import { BadRequestException, Controller, Headers, HttpCode, Inject, Post, Req } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import { Public } from "../auth/auth.guard";
import { PaymentsWebhookService, type PaymentWebhookResult } from "./payments-webhook.service";
import { PAYMENT_SIGNATURE_HEADER } from "./webhook-signature";

export function paymentWebhookRawBody(req: { rawBody?: Buffer }): string {
  if (!req.rawBody || req.rawBody.length === 0) throw new BadRequestException("Missing raw webhook body");
  return req.rawBody.toString("utf8");
}

@Public()
@Controller("payments")
export class PaymentsController {
  constructor(
    @Inject(PaymentsWebhookService) private readonly webhooks: PaymentsWebhookService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  @Post("webhook")
  @HttpCode(200)
  async webhook(@Headers(PAYMENT_SIGNATURE_HEADER) signature: string | undefined, @Req() req: Request & { rawBody?: Buffer }): Promise<PaymentWebhookResult> {
    return this.webhooks.handleWebhook(paymentWebhookRawBody(req), signature, this.config.get<string>("PAYMENT_SECRET"));
  }
}
