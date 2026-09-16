import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CalendarView, splitCalendarEntries } from "./CalendarPage";
import type { Booking } from "@max-events/api-contracts";
import type { CalendarEntry } from "../api/client";
import { mockEvents, mockPlaces } from "../api/mock";

const NOW = new Date("2026-09-20T12:00:00+03:00");

function entry(eventIndex: number, bookingId: string): CalendarEntry {
  const event = mockEvents[eventIndex];
  const booking: Booking = { id: bookingId, userId: "a0000000-0000-4000-8000-000000000001", eventId: event.id, status: "active", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };
  return { booking, event, place: mockPlaces.find((item) => item.id === event.placeId) ?? null };
}

describe("splitCalendarEntries", () => {
  it("splits entries by the event start: upcoming soonest first, past latest first", () => {
    const { upcoming, past } = splitCalendarEntries([entry(2, "b1"), entry(5, "b2"), entry(3, "b3"), entry(0, "b4")], NOW);

    expect(upcoming.map((item) => item.booking.id)).toEqual(["b3", "b2"]);
    expect(past.map((item) => item.booking.id)).toEqual(["b1", "b4"]);
  });

  it("treats an event starting exactly now as upcoming", () => {
    const { upcoming, past } = splitCalendarEntries([entry(2, "b1")], new Date(mockEvents[2].startsAt));

    expect(upcoming.map((item) => item.booking.id)).toEqual(["b1"]);
    expect(past).toEqual([]);
  });
});

describe("CalendarView", () => {
  it("renders both sections with cancel buttons only on upcoming cards", () => {
    const html = renderToStaticMarkup(createElement(CalendarView, { state: { status: "ready", entries: [entry(2, "b1"), entry(3, "b2")] }, now: NOW, onCancel: () => {} }));

    expect(html).toContain("Запланированные");
    expect(html).toContain("Прошедшие");
    expect(html).toContain(mockEvents[3].title);
    expect(html).toContain(mockEvents[2].title);
    expect(html).toContain("Отменить запись");
    expect(html.match(/app-calendar-cancel/g)).toHaveLength(1);
  });

  it("renders the card facts from the booking aggregate", () => {
    const upcomingEntry = entry(3, "b1");
    const html = renderToStaticMarkup(createElement(CalendarView, { state: { status: "ready", entries: [upcomingEntry] }, now: NOW, onCancel: () => {} }));

    expect(html).toContain(mockEvents[3].title);
    expect(html).toContain("Волонтёрство");
    expect(html).toContain("Бесплатно");
    expect(html).toContain(new Date(mockEvents[3].startsAt).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }));
  });

  it("renders the place title when the event has one", () => {
    const withPlace = entry(2, "b1");
    const html = renderToStaticMarkup(createElement(CalendarView, { state: { status: "ready", entries: [withPlace] }, now: new Date("2026-09-21T00:00:00+03:00"), onCancel: () => {} }));

    expect(html).toContain(mockPlaces[0].title);
  });

  it("renders empty states for both sections without cards", () => {
    const html = renderToStaticMarkup(createElement(CalendarView, { state: { status: "ready", entries: [] }, now: NOW, onCancel: () => {} }));

    expect(html).toContain("Нет запланированных событий");
    expect(html).toContain("Нет прошедших событий");
    expect(html).not.toContain("app-card-title");
    expect(html).not.toContain("Отменить запись");
  });

  it("renders loading and error states", () => {
    const loading = renderToStaticMarkup(createElement(CalendarView, { state: { status: "loading" }, now: NOW, onCancel: () => {} }));
    const error = renderToStaticMarkup(createElement(CalendarView, { state: { status: "error" }, now: NOW, onCancel: () => {} }));

    expect(loading).toContain("Загрузка…");
    expect(error).toContain("app-state--error");
    expect(error).toContain("Не удалось загрузить календарь");
  });
});
