import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Friend } from "@max-events/api-contracts";
import { FriendPicker, filterFriends, friendPickerConfirmLabel, toggleFriendSelection } from "./FriendPicker";

const FRIENDS: Friend[] = [
  { id: "f1", name: "Анна Соколова", avatarUrl: null },
  { id: "f2", name: "Дима Кузнецов", avatarUrl: null },
  { id: "f3", name: "Катя Орлова", avatarUrl: null },
];

function render(props: Partial<Parameters<typeof FriendPicker>[0]> = {}): string {
  return renderToStaticMarkup(createElement(FriendPicker, { friends: FRIENDS, onConfirm: () => {}, onClose: () => {}, ...props }));
}

describe("filterFriends", () => {
  it("matches any part of the name regardless of case", () => {
    expect(filterFriends(FRIENDS, "кат").map((friend) => friend.id)).toEqual(["f3"]);
    expect(filterFriends(FRIENDS, "СОКОЛ").map((friend) => friend.id)).toEqual(["f1"]);
    expect(filterFriends(FRIENDS, "ов").map((friend) => friend.id)).toEqual(["f1", "f2", "f3"]);
  });

  it("returns the whole list for an empty or blank query", () => {
    expect(filterFriends(FRIENDS, "")).toEqual(FRIENDS);
    expect(filterFriends(FRIENDS, "   ")).toEqual(FRIENDS);
  });

  it("returns nothing when no name matches", () => {
    expect(filterFriends(FRIENDS, "Пётр")).toEqual([]);
  });
});

describe("toggleFriendSelection", () => {
  it("adds and removes in the multiple mode", () => {
    expect(toggleFriendSelection([], "f1", true)).toEqual(["f1"]);
    expect(toggleFriendSelection(["f1"], "f2", true)).toEqual(["f1", "f2"]);
    expect(toggleFriendSelection(["f1", "f2"], "f1", true)).toEqual(["f2"]);
  });

  it("replaces the pick in the single mode and lets the viewer unpick", () => {
    expect(toggleFriendSelection(["f1"], "f2", false)).toEqual(["f2"]);
    expect(toggleFriendSelection(["f1"], "f1", false)).toEqual([]);
  });
});

describe("friendPickerConfirmLabel", () => {
  it("counts only what a counter can tell apart", () => {
    expect(friendPickerConfirmLabel("Добавить", 0)).toBe("Добавить");
    expect(friendPickerConfirmLabel("Добавить", 1)).toBe("Добавить");
    expect(friendPickerConfirmLabel("Добавить", 3)).toBe("Добавить · 3");
  });
});

describe("FriendPicker", () => {
  it("renders a dialog with the search field, every friend and both actions", () => {
    const html = render({ title: "Кого позвать" });

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="Кого позвать"');
    expect(html).toContain('aria-label="Поиск по имени"');
    for (const friend of FRIENDS) expect(html).toContain(friend.name);
    expect(html).toContain("Отмена");
    expect(html).toContain("Добавить");
  });

  it("closes from the scrim or the cancel button", () => {
    const html = render();

    expect(html.match(/aria-label="Закрыть"/g)).toHaveLength(1);
    expect(html).toContain("app-fpick-scrim");
    expect(html).toContain("Отмена");
    expect(html).not.toContain("app-fpick-close");
  });

  it("keeps the confirmation locked until somebody is picked", () => {
    expect(render()).toMatch(/<button[^>]*app-fpick-confirm[^>]*disabled/);
  });

  it("says its own words when there is nobody to pick", () => {
    const html = render({ friends: [], emptyText: "Все друзья уже в этом календаре." });

    expect(html).toContain("Все друзья уже в этом календаре.");
    expect(html).toContain("Пригласить в MAX");
    expect(html).not.toContain("app-fpick-row");
  });

  it("carries the hint under the title when the caller gives one", () => {
    expect(render({ hint: "Он увидит твои планы" })).toContain("Он увидит твои планы");
    expect(render()).not.toContain("app-fpick-hint");
  });
});
