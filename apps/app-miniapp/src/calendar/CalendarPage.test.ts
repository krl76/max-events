import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CalendarView, SharedCalendarView, calendarShare, calendarShareText, filterCalendarScope, instrumentalName, peersLabel, splitCalendarEntries } from "./CalendarPage";
import type { Booking, Friend } from "@max-events/api-contracts";
import type { CalendarEntry, SharedCalendar } from "../api/client";
import { mockEvents, mockPlaces } from "../api/mock";
import type { CalendarSource } from "./MonthCalendar";

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

function friend(name: string): Friend {
  return { id: `a0000000-0000-4000-8000-00000000000${name.length}`, name, avatarUrl: null };
}

function sharedWith(names: string[], inviteUrl: string | null = null): SharedCalendar {
  return { peers: names.map((name) => ({ friend: friend(name), canEdit: true })), entries: [], inviteUrl };
}

describe("instrumentalName", () => {
  it("declines by the ending of the name itself, not by a gender nobody sent", () => {
    expect(instrumentalName("Анна")).toBe("Анной");
    expect(instrumentalName("Никита")).toBe("Никитой");
    expect(instrumentalName("Ксения")).toBe("Ксенией");
    expect(instrumentalName("Андрей")).toBe("Андреем");
    expect(instrumentalName("Игорь")).toBe("Игорем");
    expect(instrumentalName("Иван")).toBe("Иваном");
  });

  it("softens the ending after a hushing consonant", () => {
    expect(instrumentalName("Даша")).toBe("Дашей");
    expect(instrumentalName("Гоша")).toBe("Гошей");
  });

  it("leaves alone what Russian does not decline", () => {
    expect(instrumentalName("Отто")).toBe("Отто");
    expect(instrumentalName("Нелли")).toBe("Нелли");
    expect(instrumentalName("Nicole")).toBe("Nicole");
  });
});

describe("peersLabel", () => {
  it("names the peers in the instrumental case", () => {
    expect(peersLabel(sharedWith(["Анна Соколова"]))).toBe("Общий с Анной");
    expect(peersLabel(sharedWith(["Анна Соколова", "Пётр Ким"]))).toBe("Общий с Анной, Пётром");
  });

  it("says nothing about sharing when the calendar is shared with nobody", () => {
    expect(peersLabel(sharedWith([]))).toBeNull();
  });
});

describe("calendarShareText", () => {
  it("carries the invite link when one was issued", () => {
    expect(calendarShareText(sharedWith(["Анна Соколова"], "https://max.ru/c/1"))).toContain("https://max.ru/c/1");
    const rewritten = calendarShare(sharedWith([], "https://events.versacegus.cc/calendar/invite/018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d93"));
    expect(rewritten.link).toBe("https://max.ru/t691_hakaton_max_bot?startapp=calendar-018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d93");
    expect(rewritten.text).not.toContain("events.versacegus.cc");
  });

  it("stays a sentence without peers and without a link", () => {
    expect(calendarShareText(sharedWith([]))).toBe("Мой календарь планов в MAX Афише");
  });
});

describe("CalendarView", () => {
  it("renders both sections with cancel buttons only on upcoming cards", () => {
    const html = renderToStaticMarkup(createElement(CalendarView, { state: { status: "ready", entries: [entry(2, "b1"), entry(3, "b2")] }, now: NOW, onCancel: () => {}, onExplore: () => {}, onExport: () => {} }));

    expect(html).toContain("Запланированные");
    expect(html).toContain("Прошедшие");
    expect(html).toContain(mockEvents[3].title);
    expect(html).toContain(mockEvents[2].title);
    expect(html).toContain("Экспорт в календарь");
    expect(html.match(/Отменить запись/g)).toHaveLength(1);
  });

  it("opens an upcoming event and rates or repeats a past one", () => {
    const html = renderToStaticMarkup(createElement(CalendarView, { state: { status: "ready", entries: [entry(2, "b1"), entry(3, "b2")] }, now: NOW, onCancel: () => {}, onExplore: () => {}, onOpen: () => {}, onRate: () => {}, onRepeat: () => {} }));

    expect(html.match(/Открыть событие/g)).toHaveLength(1);
    expect(html.match(/Оценить/g)).toHaveLength(1);
    expect(html.match(/Повторить/g)).toHaveLength(1);
  });

  it("renders the card facts from the booking aggregate", () => {
    const upcomingEntry = entry(3, "b1");
    const html = renderToStaticMarkup(createElement(CalendarView, { state: { status: "ready", entries: [upcomingEntry] }, now: NOW, onCancel: () => {}, onExplore: () => {} }));

    expect(html).toContain(mockEvents[3].title);
    expect(html).toContain("Волонтёрство");
    expect(html).toContain("Бесплатно");
    expect(html).toContain(new Date(mockEvents[3].startsAt).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }));
  });

  it("renders the place title when the event has one", () => {
    const withPlace = entry(2, "b1");
    const html = renderToStaticMarkup(createElement(CalendarView, { state: { status: "ready", entries: [withPlace] }, now: new Date("2026-09-21T00:00:00+03:00"), onCancel: () => {}, onExplore: () => {} }));

    expect(html).toContain(mockPlaces[0].title);
  });

  it("renders empty states for both sections without cards", () => {
    const html = renderToStaticMarkup(createElement(CalendarView, { state: { status: "ready", entries: [] }, now: NOW, onCancel: () => {}, onExplore: () => {} }));

    expect(html).toContain("Нет запланированных событий");
    expect(html).toContain("Нет прошедших событий");
    expect(html).not.toContain("app-card-title");
    expect(html).not.toContain("Отменить запись");
  });

  it("renders loading and error states", () => {
    const loading = renderToStaticMarkup(createElement(CalendarView, { state: { status: "loading" }, now: NOW, onCancel: () => {}, onExplore: () => {} }));
    const error = renderToStaticMarkup(createElement(CalendarView, { state: { status: "error" }, now: NOW, onCancel: () => {}, onExplore: () => {} }));

    expect(loading).toContain("Загрузка…");
    expect(error).toContain("app-state--error");
    expect(error).toContain("Не удалось загрузить календарь");
    expect(error).not.toContain("Повторить");

    const retry = renderToStaticMarkup(createElement(CalendarView, { state: { status: "error" }, now: NOW, onCancel: () => {}, onExplore: () => {}, onRetry: () => {} }));
    expect(retry).toContain("Повторить");
  });
});

describe("SharedCalendarView", () => {
  const props = { shared: { status: "ready" as const, shared: sharedWith(["Анна Соколова"]) }, entries: [], month: NOW, selected: NOW, now: NOW, onSelect: () => {}, onOpen: () => {}, onGoing: () => {}, onShare: () => {}, onAddFriend: () => {}, chrome: true, onClose: () => {}, onSelectScope: () => {}, onRemovePeer: () => {} };

  it("keeps «Добавить друга» a single button and no longer unfolds a list inside the screen", () => {
    const html = renderToStaticMarkup(createElement(SharedCalendarView, props));

    expect(html).toContain("Добавить друга");
    expect(html).not.toContain("Скрыть список");
    expect(html).not.toContain("Кого позвать в календарь");
    expect(html).not.toContain("Позвать");
  });

  it("draws no section switch of its own: the row of pills lives on the «Планы» tab", () => {
    const html = renderToStaticMarkup(createElement(SharedCalendarView, props));

    expect(html).not.toContain("app-cal-switch");
    expect(html).not.toContain("Мои брони");
  });

  it("draws the calendar title without a back chevron, and can drop a friend", () => {
    const html = renderToStaticMarkup(createElement(SharedCalendarView, props));

    expect(html).not.toContain('aria-label="Назад"');
    expect(html).not.toContain("Закрыть");
    expect(html).toContain("Мой календарь");
    expect(html).toContain("Убрать Анна из календаря");
    expect(html).toContain("Ссылка на календарь");
  });
});

describe("filterCalendarScope", () => {
  it("keeps both calendars on your own scope and only the friend when their chip is selected", () => {
    const own = { id: "o", sources: ["own"] as CalendarSource[], title: "Своё", startsAt: "2026-10-01T12:00:00+03:00", endsAt: null, note: "", needsResponse: false, faces: ["Я"], eventId: null, planId: null, sharedId: null, ownerId: null };
    const later = { ...own, id: "later", startsAt: "2026-10-05T12:00:00+03:00" };
    const peer = { ...own, id: "p", sources: ["peer"] as CalendarSource[], title: "Друга", ownerId: "friend-1" };

    expect(filterCalendarScope([own, later, peer], "own").map((row) => row.id)).toEqual(["o", "later", "p"]);
    expect(filterCalendarScope([own, later, peer], "friend-1").map((row) => row.id)).toEqual(["o", "p"]);
  });
});
