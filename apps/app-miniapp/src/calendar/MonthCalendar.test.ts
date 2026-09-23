import { describe, expect, it } from "vitest";
import type { Booking } from "@max-events/api-contracts";
import type { CalendarEntry } from "../api/client";
import { WEEKDAY_LABELS, calendarReminder, dayKey, dayTitle, entriesOn, entryEndMs, mergeCalendarEntries, monthGridDays, monthTitle, overlapWarnings, type CalendarDayEntry } from "./MonthCalendar";
import { mockEvents, mockFriends, mockPlaces, mockSharedCalendar, planCards } from "../api/mock";

function booking(eventIndex: number, id: string): CalendarEntry {
  const event = mockEvents[eventIndex];
  const row: Booking = { id, userId: "a0000000-0000-4000-8000-000000000001", eventId: event.id, status: "active", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };
  return { booking: row, event, place: mockPlaces.find((item) => item.id === event.placeId) ?? null };
}

function entry(over: Partial<CalendarDayEntry> = {}): CalendarDayEntry {
  return { id: "x", sources: ["own"], title: "Запись", startsAt: "2026-09-18T19:00:00+03:00", endsAt: null, note: "", needsResponse: false, faces: ["Я"], eventId: null, planId: null, sharedId: null, ...over };
}

describe("dayKey", () => {
  it("compares days rather than instants", () => {
    const at = new Date(2026, 8, 18, 23, 30);

    expect(dayKey(at)).toBe("2026-09-18");
    expect(dayKey(at.toISOString())).toBe("2026-09-18");
  });
});

describe("monthGridDays", () => {
  it("fills whole weeks starting on Monday", () => {
    const days = monthGridDays(new Date(2026, 8, 15));

    expect(days.length % WEEKDAY_LABELS.length).toBe(0);
    expect(days[0].getDay()).toBe(1);
    expect(days.some((day) => day.getMonth() === 8 && day.getDate() === 1)).toBe(true);
    expect(days.some((day) => day.getMonth() === 8 && day.getDate() === 30)).toBe(true);
  });

  it("keeps the tails of the neighbouring months in the grid", () => {
    // 1 сентября 2026 — вторник, значит понедельник 31 августа обязан быть первой клеткой.
    const days = monthGridDays(new Date(2026, 8, 15));

    expect(days[0].getMonth()).toBe(7);
    expect(days[0].getDate()).toBe(31);
  });
});

describe("monthTitle / dayTitle", () => {
  it("capitalises the month and names the weekday of the day", () => {
    expect(monthTitle(new Date(2026, 8, 1))).toBe("Сентябрь 2026");
    expect(dayTitle(new Date(2026, 8, 8))).toBe("8 сентября · вторник");
  });
});

describe("mergeCalendarEntries", () => {
  const shared = mockSharedCalendar();

  it("marks own bookings and peer records with their own source", () => {
    const rows = mergeCalendarEntries([booking(2, "b1")], [], shared);
    const own = rows.find((row) => row.id === "booking-b1");
    const peer = rows.find((row) => row.sharedId !== null && row.needsResponse);

    expect(own?.sources).toEqual(["own"]);
    expect(peer?.sources).toEqual(["peer"]);
    expect(peer?.note).toContain(mockFriends[0].name.split(" ")[0]);
  });

  it("folds «оба идёте» into one row instead of showing the evening twice", () => {
    const bothGoing = shared.entries.find((row) => row.bothGoing);
    if (bothGoing === undefined || bothGoing.eventId === null) throw new Error("shared fixture must carry a both-going record");
    const ownIndex = mockEvents.findIndex((event) => event.id === bothGoing.eventId);
    const rows = mergeCalendarEntries([booking(ownIndex, "b1")], [], shared);

    expect(rows.filter((row) => row.eventId === bothGoing.eventId)).toHaveLength(1);
    expect(rows.find((row) => row.eventId === bothGoing.eventId)?.sources).toEqual(["own", "peer"]);
    expect(rows.find((row) => row.eventId === bothGoing.eventId)?.note).toBe("оба идёте");
  });

  it("brings plans in as own records and keeps a way to the plan screen", () => {
    const card = planCards()[1];
    const rows = mergeCalendarEntries([], [card], null);

    expect(rows).toHaveLength(1);
    expect(rows[0].planId).toBe(card.plan.id);
    expect(rows[0].note).toContain("ваш план");
  });

  it("sorts everything by the time it starts", () => {
    const rows = mergeCalendarEntries([booking(2, "b1"), booking(4, "b2")], [], shared);

    expect(rows.map((row) => row.startsAt)).toEqual([...rows.map((row) => row.startsAt)].sort());
  });
});

describe("entriesOn", () => {
  it("keeps only the records of the chosen day", () => {
    const rows = [entry({ id: "a", startsAt: "2026-09-18T19:00:00+03:00" }), entry({ id: "b", startsAt: "2026-09-19T19:00:00+03:00" })];

    expect(entriesOn(rows, new Date(2026, 8, 18)).map((row) => row.id)).toEqual(["a"]);
  });
});

describe("entryEndMs", () => {
  it("gives a record without an end the two hours most events take", () => {
    expect(entryEndMs({ startsAt: "2026-09-18T19:00:00+03:00", endsAt: null })).toBe(Date.parse("2026-09-18T21:00:00+03:00"));
    expect(entryEndMs({ startsAt: "2026-09-18T19:00:00+03:00", endsAt: "2026-09-18T23:00:00+03:00" })).toBe(Date.parse("2026-09-18T23:00:00+03:00"));
  });
});

describe("overlapWarnings", () => {
  it("names the pair that runs into each other", () => {
    const warnings = overlapWarnings([entry({ id: "a", title: "Выставка", startsAt: "2026-09-19T12:00:00+03:00", endsAt: "2026-09-19T21:00:00+03:00" }), entry({ id: "b", title: "Концерт", startsAt: "2026-09-19T19:00:00+03:00" })]);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("Выставка");
    expect(warnings[0]).toContain("Концерт");
  });

  it("says nothing when one ends before the other starts", () => {
    expect(overlapWarnings([entry({ id: "a", startsAt: "2026-09-19T12:00:00+03:00", endsAt: "2026-09-19T14:00:00+03:00" }), entry({ id: "b", startsAt: "2026-09-19T19:00:00+03:00" })])).toEqual([]);
  });

  it("reports a pair once, not once per ordering", () => {
    const rows = [entry({ id: "a", startsAt: "2026-09-19T19:00:00+03:00" }), entry({ id: "b", startsAt: "2026-09-19T19:30:00+03:00" }), entry({ id: "c", startsAt: "2026-09-19T20:00:00+03:00" })];

    expect(overlapWarnings(rows)).toHaveLength(3);
  });
});

describe("calendarReminder", () => {
  const now = new Date("2026-09-18T12:00:00+03:00");

  it("counts the hours to the nearest record of the next day", () => {
    const reminder = calendarReminder([entry({ id: "a", title: "Кинопоказ", startsAt: "2026-09-18T21:00:00+03:00" })], now);

    expect(reminder).toContain("Кинопоказ");
    expect(reminder).toContain("Через 9 часов");
  });

  it("says «скоро» rather than «через 1 час» for what starts within the hour", () => {
    expect(calendarReminder([entry({ id: "a", title: "Лекция", startsAt: "2026-09-18T12:30:00+03:00" })], now)).toContain("Скоро");
  });

  it("stays silent about what has passed and about what is further than a day away", () => {
    expect(calendarReminder([entry({ id: "a", startsAt: "2026-09-18T09:00:00+03:00" })], now)).toBeNull();
    expect(calendarReminder([entry({ id: "a", startsAt: "2026-09-25T19:00:00+03:00" })], now)).toBeNull();
  });
});
