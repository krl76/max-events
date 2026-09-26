import { describe, expect, it } from "vitest";
import type { EventDetails } from "../api/client";
import { mockEvents, mockPlaces } from "../api/mock";
import { bookingCtaLabel, forecastGlyph, formatDateBadge, formatDayLine, formatDistance, formatPrice, formatTemperature, formatTimeRange, formatTravel, initials, moodTagLabel, organizerEventsLabel, seatOccupancy } from "./EventScreen";

const STARTS_AT = "2026-09-19T14:00:00";
const ENDS_AT = "2026-09-19T18:00:00";

const detailsOf = (over: Partial<EventDetails> = {}): EventDetails => ({
  event: { ...mockEvents[2], title: "Мангальная зона в парке Горького", startsAt: STARTS_AT, endsAt: ENDS_AT, capacity: 20 },
  place: mockPlaces[0],
  organizer: null,
  organization: null,
  remainingSeats: 4,
  activeBookingId: null,
  checkInId: null,
  organizerEventsCount: 34,
  ...over,
});

describe("date and price formatting of экран 17", () => {
  it("splits the date tile into a three-letter month and the day", () => {
    expect(formatDateBadge(STARTS_AT)).toEqual({ month: "СЕН", day: "19" });
  });

  it("capitalises the weekday line", () => {
    expect(formatDayLine(STARTS_AT)).toBe("Суббота, 19 сентября");
  });

  it("prints a range with an end time and a single time without one", () => {
    expect(formatTimeRange(STARTS_AT, ENDS_AT)).toBe("14:00 – 18:00");
    expect(formatTimeRange(STARTS_AT, null)).toBe("14:00");
  });

  it("says «Бесплатно» for a free event and groups the digits of a paid one", () => {
    expect(formatPrice({ isPaid: false, priceRub: null })).toBe("Бесплатно");
    expect(formatPrice({ isPaid: true, priceRub: 1800 })).toContain("₽");
    expect(formatPrice({ isPaid: true, priceRub: 1800 })).toContain("800");
  });
});

describe("weather strip formatting", () => {
  it("signs positive temperatures and leaves negatives alone", () => {
    expect(formatTemperature(22.6)).toBe("+23°");
    expect(formatTemperature(-4.2)).toBe("-4°");
    expect(formatTemperature(0)).toBe("0°");
  });

  it("maps the WMO bands onto three glyphs", () => {
    expect(forecastGlyph(0)).toBe("sun");
    expect(forecastGlyph(2)).toBe("weather");
    expect(forecastGlyph(61)).toBe("rain");
    expect(forecastGlyph(95)).toBe("rain");
  });
});

describe("distance and travel formatting", () => {
  it("keeps metres below a kilometre and switches to kilometres above it", () => {
    expect(formatDistance(204)).toBe("200 м");
    expect(formatDistance(2140)).toBe("2,1 км");
  });

  it("puts the distance before the time and names the mode", () => {
    expect(formatTravel({ mode: "walk", minutes: 18, distanceKm: 2.1, transfers: null })).toBe("2,1 км · 18 мин пешком");
    expect(formatTravel({ mode: "metro", minutes: 9, distanceKm: null, transfers: 1 })).toBe("9 мин на метро");
  });
});

describe("seatOccupancy and bookingCtaLabel", () => {
  it("derives the taken seats from the capacity and what is left", () => {
    expect(seatOccupancy(detailsOf())).toEqual({ taken: 16, capacity: 20 });
    expect(seatOccupancy(detailsOf({ event: { ...mockEvents[2], capacity: null }, remainingSeats: null }))).toBeNull();
  });

  it("carries the state of the record into the CTA", () => {
    expect(bookingCtaLabel(detailsOf())).toBe("Записаться · осталось 4");
    expect(bookingCtaLabel(detailsOf({ remainingSeats: 0 }))).toBe("Мест нет");
    expect(bookingCtaLabel(detailsOf({ activeBookingId: "e0000000-0000-4000-8000-000000000001" }))).toBe("Вы записаны");
    expect(bookingCtaLabel(detailsOf({ remainingSeats: null, event: { ...mockEvents[2], capacity: null } }))).toBe("Записаться");
  });

  it("names the early-access window instead of offering a press that would be refused", () => {
    const early = detailsOf({ event: { ...mockEvents[2], capacity: 20, bookingOpensAt: "2027-06-01T10:00:00+03:00" } });
    expect(bookingCtaLabel(early, Date.parse("2026-09-19T00:00:00Z"))).toBe("Запись по промокоду");
  });
});

describe("label helpers", () => {
  it("takes two initials and stops there", () => {
    expect(initials("Парк Горького")).toBe("ПГ");
    expect(initials("Депо")).toBe("Д");
  });

  it("joins a mood tag with its counter and declines the event counter", () => {
    expect(moodTagLabel({ code: "calm", label: "Спокойно", count: 12 })).toBe("Спокойно · 12");
    expect(organizerEventsLabel(34)).toBe("34 события в афише");
    expect(organizerEventsLabel(1)).toBe("1 событие в афише");
  });
});
