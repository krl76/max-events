import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EventPicker, filterEvents, type PickableEvent } from "./EventPicker";

const concert: PickableEvent = { id: "e1", title: "Ночной джаз", startsAt: "2026-09-19T17:30:00+03:00", coverUrl: "https://events.versacegus.cc/cover.jpg", category: "afisha", city: "Москва" };
const run: PickableEvent = { id: "e2", title: "Пробежка", startsAt: "2026-09-20T06:00:00+03:00", coverUrl: null, category: "sport", city: "Казань" };

describe("filterEvents", () => {
  it("matches a title or a city and returns everything for a blank query", () => {
    expect(filterEvents([concert, run], "джаз").map((event) => event.id)).toEqual(["e1"]);
    expect(filterEvents([concert, run], "казань").map((event) => event.id)).toEqual(["e2"]);
    expect(filterEvents([concert, run], "  ")).toEqual([concert, run]);
  });
});

describe("EventPicker", () => {
  it("draws the cover, the title and the city instead of a bare name", () => {
    const html = renderToStaticMarkup(createElement(EventPicker, { title: "Событие поста", events: [concert, run], selectedId: "e1", onPick: () => {}, onClose: () => {} }));

    expect(html).toContain("Событие поста");
    expect(html).toContain("Ночной джаз");
    expect(html).toContain("https://events.versacegus.cc/cover.jpg");
    expect(html).toContain("Москва");
    expect(html).toContain("Пробежка");
    expect(html).toContain('aria-pressed="true"');
  });

  it("says the catalog is empty when there is nothing to pick", () => {
    const html = renderToStaticMarkup(createElement(EventPicker, { title: "Событие", events: [], selectedId: null, onPick: () => {}, onClose: () => {} }));

    expect(html).toContain("В афише пока нет событий.");
  });

  it("keeps a multiple pick inside the sheet with the 2..10 hint", () => {
    const html = renderToStaticMarkup(createElement(EventPicker, { title: "События голосования", events: [concert, run], selectedIds: ["e1"], multiple: true, hint: "Можно выбрать от 2 до 10 событий", confirmLabel: "Выбрать", onConfirm: () => {}, onClose: () => {} }));

    expect(html).toContain("Можно выбрать от 2 до 10 событий");
    expect(html).toContain("Выбрать");
    expect(html).toContain("Отмена");
  });
});
