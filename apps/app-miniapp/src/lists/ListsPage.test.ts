import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ListPresetSchema } from "@max-events/api-contracts";
import { listItemsLabel, ListsView, ListView } from "./ListsPage";
import { SaveToList, SaveToListView } from "../event/SaveToList";
import type { ListItemCard, ListSummary } from "../api/client";
import type { List } from "@max-events/api-contracts";
import { mockEvents } from "../api/mock";

const list: List = {
  id: "70000000-0000-4000-8000-000000000001",
  userId: "a0000000-0000-4000-8000-000000000001",
  preset: "want_to_go",
  title: "Хочу сходить",
  createdAt: "2026-09-11T10:00:00+03:00",
  updatedAt: "2026-09-11T10:00:00+03:00",
};

function summary(overrides: Partial<ListSummary> = {}): ListSummary {
  return { list, itemsCount: 2, savedItemId: null, ...overrides };
}

const item = { id: "71000000-0000-4000-8000-000000000001", listId: list.id, eventId: mockEvents[0].id, placeId: null, addedAt: "2026-09-11T11:00:00+03:00" } as const;
const card: ListItemCard = { item, event: mockEvents[0] };

describe("listItemsLabel", () => {
  it("pluralizes the counter and collapses the empty list", () => {
    expect(listItemsLabel(0)).toBe("Пусто");
    expect(listItemsLabel(1)).toBe("1 событие");
    expect(listItemsLabel(3)).toBe("3 события");
    expect(listItemsLabel(5)).toBe("5 событий");
    expect(listItemsLabel(12)).toBe("12 событий");
    expect(listItemsLabel(21)).toBe("21 событие");
  });
});

describe("ListsView", () => {
  it("renders one card per list with its counter", () => {
    const html = renderToStaticMarkup(createElement(ListsView, { state: { status: "ready", summaries: [summary(), summary({ itemsCount: 0 })] }, onOpen: () => {} }));

    expect(html).toContain("Хочу сходить");
    expect(html).toContain("2 события");
    expect(html).toContain("Пусто");
    expect((html.match(/app-card--link/g) ?? []).length).toBe(2);
  });

  it("renders the loading and error states", () => {
    expect(renderToStaticMarkup(createElement(ListsView, { state: { status: "loading" }, onOpen: () => {} }))).toContain("Загрузка…");
    expect(renderToStaticMarkup(createElement(ListsView, { state: { status: "error" }, onOpen: () => {} }))).toContain("Не удалось загрузить списки.");
  });
});

describe("ListView", () => {
  it("renders saved event cards with the start date", () => {
    const html = renderToStaticMarkup(createElement(ListView, { state: { status: "ready", cards: [card] }, onOpenEvent: () => {} }));

    expect(html).toContain(mockEvents[0].title);
    expect(html).toContain(new Date(mockEvents[0].startsAt).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }));
  });

  it("renders the empty state", () => {
    const html = renderToStaticMarkup(createElement(ListView, { state: { status: "ready", cards: [] }, onOpenEvent: () => {} }));

    expect(html).toContain("Пока ничего не сохранено.");
  });

  it("renders the loading and error states", () => {
    expect(renderToStaticMarkup(createElement(ListView, { state: { status: "loading" }, onOpenEvent: () => {} }))).toContain("Загрузка…");
    expect(renderToStaticMarkup(createElement(ListView, { state: { status: "error" }, onOpenEvent: () => {} }))).toContain("Не удалось загрузить список.");
  });
});

describe("SaveToListView", () => {
  const props = { onToggle: () => {}, onDone: () => {} };

  it("renders the six preset lists with the saved state per list", () => {
    const html = renderToStaticMarkup(
      createElement(SaveToListView, {
        state: { status: "ready", summaries: [summary({ savedItemId: item.id }), ...ListPresetSchema.options.slice(1).map((preset, index) => summary({ list: { ...list, id: `70000000-0000-4000-8000-00000000000${index + 2}`, preset, title: `Список ${preset}` } }))] },
        ...props,
      }),
    );

    expect(html).toContain("В списке");
    expect((html.match(/aria-pressed="true"/g) ?? []).length).toBe(1);
    expect((html.match(/Добавить/g) ?? []).length).toBe(5);
    expect(html).toContain("Готово");
  });

  it("renders the loading and error states", () => {
    expect(renderToStaticMarkup(createElement(SaveToListView, { state: { status: "loading" }, ...props }))).toContain("Загрузка…");
    expect(renderToStaticMarkup(createElement(SaveToListView, { state: { status: "error" }, ...props }))).toContain("Не удалось загрузить списки.");
  });
});

describe("SaveToList", () => {
  it("starts collapsed with the save button and no picker", () => {
    const html = renderToStaticMarkup(createElement(SaveToList, { eventId: mockEvents[0].id, userId: "a0000000-0000-4000-8000-000000000001" }));

    expect(html).toContain("Сохранить");
    expect(html).not.toContain("app-lists-row");
    expect(html).not.toContain("Готово");
  });
});
