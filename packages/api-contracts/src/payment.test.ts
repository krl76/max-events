import { describe, expect, it } from "vitest";
import { PaymentSchema, PaymentWebhookWriteSchema } from "./payment.js";

const paymentId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d91";
const bookingId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d92";

describe("PaymentSchema", () => {
  it("accepts a succeeded RUB charge and rejects a zero amount", () => {
    const parsed = PaymentSchema.parse({
      id: paymentId,
      bookingId,
      providerPaymentId: "pay_sandbox_1",
      status: "succeeded",
      amountRub: 850,
      currency: "RUB",
      description: "Билет: Джаз",
      createdAt: "2026-09-12T10:00:00+03:00",
      updatedAt: "2026-09-12T10:00:00+03:00",
    });
    expect(parsed.status).toBe("succeeded");
    expect(parsed.commissionRub).toBeNull();
    expect(parsed.netRub).toBeNull();
    expect(PaymentSchema.safeParse({ ...parsed, amountRub: 0 }).success).toBe(false);
    expect(PaymentSchema.safeParse({ ...parsed, status: "paid" }).success).toBe(false);
  });
});

describe("PaymentWebhookWriteSchema", () => {
  it("requires eventId, provider paymentId and a known status", () => {
    expect(PaymentWebhookWriteSchema.parse({ eventId: "evt_1", paymentId: "pay_sandbox_1", status: "succeeded" }).status).toBe("succeeded");
    expect(PaymentWebhookWriteSchema.safeParse({ eventId: "evt_1", paymentId: "pay_sandbox_1", status: "paid" }).success).toBe(false);
    expect(PaymentWebhookWriteSchema.safeParse({ paymentId: "pay_sandbox_1", status: "succeeded" }).success).toBe(false);
  });
});
