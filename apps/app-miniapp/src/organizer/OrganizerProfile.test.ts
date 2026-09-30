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
        tab: "events",
        list: null,
        failed: false,
        onTab: noop,
        onList: noop,
        onOpenEvent: noop,
        onOpenEvents: noop,
        onSettings: noop,
        onPickAvatar: noop,
        onPickCover: noop,
        onResetAvatar: noop,
        onResetCover: noop,
      }),
    );

    expect(html).toContain("Парк Горького");
    expect(html).toContain("События");
    expect(html).toContain("Места");
    expect(html).toContain("подписок");
    expect(html).toContain("подписчиков");
    expect(html).toContain("Шапка");
    expect(html).toContain("Настройки");
  });
});
