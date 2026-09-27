import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { todayPicks } from "../api/mock";
import { formatPickDistance, formatPickPrice, formatPickRating, formatTodayDate, formatWalkAway, nearbyStatLabel, pickWhere, TodayAfterMeCard, TodayPicksBlock, TodaySummaryBlock, todayAfterMeCard, todayLabel, todayPickCards, afterMeGoLabel, todaySummaryTitle, type TodayState } from "./TodaySection";

const noop = () => {};
const digest = todayPicks();
const ready: TodayState = { status: "ready", today: digest };
const NOW = new Date(2026, 8, 18, 12, 0, 0);

describe("today formatting", () => {
  it("maps all five typed label kinds to their ru texts", () => {
    expect(todayLabel({ kind: "distance", minutes: 10 })).toBe("10 минут от тебя");
    expect(todayLabel({ kind: "distance", minutes: 1 })).toBe("1 минута от тебя");
    expect(formatWalkAway(11109)).toBe("далеко от тебя");
    expect(formatWalkAway(200)).toBe("16 км от тебя");
    expect(formatWalkAway(20, "center")).toBe("20 минут от центра");
    expect(nearbyStatLabel(2)).toBe("события рядом");
    expect(nearbyStatLabel(2, "center")).toBe("события в городе");
    expect(todaySummaryTitle()).toBe("Сегодня для тебя");
    expect(todaySummaryTitle("center")).toBe("Сегодня в городе");
    expect(afterMeGoLabel()).toBe("Показать места рядом");
    expect(afterMeGoLabel("center")).toBe("Показать места в городе");
    expect(todayLabel({ kind: "friend_attending", friendName: "Анна" })).toBe("Идёт Анна");
    expect(todayLabel({ kind: "free_entry" })).toBe("Свободный вход");
    expect(todayLabel({ kind: "spots_left", count: 12 })).toBe("Осталось 12 мест");
    expect(todayLabel({ kind: "spots_left", count: 1 })).toBe("Осталось 1 место");
    expect(todayLabel({ kind: "after_me", fromCategory: "джаза", afterCount: 4 })).toBe("После джаза ты обычно идёшь дальше");
  });

  it("prints the distance, the price and the rating, and stays silent where the backend has nothing", () => {
    expect(formatPickDistance(2.1)).toBe("2,1 км");
    expect(formatPickDistance(888.7)).toBe("далеко");
    expect(formatPickDistance(null)).toBeNull();
    expect(formatPickPrice({ isPaid: false, priceRub: null })).toBe("Бесплатно");
    expect(formatPickPrice({ isPaid: true, priceRub: 1500 })).toMatch(/^от 1.500 ₽$/);
    expect(formatPickRating(4.8)).toBe("4.8");
    expect(formatPickRating(null)).toBeNull();
    expect(formatTodayDate(NOW)).toBe("18 сентября");
  });

  it("falls back to the city when the event has no venue to name", () => {
    const card = digest.cards[0];
    expect(pickWhere({ ...card, placeTitle: "Парк Горького", distanceKm: 3.8 })).toBe("Парк Горького · 3,8 км");
    expect(pickWhere({ ...card, placeTitle: null, distanceKm: null })).toBe(card.event.city);
  });
});

describe("digest selectors", () => {
  it("pulls the after_me hint out of the cards and leaves the rest to «Для вас»", () => {
    const hint = todayAfterMeCard(digest);

    expect(hint).not.toBeNull();
    expect(hint?.labels.some((label) => label.kind === "after_me")).toBe(true);
    expect(todayPickCards(digest)).toHaveLength(digest.cards.length - 1);
    expect(todayPickCards(digest).some((card) => card.labels.some((label) => label.kind === "after_me"))).toBe(false);
  });

  it("returns no hint when the graph said nothing", () => {
    expect(todayAfterMeCard({ summary: digest.summary, cards: todayPickCards(digest) })).toBeNull();
  });
});

describe("TodaySummaryBlock", () => {
  it("prints the three counters with the date of the digest", () => {
    const html = renderToStaticMarkup(createElement(TodaySummaryBlock, { state: ready, now: NOW }));

    expect(html).toContain("Сегодня для тебя");
    expect(renderToStaticMarkup(createElement(TodaySummaryBlock, { state: ready, now: NOW, distanceFrom: "center" }))).toContain("Сегодня в городе");
    expect(html).toContain("18 сентября");
    expect(html).toContain(`>${digest.summary.nearbyCount}<`);
    expect(html).toContain("рядом");
    expect(html).toContain("тебе");
    expect(html).toContain("с друзьями");
  });

  it("drops empty suitable and friends counters instead of printing zero", () => {
    const html = renderToStaticMarkup(
      createElement(TodaySummaryBlock, {
        state: { status: "ready", today: { ...digest, summary: { nearbyCount: 2, suitableCount: 0, withFriendsCount: 0 } } },
        now: NOW,
      }),
    );

    expect(html).toContain(">2<");
    expect(html).toContain("рядом");
    expect(html).toContain("Под интересы и с друзьями пока ничего");
    expect(html).not.toContain(">0<");
    expect(html).not.toContain("app-today-stat--friends");
    expect(html).not.toContain("подходит");
  });

  it("shows skeleton tiles rather than zeros while the digest loads", () => {
    const html = renderToStaticMarkup(createElement(TodaySummaryBlock, { state: { status: "loading" }, now: NOW }));

    expect(html).toContain("app-skeleton-line");
    expect(html).not.toContain("app-today-stat-value");
  });
});

describe("TodayPicksBlock", () => {
  const block = (state: TodayState) => renderToStaticMarkup(createElement(TodayPicksBlock, { state, onOpen: noop, onRetry: noop }));

  it("renders the hero with its labels and the grid under it", () => {
    const html = block(ready);
    const cards = todayPickCards(digest);

    expect(html).toContain("Для вас");
    expect(html).toContain("app-pick--hero");
    expect(html).toContain(cards[0].event.title);
    for (const label of cards[0].labels) expect(html).toContain(todayLabel(label));
    expect((html.match(/app-pick /g) ?? []).length + (html.match(/app-pick app-media/g) ?? []).length).toBeGreaterThan(0);
    expect(html).toContain("Подробнее");
    expect(html).toContain("app-picks-grid");
  });

  it("carries the labels only on the hero, so the grid stays a two-line card", () => {
    const html = block(ready);
    expect((html.match(/app-pick-labels/g) ?? []).length).toBe(1);
  });

  it("renders the empty and error states instead of a bare heading", () => {
    expect(block({ status: "ready", today: { summary: digest.summary, cards: [] } })).toContain("На сегодня пока ничего нет");
    const failed = block({ status: "error" });
    expect(failed).toContain("app-state--error");
    expect(failed).toContain("Не удалось загрузить подборку");
  });
});

describe("TodayAfterMeCard", () => {
  it("writes the hint, the explanation, the chips of its own card and both buttons", () => {
    const card = todayAfterMeCard(digest)!;
    const html = renderToStaticMarkup(createElement(TodayAfterMeCard, { card, onShow: noop, onDismiss: noop }));

    expect(html).toContain("После джаза ты обычно идёшь дальше");
    expect(html).toContain("Так было 4 раза");
    expect(html).toContain("Осталось 12 мест");
    expect(html).toContain("Показать места рядом");
    // Подсказку можно отклонить: рекомендация, от которой нельзя отказаться, — это указание.
    expect(html).toContain("Не надо");
    // Сам заголовок подсказки чипом не дублируется.
    expect((html.match(/После джаза/g) ?? []).length).toBe(1);
  });

  it("renders nothing for a card that carries no hint", () => {
    const plain = todayPickCards(digest)[0];
    expect(renderToStaticMarkup(createElement(TodayAfterMeCard, { card: plain, onShow: noop, onDismiss: noop }))).toBe("");
  });
});
