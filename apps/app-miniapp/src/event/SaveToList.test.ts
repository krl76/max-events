import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { List } from "@max-events/api-contracts";
import type { ListSummary } from "../api/client";
import { SaveToList, SaveToListState, SaveToListView, savePickerLists } from "./SaveToList";

const USER_ID = "a0000000-0000-4000-8000-000000000001";

function list(id: string, title: string): List {
  return { id, userId: USER_ID, preset: null, title, visibility: "private", createdAt: "2026-09-01T10:00:00Z", updatedAt: "2026-09-01T10:00:00Z" };
}

function summary(id: string, title: string, savedItemId: string | null): ListSummary {
  return { list: list(id, title), itemsCount: 1, savedItemId, participants: [] };
}

const READY: SaveToListState = { status: "ready", summaries: [summary("b0000000-0000-4000-8000-000000000001", "Хочу сходить", null), summary("b0000000-0000-4000-8000-000000000002", "Избранное", "d0000000-0000-4000-8000-000000000001")] };
const noop = () => {};

describe("SaveToListView", () => {
  it("renders the loading state without picker rows", () => {
    const html = renderToStaticMarkup(createElement(SaveToListView, { state: { status: "loading" }, onToggle: noop, onDone: noop }));

    expect(html).toContain("Загрузка…");
    expect(html).not.toContain("app-lists-row");
  });

  it("renders the error state instead of picker rows", () => {
    const html = renderToStaticMarkup(createElement(SaveToListView, { state: { status: "error" }, onToggle: noop, onDone: noop }));

    expect(html).toContain("app-state--error");
    expect(html).toContain("Не удалось загрузить списки.");
    expect(html).not.toContain("app-lists-row");
  });

  it("marks saved lists and offers adding the missing ones", () => {
    const html = renderToStaticMarkup(createElement(SaveToListView, { state: READY, onToggle: noop, onDone: noop }));

    expect(html).toContain("Хочу сходить");
    expect(html).toContain("Избранное");
    expect(html).toContain("В списке");
    expect(html).toContain("Добавить");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("Сохранить");
    expect(html).toContain("app-sheet-grab");
    expect(html).not.toContain("Закрыть окно");
    expect(html).not.toContain("Готово");
    expect(html).toContain("app-save-sheet");
    expect(html).toContain("Новый список");
  });

  it("keeps the two shelves and a list the viewer made, and drops the other presets", () => {
    const weekend = summary("b0000000-0000-4000-8000-000000000003", "Выходные", null);
    weekend.list.preset = "weekend";
    const own = summary("b0000000-0000-4000-8000-000000000004", "Мой маршрут", null);
    const html = renderToStaticMarkup(createElement(SaveToListView, { state: { status: "ready", summaries: [...READY.summaries, weekend, own] }, onToggle: noop, onDone: noop }));

    expect(savePickerLists([weekend, own]).map((row) => row.list.title)).toEqual(["Мой маршрут"]);
    expect(html).toContain("Хочу сходить");
    expect(html).toContain("Избранное");
    expect(html).toContain("Мой маршрут");
    expect(html).not.toContain("Выходные");
  });
});

describe("SaveToList", () => {
  it("starts collapsed with the save button and without the picker", () => {
    const html = renderToStaticMarkup(createElement(SaveToList, { eventId: "e0000000-0000-4000-8000-000000000001", userId: USER_ID }));

    expect(html).toContain("Сохранить");
    expect(html).not.toContain("Сохранено");
    expect(html).not.toContain("app-lists-row");
  });
});
