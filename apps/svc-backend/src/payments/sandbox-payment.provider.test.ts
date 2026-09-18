import { describe, expect, it } from "vitest";
import { NonePaymentProvider } from "./none-payment.provider";
import { PaymentProviderError } from "./payment-provider";
import { createPaymentProvider } from "./payments.module";
import { PaymentsService } from "./payments.service";
import { SANDBOX_FAIL_AMOUNT, SandboxPaymentProvider } from "./sandbox-payment.provider";

const ok = { amountRub: 850, currency: "RUB" as const, description: "Билет на джаз", idempotencyKey: "booking-1" };

describe("SandboxPaymentProvider", () => {
  it("succeeds, then refunds, and treats a second create with the same key as a no-op", async () => {
    const provider = new SandboxPaymentProvider();
    const service = new PaymentsService(provider, { findOneBy: async () => null } as never, { findOneBy: async () => null } as never, { find: async () => [] } as never, { get: () => 1000 } as never);
    const charge = await service.create(ok);
    expect(charge.status).toBe("succeeded");
    expect(charge.amountRub).toBe(850);
    charge.status = "failed";
    expect((await service.getStatus(charge.id)).status).toBe("succeeded");
    expect(await service.create({ ...ok, amountRub: 1 })).toMatchObject({ id: charge.id, status: "succeeded" });
    const refund = await service.refund(charge.id);
    expect(refund.status).toBe("succeeded");
    expect(refund.amountRub).toBe(850);
    expect((await service.getStatus(charge.id)).status).toBe("refunded");
    expect(await service.refund(charge.id)).toEqual(refund);
    const other = await service.create({ ...ok, idempotencyKey: "booking-2" });
    await expect(service.refund(other.id, 1)).rejects.toMatchObject({ code: "invalid_amount" });
  });

  it("declines the fail amount and a [fail] description", async () => {
    const provider = new SandboxPaymentProvider();
    const declined = await provider.create({ ...ok, amountRub: SANDBOX_FAIL_AMOUNT, idempotencyKey: "fail-amount" });
    expect(declined.status).toBe("failed");
    const marked = await provider.create({ ...ok, description: "Билет [fail]", idempotencyKey: "fail-text" });
    expect(marked.status).toBe("failed");
    const refund = await provider.refund(declined.id);
    expect(refund.status).toBe("failed");
    await expect(provider.create({ ...ok, amountRub: 0, idempotencyKey: "zero" })).rejects.toBeInstanceOf(PaymentProviderError);
  });
});

describe("NonePaymentProvider", () => {
  it("rejects create, status and refund", async () => {
    const provider = new NonePaymentProvider();
    await expect(provider.create(ok)).rejects.toMatchObject({ code: "payments_disabled" });
    await expect(provider.getStatus("pay_x")).rejects.toMatchObject({ code: "payments_disabled" });
    await expect(provider.refund("pay_x")).rejects.toMatchObject({ code: "payments_disabled" });
  });
});

describe("createPaymentProvider", () => {
  it("uses sandbox when unset and fail-closes unknown kinds", async () => {
    const sandbox = createPaymentProvider(undefined);
    expect((await sandbox.create({ ...ok, idempotencyKey: "factory-ok" })).status).toBe("succeeded");
    const none = createPaymentProvider("none");
    await expect(none.create({ ...ok, idempotencyKey: "factory-none" })).rejects.toMatchObject({ code: "payments_disabled" });
    const unknown = createPaymentProvider("yookassa");
    await expect(unknown.create({ ...ok, idempotencyKey: "factory-unknown" })).rejects.toMatchObject({ code: "payments_disabled" });
  });
});
