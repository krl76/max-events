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
    expect(reviews).toContain('class="app-me-back"');
    expect(reviews).toContain('aria-label="Назад"');
    expect(reviews).not.toContain("Отзывы гостей");
    expect(reviews).not.toContain("app-pcodes-title");
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
    expect(followers).toContain('class="app-me-back"');
    expect(followers).toContain('aria-label="Назад"');
    expect(followers).not.toContain("app-pcodes-title");
    expect(followers).toContain("Подписчиков пока нет.");
  });

  it("shows guest reviews only on the reviews screen", () => {
    const review = {
      id: "r1",
      name: "Борис Наумова",
      stars: 5,
      wouldGoAgain: true,
      text: "Играли близко, без сцены.",
      photos: [],
      factTags: ["calm"],
      categoryScores: { atmosphere: 5, place: 4 },
      createdAt: "2026-09-12T18:00:00.000Z",
      eventTitle: "Вечер джаза на Патриарших",
    };
    const shared = {
      name: "max-events",
      about: "",
      avatarUrl: null,
      coverUrl: null,
      events: [],
      places: [],
      subscriptions: [],
      followers: [],
      rating: { organizerUserId: "org", averageStars: 4.4, recommendPercent: 100, visitsCount: 40, onTimePercent: null, reviewsCount: 2, attendancePercent: null, eventsCount: 16 },
      reviews: [review],
      list: null,
      failed: false,
      onPane: noop,
      onList: noop,
      onSettings: noop,
      onPickAvatar: noop,
      onPickCover: noop,
      onResetAvatar: noop,
      onResetCover: noop,
    };
    const home = renderToStaticMarkup(createElement(OrganizerProfileView, { ...shared, pane: "home" }));
    expect(home).toContain("Оценка");
    expect(home).toContain("4,4");
    expect(home).toContain("Отзывы");
    expect(home).not.toContain("Борис Наумова");
    expect(home).not.toContain("Играли близко, без сцены.");
    expect(home).not.toContain("app-org-review");

    const opened = renderToStaticMarkup(createElement(OrganizerProfileView, { ...shared, pane: "reviews" }));
    expect(opened).toContain('class="app-org-review"');
    expect(opened).toContain("Борис Наумова");
    expect(opened).toContain("Вечер джаза на Патриарших");
    expect(opened).toContain("Играли близко, без сцены.");
    expect(opened).not.toContain("Ещё раз");
    expect(opened).toContain('aria-label="5 из 5"');
    expect(opened).toContain("Атмосфера");
    expect(opened).toContain("Спокойно");
    expect(opened).not.toContain("app-me-shortcut");
    expect(opened).toContain('aria-label="Назад"');
  });
});
