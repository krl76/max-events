import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CalendarEntry, MySlotsBoard, PlaceSlot } from "../api/client";
import { mockEvents, mockPlaces } from "../api/mock";
import { bookingCards, filterBookingCards, MyBookingsView, type BookingsBoard } from "./MyBookingsPage";

const park = mockPlaces[0];
const luzhniki = mockPlaces[2];
const NOW = new Date("2026-09-18T12:00:00+03:00");

/** ru-RU groups thousands with a no-break space; the assertions read better with a plain one. */
const plain = (value: string): string => value.replaceAll("\u00a0", " ");

function slot(overrides: Partial<PlaceSlot> = {}): PlaceSlot {
  return { id: "f0000001-0000-4000-8000-202609190002", placeId: park.id, startsAt: "2026-09-19T17:30:00+03:00", endsAt: "2026-09-19T20:30:00+03:00", capacity: 12, takenSeats: 3, priceRub: 2400, status: "booked", busyUntil: null, weather: null, ...overrides };
}

function slots(): MySlotsBoard {
  return {
    bookings: [
      {
        booking: { id: "book-1", slotId: slot().id, placeId: park.id, userId: "u1", status: "active", checkInCode: "MAX-4821-19SB", partySize: 3, extraIds: ["coal"], totalRub: 3000, cancelBefore: "2026-09-19T12:00:00+03:00", createdAt: "2026-09-18T10:00:00+03:00", updatedAt: "2026-09-18T10:00:00+03:00" },
        slot: slot(),
        place: park,
        unitTitle: "Беседка №4",
        company: [
          { id: "f1", name: "Анна Соколова", avatarUrl: null },
          { id: "f2", name: "Дима Кузнецов", avatarUrl: null },
        ],
      },
    ],
    waitlist: [
      {
        entry: { id: "wait-1", slotId: "f0000002-0000-4000-8000-202609240000", placeId: luzhniki.id, userId: "u1", position: 2, seats: 2 },
        slot: slot({ id: "f0000002-0000-4000-8000-202609240000", placeId: luzhniki.id, startsAt: "2026-09-24T19:30:00+03:00", endsAt: "2026-09-24T21:00:00+03:00", priceRub: 800, capacity: 4, takenSeats: 4 }),
        place: luzhniki,
        unitTitle: "Корт №3",
      },
    ],
  };
}

/** The seeded paid event (19 Sep, 1 800 ₽) is upcoming at NOW; the walk of 5 Sep is behind it. */
const upcomingEvent = mockEvents[0];
const pastEvent = mockEvents.find((event) => event.id === "c000000d-0000-4000-8000-00000000000d")!;

function calendar(): CalendarEntry[] {
  return [
    { booking: { id: "ticket-1", userId: "u1", eventId: upcomingEvent.id, status: "active", createdAt: "2026-09-10T10:00:00+03:00", updatedAt: "2026-09-10T10:00:00+03:00" }, event: upcomingEvent, place: park },
    { booking: { id: "ticket-2", userId: "u1", eventId: pastEvent.id, status: "active", createdAt: "2026-09-01T10:00:00+03:00", updatedAt: "2026-09-01T10:00:00+03:00" }, event: pastEvent, place: park },
  ];
}

const board = (): BookingsBoard => bookingCards(slots(), calendar(), [{ bookingId: "ticket-1", code: "MAX-7735-18TT" }], NOW);

function viewHtml(overrides: Partial<Parameters<typeof MyBookingsView>[0]> = {}): string {
  return plain(
    renderToStaticMarkup(
      createElement(MyBookingsView, {
        board: board(),
        tab: "active",
        query: "",
        searching: false,
        menuId: null,
        onTab: () => {},
        onQuery: () => {},
        onToggleSearch: () => {},
        onCalendar: () => {},
        onOpenTicket: () => {},
        onLeaveWaitlist: () => {},
        onMenu: () => {},
        onShare: () => {},
        onRate: () => {},
        onRepeat: () => {},
        ...overrides,
      }),
    ),
  );
}

describe("bookingCards", () => {
  it("folds the three sources into cards of one shape, soonest first", () => {
    const result = board();

    expect(result.active.map((card) => card.kind)).toEqual(["slot", "ticket", "waitlist"]);
    expect(result.activeCount).toBe(3);
    expect(result.pastCount).toBe(1);
  });

  it("words a booked window the way the design does", () => {
    const card = board().active[0];

    expect(card.venue).toBe("Парк Горького, беседка №4");
    expect(card.title).toBe("Беседка №4");
    expect(plain(card.meta)).toBe("Сб, 19 сентября · 17:30 – 20:30 · 3 000 ₽");
    expect(card.badge).toBe("Слот забронирован");
    expect(card.faces).toEqual(["Я", "А", "Д"]);
    expect(card.company).toBe("Ты, Анна и Дима");
    expect(card.code).toBe("MAX-4821-19SB");
  });

  it("marks a waiting position with its place in the queue and what it waits for", () => {
    const card = board().active[2];

    expect(card.badge).toBe("Лист ожидания · 2-й");
    expect(card.company).toBe("Ждём 2 места");
    expect(card.code).toBeNull();
  });

  it("gives a ticket its entry code from the codes list and nothing when there is none", () => {
    expect(board().active[1].code).toBe("MAX-7735-18TT");
    expect(bookingCards(slots(), calendar(), [], NOW).active[1].code).toBeNull();
  });

  it("moves a booking whose event has started into the past list", () => {
    expect(board().past).toEqual([{ eventId: pastEvent.id, title: pastEvent.title, meta: "Сб, 5 сентября", category: pastEvent.category }]);
  });
});

describe("filterBookingCards", () => {
  it("narrows the list to the kinds of the chosen tab", () => {
    const cards = board().active;

    expect(filterBookingCards(cards, "active", "").map((card) => card.kind)).toEqual(["slot", "ticket", "waitlist"]);
    expect(filterBookingCards(cards, "tickets", "").map((card) => card.kind)).toEqual(["ticket"]);
    expect(filterBookingCards(cards, "slots", "").map((card) => card.kind)).toEqual(["slot", "waitlist"]);
  });

  it("matches the needle against the title and the venue, case-insensitively", () => {
    const cards = board().active;

    expect(filterBookingCards(cards, "active", "корт").map((card) => card.title)).toEqual(["Корт №3"]);
    expect(filterBookingCards(cards, "active", "ГОРЬКОГО").map((card) => card.kind)).toEqual(["slot", "ticket"]);
    expect(filterBookingCards(cards, "active", "ничего")).toEqual([]);
  });
});

describe("MyBookingsView", () => {
  it("renders the topbar counters, the filters and a group per booking", () => {
    const html = viewHtml();

    expect(html).toContain("Мои брони");
    expect(html).toContain("3 активные · 1 прошедшая");
    expect(html).toContain("Календарь");
    expect(html).toContain("Активные");
    expect(html).toContain("Билеты");
    expect(html).toContain("Слоты");
    expect(html).toContain("Прошедшие");
    expect(html).toContain("Парк Горького, беседка №4");
    expect(html).toContain("Слот забронирован");
    expect(html).toContain("Ты, Анна и Дима");
    expect(html).toContain("Билет");
    expect(html).toContain("Код входа");
    expect(html).toContain("MAX-4821-19SB");
    expect(html).toContain("Лист ожидания · 2-й");
    expect(html).toContain("Выйти");
    expect(html).toContain("Перенести");
    expect(html).toContain("Оценить");
  });

  it("keeps the past list out of the slot and ticket tabs", () => {
    expect(viewHtml({ tab: "slots" })).not.toContain("Оценить");
    expect(viewHtml({ tab: "past" })).not.toContain("Слот забронирован");
  });

  it("explains an empty search instead of showing a blank screen", () => {
    expect(viewHtml({ query: "ничего", searching: true })).toContain("Ничего не нашлось.");
  });
});
