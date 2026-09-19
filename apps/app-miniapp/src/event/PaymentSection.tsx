// START_MODULE_CONTRACT
// PURPOSE: In-app payment block on the event page: status of the booking payment plus the pay/retry action.
// SCOPE: Presentational only — amounts and status transitions come from API responses (BookingWithSeats.payment); renders nothing without a payment; refunded/cancelled are read-only lines (the refund itself is a server-side path).
// DEPENDS: @max-events/api-contracts (Payment), ../ui/primitives.js (AppButton, AppText, AppTitle), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PaymentSectionProps - payment (null hides the block), in-flight busy flag guarding repeat clicks, inline pay error, pay/retry handler
// - PaymentSection - payment status block: pending/failed -> pay button (disabled while busy), succeeded -> paid line + receipt description, refunded/cancelled -> info line
// END_MODULE_MAP

import type { Payment } from "@max-events/api-contracts";
import { AppButton, AppText, AppTitle } from "../ui/primitives";

export interface PaymentSectionProps {
  payment: Payment | null;
  busy: boolean;
  error?: boolean;
  onPay: () => void;
}

export function PaymentSection({ payment, busy, error = false, onPay }: PaymentSectionProps) {
  if (payment === null) return null;
  const amount = `${payment.amountRub} ₽`;
  const payable = payment.status === "pending" || payment.status === "failed";
  return (
    <section className="app-event">
      <div className="app-event-body">
        <AppTitle asChild>
          <h2 className="app-section-title">Оплата</h2>
        </AppTitle>
        {payment.status === "succeeded" && <AppText>Оплачено {amount}</AppText>}
        {payment.status === "succeeded" && <AppText>{payment.description}</AppText>}
        {payment.status === "refunded" && <AppText>Возврат {amount}</AppText>}
        {payment.status === "cancelled" && <AppText>Платёж отменён</AppText>}
        {payment.status === "failed" && <AppText>Ошибка оплаты — повторить</AppText>}
        {error && <p className="app-state app-state--error">Не удалось выполнить оплату. Попробуйте ещё раз.</p>}
        {payable && (
          <AppButton onClick={onPay} disabled={busy} stretched>
            {payment.status === "pending" ? `Оплатить ${amount}` : `Повторить оплату — ${amount}`}
          </AppButton>
        )}
      </div>
    </section>
  );
}
