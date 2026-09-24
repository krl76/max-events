import { describe, expect, it } from "vitest";
import { mockBookings, mockPayments, myMockWaitlistEntry, remainingSeats, waitlistAheadCount } from "./mock/bookings";
import { mockDemoUser, mockEvents } from "./mock/fixtures";

// Фикстуры, на которых держатся состояния экранов 17 и 18; сброс в тестах их чистит, поэтому здесь никаких reset.
const TICKET_EVENT = mockEvents[0]; // Вечер Рахманинова — платный, ближайший
const ALMOST_FULL_EVENT = mockEvents[7]; // Экскурсия по Китай-городу, вместимость 20
const SOLD_OUT_EVENT = mockEvents[3]; // Помощь в приюте, вместимость 15

const activeOf = (eventId: string, userId: string) => mockBookings.find((booking) => booking.eventId === eventId && booking.userId === userId && booking.status === "active");

describe("стартовая фикстура бронирований", () => {
  it("даёт демо-пользователю оплаченный билет на ближайшее платное событие", () => {
    const booking = activeOf(TICKET_EVENT.id, mockDemoUser.id);
    expect(booking).toBeDefined();
    const payment = mockPayments.find((item) => item.bookingId === booking?.id);
    expect(payment?.status).toBe("succeeded");
    expect(payment?.amountRub).toBe(TICKET_EVENT.priceRub);
    // Комиссия заморожена при успешном списании — иначе «Мои брони» показали бы неоплаченный билет
    expect(payment?.commissionFixedAt).not.toBeNull();
  });

  it("оставляет на почти заполненном событии ровно четыре места", () => {
    expect(ALMOST_FULL_EVENT.capacity).toBe(20);
    expect(remainingSeats(ALMOST_FULL_EVENT.id)).toBe(4);
  });

  it("раскупает событие с наименьшей вместимостью и ставит за ним очередь из семи человек", () => {
    expect(remainingSeats(SOLD_OUT_EVENT.id)).toBe(0);
    expect(waitlistAheadCount(SOLD_OUT_EVENT.id)).toBe(7);
  });

  it("держит демо-пользователя последним в этой очереди", () => {
    const entry = myMockWaitlistEntry(SOLD_OUT_EVENT.id, mockDemoUser.id);
    expect(entry?.status).toBe("waiting");
    expect(entry?.position).toBe(7);
  });

  it("не занимает мест очередью: ожидающая запись места не резервирует", () => {
    const waiting = mockBookings.filter((booking) => booking.eventId === SOLD_OUT_EVENT.id && booking.status === "active").length;
    expect(waiting).toBe(SOLD_OUT_EVENT.capacity);
  });
});
