import { describe, expect, it } from "vitest";
import { signPaymentWebhook, verifyPaymentWebhook } from "./webhook-signature";

const secret = "test-webhook-secret";
const body = '{"eventId":"evt_1","paymentId":"pay_1","status":"succeeded"}';

describe("payment webhook signatures", () => {
  it("accepts a matching HMAC and rejects a flipped bit", () => {
    const signature = signPaymentWebhook(secret, body);
    expect(verifyPaymentWebhook(secret, body, signature)).toBe(true);
    expect(verifyPaymentWebhook(secret, body, undefined)).toBe(false);
    expect(verifyPaymentWebhook("other-secret", body, signature)).toBe(false);
    const flipped = `${signature.slice(0, -1)}${signature.endsWith("a") ? "b" : "a"}`;
    expect(verifyPaymentWebhook(secret, body, flipped)).toBe(false);
  });
});
