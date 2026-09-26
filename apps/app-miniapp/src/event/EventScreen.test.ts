import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { EventCompanions, EventDetails, EventForecast, EventMoodTag, EventNearbySpot } from "../api/client";
import { mockEvents, mockPlaces } from "../api/mock";
import { EventForecastCard, EventHero, EventMoodTags, EventNearbyList, EventOrganizerCard, EventRouteCard, EventWhenRow, EventWhoGoesRow } from "./EventScreen";

// Локальное время без смещения: «14:00» обязано читаться одинаково в любой зоне прогона.
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

const noop = () => {};

describe("EventHero", () => {
  it("draws the title, the category with the venue and the seat counter", () => {
    const html = renderToStaticMarkup(createElement(EventHero, { details: detailsOf(), saveOpen: false, onBack: noop, onShare: noop, onSave: noop }));

    expect(html).toContain("Мангальная зона в парке Горького");
    expect(html).toContain("Парк Горького");
    expect(html).toContain("Занято 16 мест из 20");
    expect(html).toContain('aria-label="Назад"');
  });

  it("drops the counter for an event without a capacity", () => {
    const html = renderToStaticMarkup(createElement(EventHero, { details: detailsOf({ event: { ...mockEvents[2], capacity: null }, remainingSeats: null }), saveOpen: false, onBack: noop, onShare: noop, onSave: noop }));

    expect(html).not.toContain("app-ev-hero-seats");
  });
});

describe("EventWhenRow", () => {
  it("shows the date tile, the weekday line, the range and the price", () => {
    const html = renderToStaticMarkup(createElement(EventWhenRow, { event: { startsAt: STARTS_AT, endsAt: ENDS_AT, isPaid: false, priceRub: null } }));

    expect(html).toContain("СЕН");
    expect(html).toContain("Суббота, 19 сентября");
    expect(html).toContain("14:00 – 18:00");
    expect(html).toContain("Бесплатно");
  });
});

describe("EventForecastCard", () => {
  const forecast: EventForecast = {
    source: "Open-Meteo",
    hours: [
      { at: "2026-09-19T14:00:00", temperatureC: 23, conditionCode: 0, condition: "ясно", withinEvent: true },
      { at: "2026-09-19T20:00:00", temperatureC: 16, conditionCode: 61, condition: "дождь", withinEvent: false },
    ],
    note: "Дождь после 19:00, вероятность 70%",
  };

  it("credits the provider from the payload and dims the hours past the end", () => {
    const html = renderToStaticMarkup(createElement(EventForecastCard, { forecast }));

    expect(html).toContain("Open-Meteo");
    expect(html).toContain("+23°");
    expect(html).toContain("app-ev-weather-hour--after");
    expect(html).toContain("Дождь после 19:00");
  });

  it("renders nothing without a single hour to show", () => {
    expect(renderToStaticMarkup(createElement(EventForecastCard, { forecast: { source: "Open-Meteo", hours: [], note: null } }))).toBe("");
  });
});

describe("EventRouteCard", () => {
  it("prints the address with its landmark and the walking estimate", () => {
    const html = renderToStaticMarkup(createElement(EventRouteCard, { address: "Крымский Вал, 9", hint: "Парк Горького", travel: { mode: "walk", minutes: 18, distanceKm: 2.1, transfers: null }, onRoute: noop }));

    expect(html).toContain("Крымский Вал, 9 · Парк Горького");
    expect(html).toContain("2,1 км · 18 мин пешком");
    expect(html).toContain("Проложить маршрут");
  });
});

describe("EventOrganizerCard", () => {
  it("shows the four rating numbers and how many reviews back them", () => {
    const rating = { organizerUserId: "d0000001-0000-4000-8000-000000000001", averageStars: 4.7, recommendPercent: 92, visitsCount: 87, onTimePercent: 96, reviewsCount: 214, attendancePercent: null, eventsCount: 34 };
    const html = renderToStaticMarkup(createElement(EventOrganizerCard, { name: "Парк Горького", eventsCount: 34, rating, subscribe: null }));

    expect(html).toContain("ПГ");
    expect(html).toContain("Организатор · 34 события в афише");
    expect(html).toContain("4,7");
    expect(html).toContain("92%");
    expect(html).toContain("96%");
    expect(html).toContain("По 214 отзывам участников");
  });

  it("explains the missing rating instead of printing zeros", () => {
    const html = renderToStaticMarkup(createElement(EventOrganizerCard, { name: "Парк Горького", eventsCount: null, rating: null, subscribe: null }));

    expect(html).toContain("Рейтинга пока нет");
    expect(html).toContain("с третьего отзыва");
    expect(html).not.toContain("0%");
  });
});

describe("EventMoodTags, EventNearbyList and EventWhoGoesRow", () => {
  const companions: EventCompanions = {
    counts: { going: 16, wants: 7, looking: 3 },
    myStatus: null,
    companions: [
      { friend: { id: "a1", name: "Анна Соколова", avatarUrl: null }, status: "going", chatTitle: "Двор", sharedPlansCount: 5, matchesCount: 3, interests: [], note: null },
      { friend: { id: "a2", name: "Дима Кузнецов", avatarUrl: null }, status: "looking_for_company", chatTitle: null, sharedPlansCount: 0, matchesCount: 1, interests: [], note: null },
    ],
    gathering: null,
  };

  it("counts everyone going and fills the stack from the friends who are", () => {
    const html = renderToStaticMarkup(createElement(EventWhoGoesRow, { companions, onOpen: noop }));
    expect(html).toContain("Кто идёт");
    expect(html).toContain("16");
    expect(html).toContain("+15");
    expect(html).toContain("Анна Соколова");
    expect(html).not.toContain("Дима");
  });

  it("renders every tag with its counter", () => {
    const tags: EventMoodTag[] = [
      { code: "calm", label: "Спокойно", count: 12 },
      { code: "kids_ok", label: "С детьми ок", count: 9 },
    ];
    const html = renderToStaticMarkup(createElement(EventMoodTags, { tags }));

    expect(html).toContain("Обстановка");
    expect(html).toContain("Спокойно · 12");
    expect(html).toContain("С детьми ок · 9");
  });

  it("hides both blocks when there is nothing to list", () => {
    expect(renderToStaticMarkup(createElement(EventMoodTags, { tags: [] }))).toBe("");
    expect(renderToStaticMarkup(createElement(EventNearbyList, { spots: [], onOpen: noop }))).toBe("");
  });

  it("puts the distance next to every nearby venue", () => {
    const spots: EventNearbySpot[] = [{ id: mockPlaces[4].id, title: "Фудкорт «Веранда»", distanceM: 240, category: "food" }];
    const html = renderToStaticMarkup(createElement(EventNearbyList, { spots, onOpen: noop }));

    expect(html).toContain("Рядом");
    expect(html).toContain("Фудкорт «Веранда»");
    expect(html).toContain("240 м");
  });
});
