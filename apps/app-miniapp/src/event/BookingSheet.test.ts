import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Friend } from "@max-events/api-contracts";
import type { EventDetails } from "../api/client";
import { mockEvents, mockPlaces } from "../api/mock";
import { BookingSheet, bookingSummary, friendNames, primaryCtaLabel, seatsFillPercent, sheetHeadline, ticketFriendsLine, waitlistCtaLabel } from "./BookingSheet";

const STARTS_AT = "2026-09-19T14:00:00";

const paidEvent = { ...mockEvents[0], startsAt: STARTS_AT, capacity: 20, isPaid: true, priceRub: 1800, paymentUrl: "https://tickets.example.com/x" };

const detailsOf = (over: Partial<EventDetails> = {}): EventDetails => ({
  event: paidEvent,
  place: mockPlaces[0],
  organizer: null,
  organization: null,
  remainingSeats: 4,
  activeBookingId: null,
  checkInId: null,
  organizerEventsCount: 34,
  ...over,
});

const friends: Friend[] = [
  { id: "a1", name: "Катя Орлова", avatarUrl: null },
  { id: "a2", name: "Сергей Ильин", avatarUrl: null },
  { id: "a3", name: "Ира Белова", avatarUrl: null },
];

const promo = { code: "", referral: "", error: null, onCode: () => {}, onReferral: () => {} };
const noop = () => {};

describe("sheetHeadline", () => {
  it("warns once the last fifth of the capacity is left and stops at zero", () => {
    expect(sheetHeadline(detailsOf({ remainingSeats: 4 }))).toBe("Мест почти нет");
    expect(sheetHeadline(detailsOf({ remainingSeats: 12 }))).toBe("Есть места");
    expect(sheetHeadline(detailsOf({ remainingSeats: 0 }))).toBe("Мест нет");
  });

  it("says «Свободный вход» for an event with no capacity to fill", () => {
    expect(sheetHeadline(detailsOf({ event: { ...paidEvent, capacity: null }, remainingSeats: null }))).toBe("Свободный вход");
  });
});

describe("seatsFillPercent", () => {
  it("fills the bar by the taken share and shows full without a capacity", () => {
    expect(seatsFillPercent(detailsOf({ remainingSeats: 4 }))).toBe(80);
    expect(seatsFillPercent(detailsOf({ remainingSeats: 20 }))).toBe(0);
    expect(seatsFillPercent(detailsOf({ event: { ...paidEvent, capacity: null }, remainingSeats: null }))).toBe(100);
  });
});

describe("bookingSummary", () => {
  it("names what is left, the price and who takes the money", () => {
    const text = bookingSummary(detailsOf(), "Городские события");

    expect(text).toContain("Осталось 4 билета");
    expect(text).toContain("₽");
    expect(text).toContain("«Городские события»");
    expect(text).toContain("подтверди участие");
  });

  it("drops the payment clause for a free event and declines «мест» instead of «билетов»", () => {
    const text = bookingSummary(detailsOf({ event: { ...paidEvent, isPaid: false, priceRub: null, paymentUrl: null }, remainingSeats: 1 }), null);

    expect(text).toContain("Осталось 1 место");
    expect(text).not.toContain("Оплата");
    expect(text).toContain("держит место за тобой");
  });
});

describe("friendNames and ticketFriendsLine", () => {
  it("joins the last name with «и» and keeps first names only", () => {
    expect(friendNames(friends)).toBe("Катя, Сергей и Ира");
    expect(friendNames(friends.slice(0, 1))).toBe("Катя");
  });

  it("stays right for one person, and says nothing when nobody has a ticket", () => {
    expect(ticketFriendsLine(friends.slice(0, 1))).toBe("Уже с билетами: Катя");
    expect(ticketFriendsLine([])).toBeNull();
  });
});

describe("waitlistCtaLabel and primaryCtaLabel", () => {
  it("counts the queue only when somebody stands in it", () => {
    expect(waitlistCtaLabel(7)).toBe("Встать в лист ожидания · 7 впереди");
    expect(waitlistCtaLabel(0)).toBe("Встать в лист ожидания");
  });

  it("sends a paid event to the organizer and records a free one in place", () => {
    expect(primaryCtaLabel(detailsOf())).toBe("Купить билет у организатора");
    expect(primaryCtaLabel(detailsOf({ event: { ...paidEvent, isPaid: false, priceRub: null, paymentUrl: null } }))).toBe("Записаться");
    expect(primaryCtaLabel(detailsOf({ activeBookingId: "e1" }))).toBe("Вы записаны");
  });
});

describe("BookingSheet", () => {
  it("draws the counter, the summary, the promo fields and the friends already holding tickets", () => {
    const html = renderToStaticMarkup(createElement(BookingSheet, { details: detailsOf(), offer: { waitlistAhead: 0, friendsWithTickets: friends }, organizerName: "Городские события", promo, waitlist: null, onClose: noop, onBook: noop, onCancel: noop }));

    expect(html).toContain("Мест почти нет");
    expect(html).toContain("16 из 20");
    expect(html).toContain("Уже с билетами: Катя, Сергей и Ира");
    expect(html).toContain("Позвать в общий план");
    expect(html).toContain("Купить билет у организатора");
    expect(html).toContain('aria-label="Промокод"');
    expect(html).not.toContain("лист ожидания");
  });

  it("offers the queue with the people ahead once the seats are gone", () => {
    const html = renderToStaticMarkup(createElement(BookingSheet, { details: detailsOf({ remainingSeats: 0 }), offer: { waitlistAhead: 7, friendsWithTickets: [] }, organizerName: null, promo, waitlist: { ahead: 7, joined: false, onJoin: noop }, onClose: noop, onBook: noop, onCancel: noop }));

    expect(html).toContain("Мест нет");
    expect(html).toContain("Встать в лист ожидания · 7 впереди");
    expect(html).toContain("Уведомим, если освободится место");
    // Места закончились — промокод их не вернёт, поэтому поля скрыты.
    expect(html).not.toContain('aria-label="Промокод"');
  });

  it("turns into the way out of the booking once the viewer is recorded", () => {
    const html = renderToStaticMarkup(createElement(BookingSheet, { details: detailsOf({ activeBookingId: "e1" }), offer: null, organizerName: null, promo, waitlist: null, onClose: noop, onBook: noop, onCancel: noop }));

    expect(html).toContain("Отменить запись");
    expect(html).not.toContain("Купить билет у организатора");
  });
});
