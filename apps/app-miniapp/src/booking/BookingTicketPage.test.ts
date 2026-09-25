import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SlotBookingScreen } from "../api/client";
import { mockPlaces } from "../api/mock";
import { BookingTicketView, chatMembersLabel, inviteLine, partyLabel, ticketPlaceLine, ticketShareText, ticketWhen } from "./BookingTicketPage";

const park = mockPlaces[0];

/** ru-RU groups thousands with a no-break space; the assertions read better with a plain one. */
const plain = (value: string): string => value.replaceAll("\u00a0", " ");

function screen(overrides: Partial<SlotBookingScreen> = {}): SlotBookingScreen {
  return {
    booking: {
      id: "f1000000-0000-4000-8000-000000000001",
      slotId: "f0000001-0000-4000-8000-202609190002",
      placeId: park.id,
      userId: "a0000000-0000-4000-8000-000000000001",
      status: "active",
      checkInCode: "MAX-4821-19SB",
      partySize: 3,
      extraIds: ["coal"],
      totalRub: 3000,
      cancelBefore: "2026-09-19T12:00:00+03:00",
      createdAt: "2026-09-18T12:00:00+03:00",
      updatedAt: "2026-09-18T12:00:00+03:00",
    },
    slot: { id: "f0000001-0000-4000-8000-202609190002", placeId: park.id, startsAt: "2026-09-19T17:30:00+03:00", endsAt: "2026-09-19T20:30:00+03:00", capacity: 12, takenSeats: 3, priceRub: 2400, status: "booked", busyUntil: "2026-09-19T20:30:00+03:00", weather: null },
    place: park,
    unitTitle: "Беседка №4 у залива",
    company: [
      { id: "f1", name: "Анна Соколова", avatarUrl: null },
      { id: "f2", name: "Дима Кузнецов", avatarUrl: null },
    ],
    freeSeats: 9,
    distanceKm: 2.4,
    travelMinutes: 15,
    chat: [{ id: "m1", bookingId: "f1000000-0000-4000-8000-000000000001", authorKind: "venue", authorName: "Парк Горького", text: "Беседка будет открыта с 17:20, уголь оставим у входа", sentAt: "2026-09-18T10:12:00+03:00" }],
    ...overrides,
  };
}

function viewHtml(overrides: Partial<SlotBookingScreen> = {}, confirming = false): string {
  return plain(renderToStaticMarkup(createElement(BookingTicketView, { screen: screen(overrides), confirming, busy: false, failed: false, shared: null, onBack: () => {}, onRoute: () => {}, onCalendar: () => {}, onShare: () => {}, onCancel: () => {} })));
}

describe("ticketWhen", () => {
  it("opens with the full weekday, capitalised, and ends with the start of the window", () => {
    expect(ticketWhen("2026-09-19T17:30:00+03:00")).toBe("Суббота, 19 сентября · 17:30");
  });
});

describe("ticketPlaceLine", () => {
  it("adds the distance and the time on the way, and drops what routing cannot say", () => {
    expect(ticketPlaceLine({ place: park, distanceKm: 2.4, travelMinutes: 15 })).toBe("Парк Горького · 2,4 км · 15 мин");
    expect(ticketPlaceLine({ place: park, distanceKm: null, travelMinutes: null })).toBe("Парк Горького");
  });
});

describe("partyLabel and inviteLine", () => {
  it("count the company and the seats still free at the table", () => {
    expect(partyLabel(3)).toBe("3 человека");
    expect(partyLabel(1)).toBe("1 человек");
    expect(inviteLine({ slot: screen().slot, freeSeats: 9 })).toBe("Стол на 12, свободно 9 мест");
    expect(inviteLine({ slot: screen().slot, freeSeats: 1 })).toBe("Стол на 12, свободно 1 место");
    expect(inviteLine({ slot: screen().slot, freeSeats: 0 })).toBe("Стол на 12, мест больше нет");
  });
});

describe("chatMembersLabel", () => {
  it("names the company and ends with the venue, which is always in the chat", () => {
    expect(chatMembersLabel([])).toBe("Ты и площадка");
    expect(
      chatMembersLabel([
        { id: "f1", name: "Анна Соколова", avatarUrl: null },
        { id: "f2", name: "Дима Кузнецов", avatarUrl: null },
      ]),
    ).toBe("Ты, Анна, Дима и площадка");
  });
});

describe("ticketShareText", () => {
  it("names the unit, the venue and the window", () => {
    expect(ticketShareText(screen())).toBe("Беседка №4 у залива · Парк Горького, Суббота, 19 сентября · 17:30. Присоединяйся!");
  });
});

describe("BookingTicketView", () => {
  it("renders the confirmation, the code, the four facts and the chat", () => {
    const html = viewHtml();

    expect(html).toContain("Бронь подтверждена");
    expect(html).toContain("Суббота, 19 сентября · 17:30");
    expect(html).toContain("Беседка №4 у залива");
    expect(html).toContain("Парк Горького · 2,4 км · 15 мин");
    expect(html).toContain("MAX-4821-19SB");
    expect(html).toContain("Покажите код на входе");
    expect(html).toContain("17:30 – 20:30");
    expect(html).toContain("3 человека");
    expect(html).toContain("3 000 ₽");
    expect(html).toContain("до 12:00");
    expect(html).toContain("Маршрут");
    expect(html).toContain("В календарь");
    expect(html).toContain("Чат брони");
    expect(html).toContain("Ты, Анна, Дима и площадка");
    expect(html).toContain("Беседка будет открыта с 17:20");
    expect(html).toContain("Стол на 12, свободно 9 мест");
    expect(html).toContain("Отменить бронь");
  });

  it("arms the cancellation before it performs it", () => {
    expect(viewHtml({}, true)).toContain("Точно отменить бронь?");
  });

  it("drops the cancellation once the booking is already cancelled", () => {
    const html = viewHtml({ booking: { ...screen().booking, status: "cancelled" } });

    expect(html).toContain("Бронь отменена");
    expect(html).not.toContain("Отменить бронь");
  });

  it("says the chat is empty instead of drawing an empty block", () => {
    expect(viewHtml({ chat: [] })).toContain("В чате пока тихо.");
  });
});
