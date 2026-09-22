import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { pluralRu } from "../catalog/format";
import { createDraftErrors, WeGroupsView, type WeGroupsState } from "./WeGroupsPage";
import { listMockWeGroups, mockFriends } from "../api/mock";

const GROUPS = listMockWeGroups();

function render(state: WeGroupsState): string {
  return renderToStaticMarkup(createElement(WeGroupsView, { state, friends: mockFriends, creating: false, draft: { title: "", memberIds: [] }, saving: false, failed: false, onToggleCreate: () => {}, onDraftChange: () => {}, onCreate: () => {}, onOpen: () => {} }));
}

describe("member count label", () => {
  it("pluralizes «участник» by ru rules", () => {
    expect(`1 ${pluralRu(1, "участник", "участника", "участников")}`).toBe("1 участник");
    expect(`3 ${pluralRu(3, "участник", "участника", "участников")}`).toBe("3 участника");
    expect(`5 ${pluralRu(5, "участник", "участника", "участников")}`).toBe("5 участников");
    expect(`11 ${pluralRu(11, "участник", "участника", "участников")}`).toBe("11 участников");
  });
});

describe("createDraftErrors", () => {
  it("requires a non-empty title", () => {
    expect(createDraftErrors({ title: "  ", memberIds: [] })).toHaveLength(1);
    expect(createDraftErrors({ title: "Поездка", memberIds: [] })).toHaveLength(0);
  });
});

describe("WeGroupsView", () => {
  it("lists active groups first and the archived ones under their own section", () => {
    const html = render({ status: "ready", groups: GROUPS });
    const active = GROUPS.filter((screen) => screen.group.status === "active");
    const archived = GROUPS.filter((screen) => screen.group.status === "archived");

    for (const screen of active) expect(html).toContain(screen.group.title);
    for (const screen of archived) expect(html).toContain(screen.group.title);
    expect(html.indexOf("Архив")).toBeGreaterThan(html.indexOf(active[0].group.title));
  });

  it("offers the create entry and the member count", () => {
    const html = render({ status: "ready", groups: GROUPS });

    expect(html).toContain("Создать");
    expect(html).toContain(`${GROUPS[0].membersCount} ${pluralRu(GROUPS[0].membersCount, "участник", "участника", "участников")}`);
  });

  it("renders loading, error and empty states", () => {
    expect(render({ status: "loading" })).toContain("Загрузка…");
    expect(render({ status: "error" })).toContain("Не удалось загрузить группы.");
    expect(render({ status: "ready", groups: [] })).toContain("Пока нет групп.");
  });
});
