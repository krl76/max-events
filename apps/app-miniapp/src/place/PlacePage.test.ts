import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { friendVisitLabel, PlacePageView } from "./PlacePage";
import { pluralRu } from "../catalog/format";
import type { Place } from "@max-events/api-contracts";
import type { PlacePage as PlacePageAggregate } from "@max-events/api-contracts";
import { mockPlaces } from "../api/mock";

const park = mockPlaces[0];
const DEMO_USER_ID = "a0000000-0000-4000-8000-000000000001";

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
  return renderToStaticMarkup(createElement(PlacePageView, { place, page: payload, userId: DEMO_USER_ID, checkedIn: false, onCheckIn: () => {}, onOpenEvent: () => {} }));
}

describe("ru visits label", () => {
  it("picks the right russian plural form", () => {
    expect(`1 ${pluralRu(1, "раз", "раза", "раз")}`).toBe("1 раз");
    expect(`3 ${pluralRu(3, "раз", "раза", "раз")}`).toBe("3 раза");
    expect(`5 ${pluralRu(5, "раз", "раза", "раз")}`).toBe("5 раз");
    expect(`11 ${pluralRu(11, "раз", "раза", "раз")}`).toBe("11 раз");
    expect(`21 ${pluralRu(21, "раз", "раза", "раз")}`).toBe("21 раз");
    expect(`0 ${pluralRu(0, "раз", "раза", "раз")}`).toBe("0 раз");
  });
});

describe("ru people label", () => {
  it("picks the right russian plural form", () => {
    expect(`1 ${pluralRu(1, "человек", "человека", "человек")}`).toBe("1 человек");
    expect(`21 ${pluralRu(21, "человек", "человека", "человек")}`).toBe("21 человек");
    expect(`3 ${pluralRu(3, "человек", "человека", "человек")}`).toBe("3 человека");
    expect(`482 ${pluralRu(482, "человек", "человека", "человек")}`).toBe("482 человека");
    expect(`11 ${pluralRu(11, "человек", "человека", "человек")}`).toBe("11 человек");
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
        todayEvents: [{ id: "c0000001-0000-4000-8000-000000000001", title: "Летний концерт", description: "", category: "afisha", city: "Москва", placeId: park.id, startsAt: "2026-09-12T19:00:00+03:00", endsAt: null, isPaid: false, priceRub: null, paymentUrl: null, capacity: 200, chatLink: null, promoted: false, published: true, bookingOpensAt: null, weather: null, coverUrl: null }],
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

  it("renders the check-in CTA before the user checks in", () => {
    const html = viewHtml(page());
    expect(html).toContain("Я здесь");
    expect(html).not.toContain("Вы были здесь");
  });

  it("renders «Вы были здесь» once checked in", () => {
    const html = renderToStaticMarkup(createElement(PlacePageView, { place: park, page: page(), userId: DEMO_USER_ID, checkedIn: true, onCheckIn: () => {}, onOpenEvent: () => {} }));
    expect(html).toContain("Вы были здесь");
    expect(html).not.toContain("Я здесь");
  });

  it("renders the report button", () => {
    const html = viewHtml(page());
    expect(html).toContain("Пожаловаться");
  });
});
