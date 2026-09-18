import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { ConfigService } from "@nestjs/config";
import { PaymentsController } from "./payments.controller";
import type { PaymentsWebhookService } from "./payments-webhook.service";
import { PAYMENT_SIGNATURE_HEADER, signPaymentWebhook } from "./webhook-signature";

const secret = "test-webhook-secret";
const body = { eventId: "evt_1", paymentId: "pay_sandbox_1", status: "succeeded" as const };

describe("PaymentsController.webhook", () => {
  it("passes the serialized body and signature header to the webhook service", async () => {
    const raw = JSON.stringify(body);
    const signature = signPaymentWebhook(secret, raw);
    let seen: { raw?: string; signature?: string; secret?: string } = {};
    const webhooks = {
      handleWebhook: async (rawBody: string, sig: string | undefined, sec: string | undefined) => {
        seen = { raw: rawBody, signature: sig, secret: sec };
        return { duplicate: false, applied: true };
      },
    } as unknown as PaymentsWebhookService;
    const config = { get: (key: string) => (key === "PAYMENT_SECRET" ? secret : undefined) } as unknown as ConfigService;
    const controller = new PaymentsController(webhooks, config);
    await expect(controller.webhook(signature, body)).resolves.toEqual({ duplicate: false, applied: true });
    expect(seen.raw).toBe(raw);
    expect(seen.signature).toBe(signature);
    expect(seen.secret).toBe(secret);
    expect(PAYMENT_SIGNATURE_HEADER).toBe("x-payment-signature");
  });

  it("propagates 401 when the webhook service rejects the signature", async () => {
    const webhooks = {
      handleWebhook: async () => {
        throw new UnauthorizedException("Invalid payment webhook signature");
      },
    } as unknown as PaymentsWebhookService;
    const config = { get: () => secret } as unknown as ConfigService;
    const controller = new PaymentsController(webhooks, config);
    await expect(controller.webhook("nope", body)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
