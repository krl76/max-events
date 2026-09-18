// START_MODULE_CONTRACT
// PURPOSE: HMAC-SHA256 signatures for payment provider webhooks.
// SCOPE: signPaymentWebhook / verifyPaymentWebhook; timing-safe compare; never logs the secret.
// DEPENDS: node:crypto
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PAYMENT_SIGNATURE_HEADER - x-payment-signature
// - signPaymentWebhook - hex HMAC-SHA256 of the raw body
// - verifyPaymentWebhook - timing-safe signature check
// END_MODULE_MAP

import { createHmac, timingSafeEqual } from "node:crypto";

export const PAYMENT_SIGNATURE_HEADER = "x-payment-signature";

export function signPaymentWebhook(secret: string, rawBody: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

export function verifyPaymentWebhook(secret: string, rawBody: string, signature: string | undefined): boolean {
  if (!signature) return false;
  const expected = signPaymentWebhook(secret, rawBody);
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
