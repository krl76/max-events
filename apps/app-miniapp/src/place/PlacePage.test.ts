import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { friendVisitLabel, peopleLabel, PlacePageView, visitsLabel } from "./PlacePage";
import type { Place } from "@max-events/api-contracts";
import type { PlacePage as PlacePageAggregate } from "@max-events/api-contracts";
import { mockPlaces } from "../api/mock";

const park = mockPlaces[0];

function page(overrides: Partial<PlacePageAggregate> = {}): PlacePageAggregate {
  return {
    placeId: park.id,
    todayEvents: [],
    friends: [],
    rating: null,
    popularityToday: 0,
    personalVisitsCount: 0,
    ...overrides,
  };
}

function viewHtml(payload: PlacePageAggregate, place: Place = park): string {
  return renderToStaticMarkup(createElement(PlacePageView, { place, page: payload, onOpenEvent: () => {} }));
}

describe("visitsLabel", () => {
  it("picks the right russian plural form", () => {
    expect(visitsLabel(1)).toBe("1 раз");
    expect(visitsLabel(3)).toBe("3 раза");
    expect(visitsLabel(5)).toBe("5 раз");
    expect(visitsLabel(11)).toBe("11 раз");
    expect(visitsLabel(21)).toBe("21 раз");
    expect(visitsLabel(0)).toBe("0 раз");
  });
});

describe("peopleLabel", () => {
  it("picks the right russian plural form", () => {
    expect(peopleLabel(1)).toBe("1 человек");
    expect(peopleLabel(21)).toBe("21 человек");
    expect(peopleLabel(3)).toBe("3 человека");
    expect(peopleLabel(482)).toBe("482 человека");
    expect(peopleLabel(11)).toBe("11 человек");
  });
});

describe("friendVisitLabel", () => {
  it("describes past visits and going today", () => {
    expect(friendVisitLabel({ friend: { id: "f1", name: "Анна Соколова", avatarUrl: null }, visitsCount: 3, goingToday: false })).toBe("Анна была здесь 3 раза");
    expect(friendVisitLabel({ friend: { id: "f2", name: "Дима Кузнецов", avatarUrl: null }, visitsCount: 1, goingToday: false })).toBe("Дима был здесь 1 раз");
    expect(friendVisitLabel({ friend: { id: "f3", name: "Дима Кузнецов", avatarUrl: null }, visitsCount: 0, goingToday: true })).toBe("Дима идёт сегодня");
  });
});

describe("PlacePageView", () => {
  it("renders all five social blocks with data", () => {
    const html = viewHtml(
      page({
        todayEvents: [{ id: "c0000001-0000-4000-8000-000000000001", title: "Летний концерт", description: "", category: "afisha", city: "Москва", placeId: park.id, startsAt: "2026-09-12T19:00:00+03:00", endsAt: null, isPaid: false, priceRub: null, paymentUrl: null, capacity: 200, chatLink: null, promoted: false }],
        friends: [{ friend: { id: "f1", name: "Анна Соколова", avatarUrl: null }, visitsCount: 3, goingToday: false }],
        rating: { summary: { eventId: null, placeId: park.id, averageStars: 4.5, reviewsCount: 2 }, categoryAverages: { atmosphere: 4.5, organization: null, price: null, place: 4.5 } },
        popularityToday: 482,
        personalVisitsCount: 6,
      }),
    );

    expect(html).toContain("События сегодня");
    expect(html).toContain("Летний концерт");
    expect(html).toContain("Друзья");
    expect(html).toContain("Анна была здесь 3 раза");
    expect(html).toContain("Оценки людей");
    expect(html).toContain("4.5 ⭐ (2 отзыва)");
    expect(html).toContain("482 человека были здесь сегодня");
    expect(html).toContain("Личная история");
    expect(html).toContain("Ты был здесь 6 раз");
  });

  it("renders per-block empty states instead of a page error", () => {
    const html = viewHtml(page());

    expect(html).toContain("На сегодня событий нет.");
    expect(html).toContain("Друзья пока не отмечались здесь.");
    expect(html).toContain("Оценок пока нет.");
    expect(html).toContain("Сегодня здесь пока никого не было");
    expect(html).toContain("Ты пока не был здесь");
  });

  it("renders the place title and address", () => {
    const html = viewHtml(page());

    expect(html).toContain(park.title);
    expect(html).toContain(park.address);
  });
});
