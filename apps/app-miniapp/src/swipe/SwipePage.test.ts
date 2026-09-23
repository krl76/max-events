import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { swipeCandidates } from "../api/mock";
import { formatSwipeDistance, formatSwipePrice, formatSwipeRating, SWIPE_COMMIT_PX, SwipeCard, SwipeView, swipeFriendsLine, swipeMatchLine, swipeOutcome, type SwipeState } from "./SwipePage";

const noop = () => {};
const DECK = swipeCandidates("all", { latitude: 55.7522, longitude: 37.6156 });
const READY: SwipeState = { status: "ready", candidates: DECK };

describe("swipeOutcome", () => {
  it("saves to the right, passes to the left and decides nothing in between", () => {
    expect(swipeOutcome(SWIPE_COMMIT_PX)).toBe("like");
    expect(swipeOutcome(-SWIPE_COMMIT_PX)).toBe("skip");
    expect(swipeOutcome(0)).toBeNull();
    expect(swipeOutcome(SWIPE_COMMIT_PX - 1)).toBeNull();
    expect(swipeOutcome(1 - SWIPE_COMMIT_PX)).toBeNull();
  });
});

describe("swipe card formatting", () => {
  it("prints the distance, the rating with its review count and the hourly price", () => {
    expect(formatSwipeDistance(2.4)).toBe("2,4 км");
    expect(formatSwipeDistance(null)).toBeNull();
    expect(formatSwipeRating(4.9, 143)).toBe("4.9 · 143 отзыва");
    expect(formatSwipeRating(4.9, 1)).toBe("4.9 · 1 отзыв");
    // Рейтинг без счётчика отзывов — всё ещё ответ; рейтинга нет — строки нет вовсе.
    expect(formatSwipeRating(4.9, null)).toBe("4.9");
    expect(formatSwipeRating(null, 143)).toBeNull();
    expect(formatSwipePrice(800)).toBe("800 ₽/час");
    expect(formatSwipePrice(null)).toBeNull();
  });

  it("names up to two friends and counts the rest, and scores the match only when there is one", () => {
    const friends = [
      { id: "1", name: "Анна Соколова", avatarUrl: null },
      { id: "2", name: "Дима Кузнецов", avatarUrl: null },
      { id: "3", name: "Катя Орлова", avatarUrl: null },
    ];

    expect(swipeFriendsLine([])).toBeNull();
    expect(swipeFriendsLine(friends.slice(0, 1))).toBe("Были здесь: Анна");
    expect(swipeFriendsLine(friends.slice(0, 2))).toBe("Анна и Дима были здесь");
    expect(swipeFriendsLine(friends)).toBe("Анна, Дима и ещё 1 были здесь");
    expect(swipeMatchLine(92)).toBe("92% совпадение с тобой");
    expect(swipeMatchLine(null)).toBeNull();
  });
});

describe("SwipeCard", () => {
  const card = (dx: number) => renderToStaticMarkup(createElement(SwipeCard, { candidate: DECK[0], dx, onOpen: noop }));

  it("carries the venue, its facts, the amenities, the friends and the match score", () => {
    const html = card(0);
    const top = DECK[0];

    expect(html).toContain(top.place.title);
    if (top.areaLine !== null) expect(html).toContain(top.areaLine);
    if (top.offerLabel !== null) expect(html).toContain(top.offerLabel);
    for (const amenity of top.amenities) expect(html).toContain(amenity);
    expect(html).toContain(swipeMatchLine(top.matchPercent));
    expect(html).toContain("Подробнее");
  });

  it("stamps the verdict only once the card has travelled past the threshold", () => {
    expect(card(0)).not.toContain("app-swipe-stamp");
    expect(card(SWIPE_COMMIT_PX)).toContain("В ИЗБРАННОЕ");
    expect(card(-SWIPE_COMMIT_PX)).toContain("МИМО");
  });
});

describe("SwipeView", () => {
  const view = (over: { state?: SwipeState; index?: number } = {}) =>
    renderToStaticMarkup(
      createElement(SwipeView, {
        state: over.state ?? READY,
        index: over.index ?? 0,
        dx: 0,
        category: "all",
        onCategory: noop,
        onDecide: noop,
        onUndo: noop,
        onGather: noop,
        onOpen: noop,
        onBack: noop,
        onRetry: noop,
      }),
    );

  it("heads the screen with the swipe instruction and the four category chips", () => {
    const html = view();

    expect(html).toContain("Подбор мест");
    expect(html).toContain("Свайпай: вправо — в избранное, влево — мимо");
    for (const label of ["Все", "Еда", "На природе", "Спорт"]) expect(html).toContain(label);
  });

  it("stacks two shadow cards under the top one, so the deck reads as a deck", () => {
    expect((view().match(/app-swipe-shadow/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("disables undo on the first card and both verdicts once the deck runs out", () => {
    expect((view().match(/disabled=""/g) ?? []).length).toBe(1);
    const spent = view({ index: DECK.length });

    expect(spent).toContain("Места в этой подборке кончились");
    expect((spent.match(/disabled=""/g) ?? []).length).toBe(3);
  });

  it("renders the loading and error states of the deck", () => {
    expect(view({ state: { status: "loading" } })).toContain("app-skeleton-block");
    const failed = view({ state: { status: "error" } });
    expect(failed).toContain("app-state--error");
    expect(failed).toContain("Не удалось загрузить подборку мест");
  });
});
