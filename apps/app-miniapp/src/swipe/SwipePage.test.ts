import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { swipeCandidates } from "../api/mock";
import { formatSwipeDistance, formatSwipePrice, formatSwipeRating, SWIPE_COMMIT_PX, SwipeCard, SwipeView, swipeFriendsLine, swipeMatchLine, swipeOutcome, swipeProgress, type SwipeLeaving, type SwipeState } from "./SwipePage";

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

describe("swipeProgress", () => {
  it("rests at zero, follows the direction of the drag and never leaves [-1, 1]", () => {
    expect(swipeProgress(0)).toBe(0);
    expect(swipeProgress(SWIPE_COMMIT_PX / 2)).toBe(0.5);
    expect(swipeProgress(SWIPE_COMMIT_PX * 4)).toBe(1);
    expect(swipeProgress(-SWIPE_COMMIT_PX * 4)).toBe(-1);
    for (let dx = -400; dx <= 400; dx += 7) {
      const progress = swipeProgress(dx);
      expect(Math.abs(progress)).toBeLessThanOrEqual(1);
      expect(Math.sign(progress)).toBe(Math.sign(dx));
    }
  });

  it("saturates exactly where the verdict lands, so the tint and the stamp agree", () => {
    for (let dx = -300; dx <= 300; dx += 5) {
      expect(Math.abs(swipeProgress(dx)) === 1).toBe(swipeOutcome(dx) !== null);
    }
  });
});

describe("swipe card formatting", () => {
  it("prints the distance, the rating with its review count and the hourly price", () => {
    expect(formatSwipeDistance(2.4)).toBe("2,4 км");
    expect(formatSwipeDistance(888.1)).toBe("далеко");
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
    expect(card(SWIPE_COMMIT_PX)).toContain("В избранное");
    expect(card(-SWIPE_COMMIT_PX)).toContain("Мимо");
  });

  it("follows the finger, and takes the return transition only after a released half-swipe", () => {
    expect(card(40)).toContain("translateX(40px)");
    expect(card(40)).not.toContain("app-swipe-card--settling");
    expect(renderToStaticMarkup(createElement(SwipeCard, { candidate: DECK[0], dx: 0, settling: true, onOpen: noop }))).toContain("app-swipe-card--settling");
  });

  it("hands the verdict progress to the tint as a CSS variable", () => {
    expect(card(SWIPE_COMMIT_PX / 2)).toContain("--app-swipe-progress:0.5");
    expect(card(-SWIPE_COMMIT_PX * 3)).toContain("--app-swipe-progress:-1");
    expect(card(0)).toContain("--app-swipe-progress:0");
    expect(card(0)).not.toContain("app-swipe-card--fly-");
  });

  it("flies out towards its verdict and carries the stamp even when a button or a flick decided it", () => {
    const like = renderToStaticMarkup(createElement(SwipeCard, { candidate: DECK[0], dx: 0, leaving: "like", onOpen: noop }));
    expect(like).toContain("app-swipe-card--fly-like");
    expect(like).not.toContain("app-swipe-card--fly-skip");
    expect(like).toContain("В избранное");
    expect(like).toContain("--app-swipe-progress:1");

    const skip = renderToStaticMarkup(createElement(SwipeCard, { candidate: DECK[0], dx: 12, leaving: "skip", onOpen: noop }));
    expect(skip).toContain("app-swipe-card--fly-skip");
    expect(skip).toContain("Мимо");
    expect(skip).toContain("--app-swipe-progress:-1");
    // It flies from where it was released, not from the centre
    expect(skip).toContain("translateX(12px)");
  });
});

describe("SwipeView", () => {
  const view = (over: { state?: SwipeState; index?: number; leaving?: SwipeLeaving } = {}) =>
    renderToStaticMarkup(
      createElement(SwipeView, {
        state: over.state ?? READY,
        index: over.index ?? 0,
        leaving: over.leaving ?? null,
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
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain("На природе");
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

  it("keeps the decided card flying over the next one until its fly-out ends", () => {
    const leaving = view({ index: 1, leaving: { candidate: DECK[0], decision: "like", dx: SWIPE_COMMIT_PX } });

    expect((leaving.match(/class="app-swipe-card[" ]/g) ?? []).length).toBe(2);
    expect(leaving).toContain("app-swipe-deck--leaving");
    expect(leaving).toContain("app-swipe-card--fly-like");
    expect(leaving).toContain(DECK[0].place.title);
    expect(leaving).toContain(DECK[1].place.title);

    const settled = view({ index: 1 });
    expect((settled.match(/class="app-swipe-card[" ]/g) ?? []).length).toBe(1);
    expect(settled).not.toContain("app-swipe-deck--leaving");
  });

  it("lets the last card fly off over the empty state instead of vanishing", () => {
    const html = view({ index: DECK.length, leaving: { candidate: DECK[DECK.length - 1], decision: "skip", dx: -SWIPE_COMMIT_PX } });

    expect(html).toContain("Места в этой подборке кончились");
    expect(html).toContain("app-swipe-card--fly-skip");
  });
});
