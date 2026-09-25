import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ListPresetSchema } from "@max-events/api-contracts";
import { listAuthorLabel, listCountLabel, listEventMeta, listShareText, type ListsState, ListsView, ListView, ownListsCounter } from "./ListsPage";
import { SaveToList, SaveToListView } from "../event/SaveToList";
import type { ListItemCard, ListSummary } from "../api/client";
import type { Friend, List } from "@max-events/api-contracts";
import { mockEvents } from "../api/mock";

const DEMO_USER_ID = "a0000000-0000-4000-8000-000000000001";

const list: List = {
  id: "70000000-0000-4000-8000-000000000001",
  userId: DEMO_USER_ID,
  preset: "want_to_go",
  title: "Хочу сходить",
  createdAt: "2026-09-11T10:00:00+03:00",
  updatedAt: "2026-09-11T10:00:00+03:00",
};

const anna: Friend = { id: "a0000000-0000-4000-8000-0000000000b1", name: "Анна Соколова", avatarUrl: null };
const me: Friend = { id: DEMO_USER_ID, name: "Демо", avatarUrl: null };

function summary(overrides: Partial<ListSummary> = {}): ListSummary {
  return { list, itemsCount: 2, savedItemId: null, participants: [], ...overrides };
}

const own = summary({ list: { ...list, id: "70000000-0000-4000-8000-000000000009", preset: null, title: "Джаз по четвергам" } });

const item = { id: "71000000-0000-4000-8000-000000000001", listId: list.id, eventId: mockEvents[0].id, placeId: null, addedAt: "2026-09-11T11:00:00+03:00" } as const;
const card: ListItemCard = { item, event: mockEvents[0], place: null, addedBy: null };

describe("list labels", () => {
  it("pluralizes the counter and calls an empty list empty", () => {
    expect(listCountLabel(0)).toBe("Пусто");
    expect(listCountLabel(1)).toBe("1 событие");
    expect(listCountLabel(3)).toBe("3 события");
    expect(listCountLabel(24)).toBe("24 события");
    expect(listCountLabel(17)).toBe("17 событий");
  });

  it("counts the lists of one's own against the ceiling, presets excluded", () => {
    const shared = summary({ list: { ...list, id: "70000000-0000-4000-8000-0000000000c0", preset: null, title: "Куда с родителями" }, participants: [me, anna] });

    expect(ownListsCounter([summary(), own, shared])).toBe("2 из 20");
    expect(ownListsCounter([summary()])).toBe("0 из 20");
  });

  it("puts the weekday and time before the entry condition", () => {
    expect(listEventMeta({ startsAt: "2026-09-12T12:00:00+03:00", isPaid: true, priceRub: 700 })).toMatch(/^[А-ЯЁ][а-яё]{1,2} \d{2}:\d{2} · 700 ₽$/);
  });

  it("says a free event is free instead of printing a zero", () => {
    expect(listEventMeta({ startsAt: "2026-09-12T12:00:00+03:00", isPaid: false, priceRub: null })).toMatch(/ · бесплатно$/);
  });

  it("names the viewer as «Ты» and anyone else by their first name", () => {
    expect(listAuthorLabel(me, DEMO_USER_ID)).toBe("добавила: Ты");
    expect(listAuthorLabel(anna, DEMO_USER_ID)).toBe("добавил: Анна");
  });

  it("says nothing when the item carries no author", () => {
    expect(listAuthorLabel(null, DEMO_USER_ID)).toBeNull();
  });

  it("calls a personal list a list, and a shared one a collection", () => {
    const cards = [card];

    expect(listShareText(list, cards, false)).toBe(`Список «Хочу сходить»: ${mockEvents[0].title}`);
    expect(listShareText(list, cards, true)).toBe(`Совместная коллекция «Хочу сходить»: ${mockEvents[0].title}`);
  });

  it("joins every item title of a collection", () => {
    expect(listShareText({ ...list, title: "Куда с родителями" }, [card, { ...card, event: mockEvents[1] }], true)).toBe(`Совместная коллекция «Куда с родителями»: ${mockEvents[0].title}, ${mockEvents[1].title}`);
  });
});

describe("ListsView", () => {
  const ready: ListsState = { status: "ready", summaries: [summary(), own] };

  it("splits the preset shelves from the lists of one's own and counts the latter", () => {
    const html = renderToStaticMarkup(createElement(ListsView, { state: ready, onOpen: () => {} }));

    expect(html).toContain("ГОТОВЫЕ ПОЛКИ");
    expect(html).toContain("МОИ СПИСКИ");
    expect(html).toContain("1 из 20");
    expect(html).toContain("Хочу сходить");
    expect(html).toContain("Джаз по четвергам");
    expect(html).toContain("2 события");
  });

  it("marks a list of one's own apart from a preset shelf without making it another card", () => {
    const html = renderToStaticMarkup(createElement(ListsView, { state: ready, onOpen: () => {} }));

    expect((html.match(/app-lists-tile-mark--own/g) ?? []).length).toBe(1);
    expect((html.match(/class="app-lists-tile"/g) ?? []).length).toBe(2);
  });

  it("offers the dashed new-list tile always and the topbar only where the screen asks for it", () => {
    const plain = renderToStaticMarkup(createElement(ListsView, { state: ready, onOpen: () => {} }));
    const screen = renderToStaticMarkup(createElement(ListsView, { state: ready, onOpen: () => {}, topbar: true }));

    expect(plain).toContain("Новый список");
    expect(plain).not.toContain("app-lists-bar-title");
    expect(screen).toContain("Создать");
    expect(screen).toContain("app-lists-bar-title");
  });

  it("names the participants of a shared collection on its tile", () => {
    const shared = summary({ list: { ...list, preset: null, title: "Куда с родителями" }, participants: [me, anna] });
    const html = renderToStaticMarkup(createElement(ListsView, { state: { status: "ready", summaries: [shared] }, onOpen: () => {} }));

    expect(html).toContain('aria-label="Демо + Анна Соколова"');
    expect(renderToStaticMarkup(createElement(ListsView, { state: ready, onOpen: () => {} }))).not.toContain("app-lists-faces");
  });

  it("opens the create row only when asked, and keeps the button out of reach on a blank title", () => {
    const closed = renderToStaticMarkup(createElement(ListsView, { state: ready, onOpen: () => {} }));
    const open = renderToStaticMarkup(createElement(ListsView, { state: ready, onOpen: () => {}, creating: true, newTitle: "   " }));

    expect(closed).not.toContain("Название списка");
    expect(open).toContain("Название списка");
    // A blank title is not a list name: the button stays disabled rather than failing at the backend.
    expect(open).toContain("disabled");
  });

  it("says when a change did not go through", () => {
    const html = renderToStaticMarkup(createElement(ListsView, { state: ready, onOpen: () => {}, error: "Больше 20 своих списков не получится" }));

    expect(html).toContain("Больше 20 своих списков не получится");
  });

  it("renders the loading and error states", () => {
    expect(renderToStaticMarkup(createElement(ListsView, { state: { status: "loading" }, onOpen: () => {} }))).toContain("Загрузка…");
    expect(renderToStaticMarkup(createElement(ListsView, { state: { status: "error" }, onOpen: () => {} }))).toContain("Не удалось загрузить списки.");
  });
});

describe("ListView", () => {
  it("renders saved event cards with their meta line", () => {
    const html = renderToStaticMarkup(createElement(ListView, { state: { status: "ready", cards: [card] }, onOpenEvent: () => {} }));

    expect(html).toContain(mockEvents[0].title);
    expect(html).toContain(listEventMeta(mockEvents[0]));
    expect(html).toContain(`app-media--${mockEvents[0].category}`);
  });

  it("attributes items to their authors only on a shared collection", () => {
    const cards = [{ ...card, addedBy: anna }];
    const shared = renderToStaticMarkup(createElement(ListView, { state: { status: "ready", cards }, onOpenEvent: () => {}, showAuthors: true, viewerId: DEMO_USER_ID }));

    expect(shared).toContain("добавил: Анна");
    expect(renderToStaticMarkup(createElement(ListView, { state: { status: "ready", cards }, onOpenEvent: () => {} }))).not.toContain("добавил");
  });

  it("offers to take an event out of the list, and nothing when the caller wires no handler", () => {
    const withRemove = renderToStaticMarkup(createElement(ListView, { state: { status: "ready", cards: [card] }, onOpenEvent: () => {}, onRemove: () => {} }));

    expect(withRemove).toContain(`aria-label="Убрать из списка: ${mockEvents[0].title}"`);
    expect(renderToStaticMarkup(createElement(ListView, { state: { status: "ready", cards: [card] }, onOpenEvent: () => {} }))).not.toContain("Убрать из списка");
  });

  it("renders the empty, loading and error states", () => {
    expect(renderToStaticMarkup(createElement(ListView, { state: { status: "ready", cards: [] }, onOpenEvent: () => {} }))).toContain("Пока ничего не сохранено.");
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
    const html = renderToStaticMarkup(createElement(SaveToList, { eventId: mockEvents[0].id, userId: DEMO_USER_ID }));

    expect(html).toContain("Сохранить");
    expect(html).not.toContain("app-lists-row");
    expect(html).not.toContain("Готово");
  });
});
