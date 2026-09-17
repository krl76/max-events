import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TodayView, todayLabel, type TodayState } from "./TodaySection";
import { todayPicks } from "../api/mock";

const ready: TodayState = { status: "ready", today: todayPicks() };

describe("todayLabel", () => {
  it("maps all four typed label kinds to their ru texts", () => {
    expect(todayLabel({ kind: "distance", minutes: 10 })).toBe("10 минут от тебя");
    expect(todayLabel({ kind: "friend_attending", friendName: "Анна" })).toBe("Идет Анна");
    expect(todayLabel({ kind: "free_entry" })).toBe("Свободный вход");
    expect(todayLabel({ kind: "spots_left", count: 12 })).toBe("Осталось 12 мест");
    expect(todayLabel({ kind: "after_me", fromCategory: "afisha", afterCount: 3 })).toBe("После 3 посещений — тебе зайдёт");
  });
});

describe("TodayView", () => {
  it("renders the digest summary and curated cards with all four label kinds", () => {
    const html = renderToStaticMarkup(createElement(TodayView, { state: ready, onOpen: () => {} }));

    expect(html).toContain("Что делать сегодня?");
    const summary = ready.today.summary;
    expect(html).toContain(`${summary.nearbyCount} событий рядом, ${summary.suitableCount} подходят тебе, на ${summary.withFriendsCount} идут друзья`);
    const kinds = new Set(ready.today.cards.flatMap((card) => card.labels.map((label) => label.kind)));
    expect([...kinds].sort()).toEqual(["distance", "free_entry", "friend_attending", "spots_left"]);
    for (const card of ready.today.cards) {
      expect(html).toContain(card.event.title);
      for (const label of card.labels) expect(html).toContain(todayLabel(label));
    }
    expect(html.match(/app-card--link/g)).toHaveLength(ready.today.cards.length);
  });

  it("renders an empty state when the digest has no cards", () => {
    const empty: TodayState = { status: "ready", today: { summary: todayPicks().summary, cards: [] } };
    const html = renderToStaticMarkup(createElement(TodayView, { state: empty, onOpen: () => {} }));

    expect(html).toContain("На сегодня пока ничего нет");
    expect(html).not.toContain("app-card--link");
  });

  it("renders an error state when the request fails", () => {
    const html = renderToStaticMarkup(createElement(TodayView, { state: { status: "error" }, onOpen: () => {} }));

    expect(html).toContain("app-state--error");
    expect(html).toContain("Не удалось загрузить подборку");
  });
});
