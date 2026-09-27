import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PlacePage as PlacePageAggregate } from "@max-events/api-contracts";
import type { PlaceBoard, PlaceUpcomingEvent } from "../api/client";
import { mockPlaces } from "../api/mock";
import { pluralRu } from "../catalog/format";
import { friendVisitLabel, occupancyAxis, occupancyLabel, placeKindLabel, placeRatingLabel, placeRatingValue, PlacePageView, slotPriceLine, upcomingLine, visitMonthLabel } from "./PlacePage";

const park = mockPlaces[0];

function page(overrides: Partial<PlacePageAggregate> = {}): PlacePageAggregate {
  return { placeId: park.id, todayEvents: [], friends: [], rating: null, popularityToday: 0, personalVisitsCount: 0, ...overrides };
}

function board(overrides: Partial<PlaceBoard> = {}): PlaceBoard {
  return {
    placeId: park.id,
    openUntil: "23:00",
    checkedInToday: false,
    weekEventsCount: 6,
    occupancy: [
      { hour: 10, load: 0.2 },
      { hour: 13, load: 0.5 },
      { hour: 16, load: 0.4 },
      { hour: 19, load: 1 },
      { hour: 22, load: 0.3 },
    ],
    occupancyNowHour: 16,
    visitMonths: [],
    visitMonthsMore: 0,
    unitTitle: "Мангальная зона у пруда",
    pricePerHourRub: 800,
    cancelBefore: "2026-09-19T12:00:00+03:00",
    slots: [],
    upcoming: [],
    ...overrides,
  };
}

const upcoming = (overrides: Partial<PlaceUpcomingEvent> = {}): PlaceUpcomingEvent => ({
  event: { id: "c0000001-0000-4000-8000-000000000001", title: "Мангальная зона", description: "", coverUrl: null, category: "afisha", city: "Москва", placeId: park.id, startsAt: "2026-09-19T14:00:00+03:00", endsAt: null, isPaid: false, priceRub: null, paymentUrl: null, capacity: 40, chatLink: null, promoted: false, published: true, bookingOpensAt: null, weather: null },
  friends: [],
  friendsCount: 0,
  goingCount: 11,
  joined: false,
  ...overrides,
});

/** ru-RU groups thousands with a no-break space; the assertions read better with a plain one. */
function viewHtml(payload: PlacePageAggregate = page(), extra: Partial<PlaceBoard> = {}, checkedIn = false): string {
  return renderToStaticMarkup(createElement(PlacePageView, { place: park, page: payload, board: board(extra), checkedIn, onBack: () => {}, onCheckIn: () => {}, onOpenEvent: () => {}, onOpenSlots: () => {}, onOpenSubscriptions: () => {}, onCreateHere: () => {}, onSave: () => {} })).replaceAll("\u00a0", " ");
}

describe("ru visits label", () => {
  it("picks the right russian plural form", () => {
    expect(`1 ${pluralRu(1, "раз", "раза", "раз")}`).toBe("1 раз");
    expect(`3 ${pluralRu(3, "раз", "раза", "раз")}`).toBe("3 раза");
    expect(`5 ${pluralRu(5, "раз", "раза", "раз")}`).toBe("5 раз");
    expect(`11 ${pluralRu(11, "раз", "раза", "раз")}`).toBe("11 раз");
  });
});

describe("friendVisitLabel", () => {
  it("describes past visits and going today", () => {
    expect(friendVisitLabel({ friend: { id: "f1", name: "Анна Соколова", avatarUrl: null }, visitsCount: 3, goingToday: false })).toBe("Анна была здесь 3 раза");
    expect(friendVisitLabel({ friend: { id: "f2", name: "Дима Кузнецов", avatarUrl: null }, visitsCount: 1, goingToday: false })).toBe("Дима был здесь 1 раз");
    expect(friendVisitLabel({ friend: { id: "f3", name: "Дима Кузнецов", avatarUrl: null }, visitsCount: 0, goingToday: true })).toBe("Дима идёт сегодня");
  });
});

describe("placeKindLabel", () => {
  it("joins the venue kind with its closing time, and drops the time when there is none", () => {
    expect(placeKindLabel(park, "23:00")).toBe("Парк · открыт до 23:00");
    expect(placeKindLabel(park, null)).toBe("Парк");
  });
});

describe("occupancy", () => {
  it("reads the bar of the current hour, not the busiest one", () => {
    expect(occupancyLabel(board({ occupancyNowHour: 10 }))).toBe("Сейчас свободно");
    expect(occupancyLabel(board({ occupancyNowHour: 13 }))).toBe("Сейчас оживлённо");
    expect(occupancyLabel(board({ occupancyNowHour: 19 }))).toBe("Сейчас людно");
  });

  it("says nothing at an hour the venue does not publish", () => {
    expect(occupancyLabel(board({ occupancyNowHour: 4 }))).toBeNull();
    expect(occupancyLabel(board({ occupancy: [], occupancyNowHour: 16 }))).toBeNull();
  });

  it("spreads five marks over the published hours, first and last included", () => {
    const hours = Array.from({ length: 10 }, (_, index) => ({ hour: 10 + index, load: 0.5 }));

    expect(occupancyAxis({ occupancy: hours })).toEqual([10, 12, 15, 17, 19]);
    expect(occupancyAxis({ occupancy: [] })).toEqual([]);
  });
});

describe("visitMonthLabel", () => {
  it("shortens the month the way the grid prints it", () => {
    expect(visitMonthLabel("2026-05")).toBe("май");
    expect(visitMonthLabel("2026-06")).toBe("июн");
  });
});

describe("slotPriceLine", () => {
  it("joins the hourly rate with the cancellation deadline and survives either half missing", () => {
    expect(slotPriceLine({ pricePerHourRub: 800, cancelBefore: "2026-09-19T12:00:00+03:00" })).toBe("800 ₽/час · бесплатная отмена до 12:00");
    expect(slotPriceLine({ pricePerHourRub: null, cancelBefore: "2026-09-19T12:00:00+03:00" })).toBe("бесплатная отмена до 12:00");
    expect(slotPriceLine({ pricePerHourRub: null, cancelBefore: null })).toBeNull();
  });
});

describe("upcomingLine", () => {
  it("names the friends going and counts the rest", () => {
    expect(
      upcomingLine(
        upcoming({
          friends: [
            { id: "f1", name: "Анна Соколова", avatarUrl: null },
            { id: "f2", name: "Дима Кузнецов", avatarUrl: null },
          ],
          friendsCount: 7,
          joined: true,
        }),
      ),
    ).toBe("Анна, Дима и ещё 5 · ты записан");
  });

  it("falls back to the counter when no friend is going", () => {
    expect(upcomingLine(upcoming())).toBe("11 из 40 · бесплатно");
  });

  it("prints the price of a paid event nobody the viewer knows is going to", () => {
    expect(upcomingLine(upcoming({ event: { ...upcoming().event, isPaid: true, priceRub: 700, capacity: null } }))).toBe("11 человек · 700 ₽");
  });
});

describe("PlacePageView", () => {
  it("renders the hero, the counters and every block of the design", () => {
    const html = viewHtml(
      page({
        friends: [{ friend: { id: "f1", name: "Анна Соколова", avatarUrl: null }, visitsCount: 3, goingToday: false }],
        rating: { summary: { eventId: null, placeId: park.id, averageStars: 4.8, reviewsCount: 1240 }, categoryAverages: { atmosphere: 4.8, organization: null, price: null, place: 4.8 } },
        popularityToday: 12,
        personalVisitsCount: 12,
      }),
      {
        visitMonths: [{ month: "2026-05", visitsCount: 3 }],
        visitMonthsMore: 9,
        slots: [{ id: "f0000001-0000-4000-8000-202609190000", placeId: park.id, startsAt: "2026-09-19T14:00:00+03:00", endsAt: "2026-09-19T17:00:00+03:00", capacity: 12, takenSeats: 0, priceRub: 2400, status: "free", busyUntil: null, weather: null }],
        upcoming: [upcoming()],
      },
    );

    expect(html).toContain("Парк · открыт до 23:00");
    expect(html).toContain(park.title);
    expect(html).toContain("Я здесь");
    expect(html).toContain("4,8");
    expect(html).toContain("1 240 оценок");
    expect(html).toContain("твоих визитов");
    expect(html).toContain("Друзья здесь бывали");
    expect(html).toContain("Анна была здесь 3 раза");
    expect(html).toContain("Когда людно");
    expect(html).toContain("Твоя история здесь");
    expect(html).toContain("май");
    expect(html).toContain("+9");
    expect(html).toContain("Доступные слоты бронирования");
    expect(html).toContain("14:00 – 17:00");
    expect(html).toContain("800 ₽/час · бесплатная отмена до 12:00");
    expect(html).toContain("Здесь скоро");
    expect(html).toContain("Собрать план здесь");
  });

  it("renders per-block empty states instead of a page error", () => {
    const html = viewHtml();

    expect(html).toContain("Друзья пока не отмечались здесь.");
    expect(html).toContain("Ты ещё не отмечался здесь");
    expect(html).not.toContain("твоих визитов");
    expect(viewHtml(page(), { weekEventsCount: 0 })).not.toContain("на неделе");
    expect(html).toContain("Свободных окон сейчас нет.");
    expect(html).toContain("Пока здесь ничего не запланировано.");
    expect(html).toContain("оценок пока нет");
  });

  it("does not print 0,0 when a summary exists but nobody has reviewed the place", () => {
    expect(placeRatingValue({ averageStars: 0, reviewsCount: 0 })).toBe("—");
    expect(placeRatingLabel({ reviewsCount: 0 })).toBe("оценок пока нет");
    expect(placeRatingValue({ averageStars: 4.8, reviewsCount: 1240 })).toBe("4,8");
    expect(placeRatingLabel({ reviewsCount: 1240 }).replaceAll("\u00a0", " ")).toBe("1 240 оценок");
  });

  it("marks the day as spent once the viewer has checked in", () => {
    expect(viewHtml()).not.toContain("Сегодня уже отмечен");
    expect(viewHtml(page(), {}, true)).toContain("Сегодня уже отмечен");
    expect(viewHtml(page(), { checkedInToday: true })).toContain("Сегодня уже отмечен");
  });

  it("hides the slot block entirely at a venue that rents nothing", () => {
    expect(viewHtml(page(), { unitTitle: null })).not.toContain("Доступные слоты бронирования");
  });
});
