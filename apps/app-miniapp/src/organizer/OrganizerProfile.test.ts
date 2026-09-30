import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OrganizerProfileView } from "./OrganizerProfile";

const noop = () => {};

describe("OrganizerProfileView", () => {
  it("shows the organization the way a profile shows a person: cover, counters, events and places", () => {
    const html = renderToStaticMarkup(
      createElement(OrganizerProfileView, {
        name: "Парк Горького",
        about: "Москва · События",
        avatarUrl: null,
        coverUrl: null,
        events: [],
        places: [],
        subscriptions: [],
        followers: [],
        rating: null,
        reviews: [],
        pane: "home",
        list: null,
        failed: false,
        onPane: noop,
        onList: noop,
        onSettings: noop,
        onPickAvatar: noop,
        onPickCover: noop,
        onResetAvatar: noop,
        onResetCover: noop,
      }),
    );

    expect(html).toContain("Парк Горького");
    expect(html).toContain("подписок");
    expect(html).toContain("подписчиков");
    expect(html).toContain("Шапка");
    expect(html).toContain('aria-label="Настройки профиля"');
    expect(html).toContain("Настройки");
    expect(html).toContain("Отзывы");
    expect(html).toContain("Команда");
    expect(html).toContain("Жалобы");
    expect(html).not.toContain("Продвижение");
    expect(html).not.toContain('aria-label="Назад"');
  });

  it("puts a back control on a screen opened from the profile", () => {
    const reviews = renderToStaticMarkup(
      createElement(OrganizerProfileView, {
        name: "max-events",
        about: "",
        avatarUrl: null,
        coverUrl: null,
        events: [],
        places: [],
        subscriptions: [],
        followers: [],
        rating: null,
        reviews: [],
        pane: "reviews",
        list: null,
        failed: false,
        onPane: noop,
        onList: noop,
        onSettings: noop,
        onPickAvatar: noop,
        onPickCover: noop,
        onResetAvatar: noop,
        onResetCover: noop,
      }),
    );
    expect(reviews).toContain('aria-label="Назад"');
    expect(reviews).toContain("Отзывы гостей");
    expect(reviews).toContain("Гости оставляют отзыв после события, на котором были.");
    expect(reviews).not.toContain("app-me-shortcut");

    const followers = renderToStaticMarkup(
      createElement(OrganizerProfileView, {
        name: "max-events",
        about: "",
        avatarUrl: null,
        coverUrl: null,
        events: [],
        places: [],
        subscriptions: [],
        followers: [],
        rating: null,
        reviews: [],
        pane: "home",
        list: "followers",
        failed: false,
        onPane: noop,
        onList: noop,
        onSettings: noop,
        onPickAvatar: noop,
        onPickCover: noop,
        onResetAvatar: noop,
        onResetCover: noop,
      }),
    );
    expect(followers).toContain('aria-label="Назад"');
    expect(followers).toContain("Подписчики");
    expect(followers).toContain("Подписчиков пока нет.");
  });
});
