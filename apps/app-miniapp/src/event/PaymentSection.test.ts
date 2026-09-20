import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Payment } from "@max-events/api-contracts";
import { PaymentSection } from "./PaymentSection";

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "70000000-0000-4000-8000-000000000001",
    bookingId: "e0000000-0000-4000-8000-000000000001",
    providerPaymentId: "pay_sandbox_test",
    status: "pending",
    amountRub: 1800,
    currency: "RUB",
    description: "Билет: Вечер Рахманинова",
    commissionRub: null,
    netRub: null,
    commissionBps: null,
    commissionFixedAt: null,
    createdAt: "2026-09-01T10:00:00+03:00",
    updatedAt: "2026-09-01T10:00:00+03:00",
    ...overrides,
  };
}

const render = (props: Partial<Parameters<typeof PaymentSection>[0]> = {}) => renderToStaticMarkup(createElement(PaymentSection, { payment: payment(), busy: false, onPay: () => {}, ...props }));

describe("PaymentSection", () => {
  it("renders nothing without a payment", () => {
    expect(render({ payment: null })).toBe("");
  });

  it("offers paying the API-provided amount for a pending payment", () => {
    const html = render();
    expect(html).toContain("Оплатить 1800 ₽");
    expect(html).not.toContain("disabled");
  });

  it("disables the pay button while the request is in flight", () => {
    expect(render({ busy: true })).toContain("disabled");
  });

  it("shows the paid line with the receipt description for a succeeded payment", () => {
    const html = render({ payment: payment({ status: "succeeded" }) });
    expect(html).toContain("Оплачено 1800 ₽");
    expect(html).toContain("Билет: Вечер Рахманинова");
    expect(html).not.toContain("Оплатить");
  });

  it("offers a retry for a failed payment", () => {
    const html = render({ payment: payment({ status: "failed" }) });
    expect(html).toContain("Ошибка оплаты — повторить");
    expect(html).toContain("Повторить оплату — 1800 ₽");
  });

  it("shows a read-only line for a refunded payment", () => {
    const refunded = render({ payment: payment({ status: "refunded" }) });
    expect(refunded).toContain("Возврат 1800 ₽");
    expect(refunded).not.toContain("Оплатить");
  });

  it("offers a retry for a cancelled payment instead of a dead end", () => {
    const cancelled = render({ payment: payment({ status: "cancelled" }) });
    expect(cancelled).toContain("Платёж отменён");
    expect(cancelled).toContain("Повторить оплату — 1800 ₽");
  });

  it("surfaces a failed pay attempt inline", () => {
    const html = render({ error: true });
    expect(html).toContain("Не удалось выполнить оплату");
    expect(html).toContain("app-state--error");
  });
});
