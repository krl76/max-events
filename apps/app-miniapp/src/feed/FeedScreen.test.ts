import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { FeedFriendCard, FeedPlaceCard } from "../api/client";
import { mockEvents, mockFriends, mockPlaces } from "../api/mock";
import { FeedFriendPost, FeedPlacePost, FeedSkeletonScreen, FeedWhereToCard } from "./FeedScreen";

const noop = () => {};

// Built from local Date parts rather than ISO literals, so «Сегодня · 20:00» holds in any timezone.
const NOW = new Date(2026, 8, 18, 12, 0, 0);
const at = (day: number, hour: number, minute = 0): string => new Date(2026, 8, day, hour, minute).toISOString();

const friendCard: FeedFriendCard = {
  kind: "friend",
  id: "30000000-0000-4000-8000-000000000001",
  author: mockFriends[0],
  placeTitle: "Клуб «Эссе»",
  distanceKm: 1.2,
  event: { ...mockEvents[1], title: "Джаз-квартет в «Эссе»", startsAt: at(18, 20), isPaid: false, priceRub: null, paymentUrl: null },
  live: true,
  hit: false,
  counts: { wantsToGo: 12, going: 4, waitlist: null, freeSeats: null },
  myStatus: null,
  text: "взяла столик у сцены, места ещё есть",
  likesCount: 9,
  likedByMe: false,
  comments: [{ id: "31000000-0000-4000-8000-000000000001", author: mockFriends[1], text: "буду к девяти" }],
  commentsCount: 3,
  publishedAt: at(18, 11, 35),
};

const placeCard: FeedPlaceCard = {
  kind: "place",
  id: "32000000-0000-4000-8000-000000000101",
  place: mockPlaces[0],
  verified: true,
  distanceKm: 2.4,
  travelMinutes: 15,
  rating: 4.9,
  pricePerHourRub: 800,
  slotLabel: "Свободно сегодня с 14:00",
  offerLabel: "Мангальная зона",
  goingFriends: [mockFriends[0], mockFriends[1]],
  title: "Мангальная зона и тёплая беседка №4 у залива",
  text: "Оборудованная закрытая мангальная территория на берегу.",
  quote: { author: mockFriends[0], text: "Чистый мангал, навес от дождя" },
  likesCount: 318,
  likedByMe: false,
  commentsCount: 32,
  myStatus: "going",
  publishedAt: at(18, 11, 0),
};

describe("FeedWhereToCard", () => {
  it("offers the wizard in one line with one CTA", () => {
    const html = renderToStaticMarkup(createElement(FeedWhereToCard, { onStart: noop }));

    expect(html).toContain("Куда пойдём?");
    expect(html).toContain("Три вопроса — и план на вечер");
    expect(html).toContain("Начать");
  });
});

describe("FeedFriendPost", () => {
  const post = (over: Partial<FeedFriendCard> = {}) => renderToStaticMarkup(createElement(FeedFriendPost, { card: { ...friendCard, ...over }, now: NOW, onOpenEvent: noop, onToggleLike: noop, onToggleGoing: noop, onOpenComments: noop, onShare: noop }));

  it("carries the author, the place with the distance and the event hero", () => {
    const html = post();

    expect(html).toContain("Анна Соколова");
    expect(html).toContain("Клуб «Эссе» · 1,2 км");
    expect(html).toContain("Джаз-квартет в «Эссе»");
    expect(html).toContain("Сегодня · 20:00 · бесплатно");
    // Категория красит hero: цвет семантичен, а не ротируется по позиции.
    expect(html).toContain("app-media--afisha");
  });

  it("shows the live chip only while the event runs and the week badge only on a hit", () => {
    expect(post()).toContain("Сейчас идёт");
    expect(post({ live: false })).not.toContain("Сейчас идёт");
    expect(post()).not.toContain("ХИТ НЕДЕЛИ");
    expect(post({ live: false, hit: true })).toContain("ХИТ НЕДЕЛИ");
  });

  it("turns «Пойду» into the pressed «Иду» once the viewer is going", () => {
    expect(post()).toContain("Пойду");
    const going = post({ myStatus: "going" });
    expect(going).toContain("Иду");
    expect(going).toContain('aria-pressed="true"');
    expect(going).toContain("app-feed-going--on");
  });

  it("prints the counters, the caption, the comments line and the publish time", () => {
    const html = post();

    expect(html).toContain("12 хотят пойти · 4 уже там");
    expect(html).toContain("взяла столик у сцены");
    expect(html).toContain("Дима: буду к девяти · ещё 2 комментария");
    expect(html).toContain("25 минут назад");
  });

  it("drops the counters line instead of printing zeros the backend never measured", () => {
    const html = post({ counts: { wantsToGo: null, going: null, waitlist: null, freeSeats: null } });

    expect(html).not.toContain("app-feed-counts");
  });

  it("shows the author photo and a story ring only when they have a story", () => {
    expect(post()).toContain(`src="${mockFriends[0].avatarUrl}"`);
    expect(post()).not.toContain("app-story-ring--active");
    expect(post()).not.toContain("app-feed-ring-inner");
    const withStory = renderToStaticMarkup(createElement(FeedFriendPost, { card: friendCard, now: NOW, onOpenEvent: noop, onToggleLike: noop, onToggleGoing: noop, onOpenComments: noop, onShare: noop, hasStory: true }));
    expect(withStory).toContain("app-story-ring--active");
  });
});

describe("FeedPlacePost", () => {
  const post = (over: Partial<FeedPlaceCard> = {}) => renderToStaticMarkup(createElement(FeedPlacePost, { card: { ...placeCard, ...over }, now: NOW, onOpenPlace: noop, onOpenPost: noop, onStatus: noop, onSlots: noop, onGather: noop }));

  it("heads the venue with its address, travel time and rating", () => {
    const html = post();

    expect(html).toContain(mockPlaces[0].title);
    expect(html).toContain(mockPlaces[0].address);
    expect(html).toContain("15 минут от тебя (2,4 км)");
    expect(html).toContain("4.9");
    expect(html).toContain("Проверенная площадка");
  });

  it("puts the offer, the free slot, the friends going and the hourly price on the hero", () => {
    const html = post();

    expect(html).toContain("Мангальная зона");
    expect(html).toContain("Свободно сегодня с 14:00");
    expect(html).toContain("Идёт Анна +1");
    expect(html).toContain("800 ₽/час");
  });

  it("quotes the friend who wrote about the venue", () => {
    expect(post()).toContain("Чистый мангал, навес от дождя");
    expect(post({ quote: null })).not.toContain("app-feed-quote");
  });

  it("offers the four venue statuses and presses the one the viewer holds", () => {
    const html = post();

    for (const label of ["Хочу пойти", "Иду", "Ищу компанию", "Ищу попутчика"]) expect(html).toContain(label);
    expect((html.match(/aria-pressed="true"/g) ?? []).length).toBe(1);
    expect((post({ myStatus: null }).match(/aria-pressed="true"/g) ?? []).length).toBe(0);
  });

  it("prices the slot button and keeps it readable without a price", () => {
    expect(post()).toContain("Выбрать слот · 800 ₽/час");
    expect(post({ pricePerHourRub: null })).toContain("Выбрать слот");
    expect(post({ pricePerHourRub: null })).not.toContain("₽/час");
    expect(post()).toContain("Собрать");
  });

  it("signs the post as a venue post with its publish time", () => {
    expect(post()).toContain("Пост площадки · 1 час назад");
  });
});

describe("FeedSkeletonScreen", () => {
  it("draws the stories rail and the posts as one announced loading state", () => {
    const html = renderToStaticMarkup(createElement(FeedSkeletonScreen, { posts: 2, stories: 5 }));

    expect(html).toContain('role="status"');
    expect(html).toContain("Загружаем ленту");
    expect((html.match(/app-feed-skeleton-story/g) ?? []).length).toBe(5);
    expect((html.match(/app-feed-skeleton-hero/g) ?? []).length).toBe(2);
    // The pulse comes from the shared primitive, so the skeleton cannot drift from the 6% → 10% rule.
    expect(html).toContain("app-skeleton-block");
    expect(html).toContain("app-skeleton-line");
  });
});
