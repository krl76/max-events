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
        tab: "events",
        list: null,
        failed: false,
        onTab: noop,
        onList: noop,
        onOpenEvent: noop,
        onSettings: noop,
        onLogout: noop,
        onPickAvatar: noop,
        onPickCover: noop,
        surface: "cabinet",
        onSurface: noop,
      }),
    );

    expect(html).toContain("Парк Горького");
    expect(html).toContain("Публичная страница");
    expect(html).toContain("Данные организации");
    expect(html).toContain("Выйти из кабинета");
  });

  it("keeps the public page as a cover, events and places", () => {
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
        tab: "events",
        list: null,
        failed: false,
        onTab: noop,
        onList: noop,
        onOpenEvent: noop,
        onSettings: noop,
        onLogout: noop,
        onPickAvatar: noop,
        onPickCover: noop,
        surface: "public",
        onSurface: noop,
      }),
    );

    expect(html).toContain("События");
    expect(html).toContain("Места");
    expect(html).toContain("подписок");
    expect(html).toContain("Шапка");
  });
});
