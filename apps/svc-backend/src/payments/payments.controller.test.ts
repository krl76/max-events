import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import { paymentWebhookRawBody, PaymentsController } from "./payments.controller";
import type { PaymentsWebhookService } from "./payments-webhook.service";
import { PAYMENT_SIGNATURE_HEADER, signPaymentWebhook } from "./webhook-signature";

const secret = "test-webhook-secret";
const pretty = '{\n  "eventId": "evt_1",\n  "paymentId": "pay_sandbox_1",\n  "status": "succeeded"\n}';

describe("PaymentsController.webhook", () => {
  it("verifies HMAC over the raw body, including whitespace", async () => {
    const signature = signPaymentWebhook(secret, pretty);
    let seen: { raw?: string; signature?: string; secret?: string } = {};
    const webhooks = {
      handleWebhook: async (rawBody: string, sig: string | undefined, sec: string | undefined) => {
        seen = { raw: rawBody, signature: sig, secret: sec };
        return { duplicate: false, applied: true };
      },
    } as unknown as PaymentsWebhookService;
    const config = { get: (key: string) => (key === "PAYMENT_SECRET" ? secret : undefined) } as unknown as ConfigService;
    const controller = new PaymentsController(webhooks, config);
    const req = { rawBody: Buffer.from(pretty) } as Request & { rawBody?: Buffer };
    await expect(controller.webhook(signature, req)).resolves.toEqual({ duplicate: false, applied: true });
    expect(seen.raw).toBe(pretty);
    expect(seen.signature).toBe(signature);
    expect(seen.secret).toBe(secret);
    expect(PAYMENT_SIGNATURE_HEADER).toBe("x-payment-signature");
    expect(() => paymentWebhookRawBody({})).toThrow(BadRequestException);
  });

  it("propagates 401 when the webhook service rejects the signature", async () => {
    const webhooks = {
      handleWebhook: async () => {
        throw new UnauthorizedException("Invalid payment webhook signature");
      },
    } as unknown as PaymentsWebhookService;
    const config = { get: () => secret } as unknown as ConfigService;
    const controller = new PaymentsController(webhooks, config);
    const req = { rawBody: Buffer.from(pretty) } as Request & { rawBody?: Buffer };
    await expect(controller.webhook("nope", req)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
