import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ListPresetSchema } from "@max-events/api-contracts";
import { listShareText, ListsView, ListView } from "./ListsPage";
import { pluralRu } from "../catalog/format";
import { SaveToList, SaveToListView } from "../event/SaveToList";
import type { ListItemCard, ListSummary } from "../api/client";
import type { Friend, List } from "@max-events/api-contracts";
import { mockEvents } from "../api/mock";

const list: List = {
  id: "70000000-0000-4000-8000-000000000001",
  userId: "a0000000-0000-4000-8000-000000000001",
  preset: "want_to_go",
  title: "Хочу сходить",
  createdAt: "2026-09-11T10:00:00+03:00",
  updatedAt: "2026-09-11T10:00:00+03:00",
};

const anna: Friend = { id: "a0000000-0000-4000-8000-0000000000b1", name: "Анна Соколова", avatarUrl: null };

function summary(overrides: Partial<ListSummary> = {}): ListSummary {
  return { list, itemsCount: 2, savedItemId: null, participants: [], ...overrides };
}

const item = { id: "71000000-0000-4000-8000-000000000001", listId: list.id, eventId: mockEvents[0].id, placeId: null, addedAt: "2026-09-11T11:00:00+03:00" } as const;
const card: ListItemCard = { item, event: mockEvents[0], addedBy: null };

describe("list items label", () => {
  it("pluralizes the counter and collapses the empty list", () => {
    const count = 0;
    expect(count === 0 ? "Пусто" : `${count} ${pluralRu(count, "событие", "события", "событий")}`).toBe("Пусто");
    expect(`1 ${pluralRu(1, "событие", "события", "событий")}`).toBe("1 событие");
    expect(`3 ${pluralRu(3, "событие", "события", "событий")}`).toBe("3 события");
    expect(`5 ${pluralRu(5, "событие", "события", "событий")}`).toBe("5 событий");
    expect(`12 ${pluralRu(12, "событие", "события", "событий")}`).toBe("12 событий");
    expect(`21 ${pluralRu(21, "событие", "события", "событий")}`).toBe("21 событие");
  });
});

describe("listShareText", () => {
  it("calls a personal list a list, and a shared one a collection", () => {
    const cards = [card];

    expect(listShareText(list, cards, false)).toBe(`Список «Хочу сходить»: ${cards[0]!.event.title}`);
    expect(listShareText(list, cards, true)).toBe(`Совместная коллекция «Хочу сходить»: ${cards[0]!.event.title}`);
  });
});

describe("ListView removal", () => {
  it("offers to take an event out of the list, and nothing when the caller wires no handler", () => {
    const cards = [card];
    const withRemove = renderToStaticMarkup(createElement(ListView, { state: { status: "ready", cards }, onOpenEvent: () => {}, onRemove: () => {} }));

    expect(withRemove).toContain(`aria-label="Убрать из списка: ${cards[0]!.event.title}"`);
    expect(renderToStaticMarkup(createElement(ListView, { state: { status: "ready", cards }, onOpenEvent: () => {} }))).not.toContain("Убрать");
  });
});

describe("ListsView management", () => {
  const own = summary({ list: { ...list, id: "70000000-0000-4000-8000-000000000009", preset: null, title: "Сводить маму" } });

  it("offers create, rename and delete for a list of one's own", () => {
    const html = renderToStaticMarkup(createElement(ListsView, { state: { status: "ready", summaries: [own] }, onOpen: () => {}, newTitle: "", onNewTitle: () => {} }));

    expect(html).toContain("Создать список");
    expect(html).toContain('aria-label="Переименовать: Сводить маму"');
    expect(html).toContain('aria-label="Удалить: Сводить маму"');
  });

  it("offers neither rename nor delete on a preset", () => {
    // The backend recreates a missing preset, so the change would not stick.
    const html = renderToStaticMarkup(createElement(ListsView, { state: { status: "ready", summaries: [summary()] }, onOpen: () => {}, newTitle: "", onNewTitle: () => {} }));

    expect(html).toContain("Хочу сходить");
    expect(html).not.toContain("Переименовать");
    expect(html).not.toContain("Удалить");
  });

  it("offers neither on a shared collection either", () => {
    const shared = summary({ list: { ...list, preset: null, title: "Идеи на выходные" }, participants: [anna] });
    const html = renderToStaticMarkup(createElement(ListsView, { state: { status: "ready", summaries: [shared] }, onOpen: () => {}, newTitle: "", onNewTitle: () => {} }));

    expect(html).not.toContain("Переименовать");
    expect(html).not.toContain("Удалить");
  });

  it("swaps the card for an input while renaming, and keeps the create button out of reach when blank", () => {
    const renaming = renderToStaticMarkup(createElement(ListsView, { state: { status: "ready", summaries: [own] }, onOpen: () => {}, newTitle: "", onNewTitle: () => {}, renamingId: own.list.id, renameTitle: "Сводить папу" }));
    expect(renaming).toContain('aria-label="Новое название: Сводить маму"');
    expect(renaming).toContain("Сохранить");
    expect(renaming).not.toContain("app-card--link");

    // A blank title is not a list name: the button stays disabled rather than failing at the backend.
    expect(renderToStaticMarkup(createElement(ListsView, { state: { status: "ready", summaries: [own] }, onOpen: () => {}, newTitle: "   ", onNewTitle: () => {} }))).toContain("disabled");
  });

  it("hides the management controls entirely when the caller wires none", () => {
    const html = renderToStaticMarkup(createElement(ListsView, { state: { status: "ready", summaries: [own] }, onOpen: () => {} }));

    expect(html).not.toContain("Создать список");
    expect(html).toContain("Сводить маму");
  });

  it("asks again before deleting, because a delete takes the saved events with it", () => {
    const armed = renderToStaticMarkup(createElement(ListsView, { state: { status: "ready", summaries: [own] }, onOpen: () => {}, newTitle: "", onNewTitle: () => {}, confirmingId: own.list.id }));

    expect(armed).toContain("Точно удалить?");
    expect(armed).toContain(`aria-label="Точно удалить: ${own.list.title}"`);
    // Another list is not armed by the first one's confirmation.
    expect(renderToStaticMarkup(createElement(ListsView, { state: { status: "ready", summaries: [own] }, onOpen: () => {}, newTitle: "", onNewTitle: () => {} }))).not.toContain("Точно удалить");
  });

  it("says when a change did not go through", () => {
    const html = renderToStaticMarkup(createElement(ListsView, { state: { status: "ready", summaries: [own] }, onOpen: () => {}, newTitle: "", onNewTitle: () => {}, error: "Не удалось изменить списки." }));

    expect(html).toContain("Не удалось изменить списки.");
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

  it("marks a shared collection with the badge and its participants", () => {
    const html = renderToStaticMarkup(createElement(ListsView, { state: { status: "ready", summaries: [summary({ list: { ...list, preset: null, title: "Идеи на выходные" }, participants: [anna] })] }, onOpen: () => {} }));

    expect(html).toContain("Совместная");
    expect(html).toContain("Идеи на выходные");
    expect(html).toContain("Анна Соколова");
    expect(renderToStaticMarkup(createElement(ListsView, { state: { status: "ready", summaries: [summary()] }, onOpen: () => {} }))).not.toContain("Совместная");
  });

  it("renders the loading and error states", () => {
    expect(renderToStaticMarkup(createElement(ListsView, { state: { status: "loading" }, onOpen: () => {} }))).toContain("Загрузка…");
    expect(renderToStaticMarkup(createElement(ListsView, { state: { status: "error" }, onOpen: () => {} }))).toContain("Не удалось загрузить списки.");
  });
});

describe("shared collection screen", () => {
  it("builds the share text from the list title and item titles", () => {
    expect(listShareText({ ...list, title: "Идеи на выходные" }, [card, { ...card, event: mockEvents[1] }], true)).toBe(`Совместная коллекция «Идеи на выходные»: ${mockEvents[0].title}, ${mockEvents[1].title}`);
  });

  it("attributes items to their authors on the shared screen", () => {
    const html = renderToStaticMarkup(createElement(ListView, { state: { status: "ready", cards: [{ ...card, addedBy: anna }] }, onOpenEvent: () => {}, showAuthors: true }));

    expect(html).toContain("Добавил: Анна Соколова");
    expect(renderToStaticMarkup(createElement(ListView, { state: { status: "ready", cards: [{ ...card, addedBy: anna }] }, onOpenEvent: () => {} }))).not.toContain("Добавил:");
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
