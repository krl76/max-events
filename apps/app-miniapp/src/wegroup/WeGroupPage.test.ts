import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { nameOf, WeGroupBudgetSummary, WeGroupView, type WeGroupState } from "./WeGroupPage";
import { listMockWeGroups, mockDemoUser } from "../api/mock";

const SEED = listMockWeGroups().find((screen) => screen.group.id === "91000000-0000-4000-8000-000000000001")!;
const OWN_ID = mockDemoUser.id;

function render(state: WeGroupState, ownId: string | null = OWN_ID): string {
  return renderToStaticMarkup(createElement(WeGroupView, { state, ownId, picker: null, pickerOptions: [], pickerLoading: false, actionFailed: false, onTogglePicker: () => {}, onPick: () => {}, onArchive: () => {}, onOpenEvent: () => {}, onOpenPlace: () => {} }));
}

describe("nameOf", () => {
  it("maps member ids to names, the own id to «Ты» and unknown ids to «Участник»", () => {
    const members = SEED.members;

    expect(nameOf(members, OWN_ID, OWN_ID)).toBe("Ты");
    expect(nameOf(members, SEED.members[1].id, OWN_ID)).toBe(SEED.members[1].name);
    expect(nameOf(members, "a0000000-0000-4000-8000-0000000000ff", OWN_ID)).toBe("Участник");
  });
});

describe("WeGroupView", () => {
  it("renders members, events, places, chat link, route and budget blocks of the seed screen", () => {
    const html = render({ status: "ready", screen: SEED });

    expect(html).toContain(SEED.group.title);
    for (const member of SEED.members.slice(1)) expect(html).toContain(member.name);
    expect(html).toContain(SEED.events[0].title);
    expect(html).toContain(SEED.places[0].title);
    expect(html).toContain("Чат группы");
    expect(html).toContain("Маршрут");
    expect(html).toContain(`Итого ${SEED.budget!.totalRub} ₽`);
  });

  it("shows the debts table with names instead of ids", () => {
    const html = renderToStaticMarkup(createElement(WeGroupBudgetSummary, { budget: SEED.budget!, members: SEED.members, ownId: OWN_ID }));

    for (const debt of SEED.budget!.debts) {
      expect(html).toContain(`${debt.amountRub} ₽`);
      expect(html).not.toContain(debt.fromUserId);
      expect(html).not.toContain(debt.toUserId);
    }
  });

  it("offers add/archive actions to the owner of an active group and hides them for a non-owner", () => {
    const html = render({ status: "ready", screen: SEED });
    expect(html).toContain("Добавить событие");
    expect(html).toContain("Добавить место");
    expect(html).toContain("Архивировать");

    const stranger = render({ status: "ready", screen: SEED }, "a0000000-0000-4000-8000-0000000000ff");
    expect(stranger).not.toContain("Архивировать");
  });

  it("hides the write actions for an archived group", () => {
    const archived = { ...SEED, group: { ...SEED.group, status: "archived" as const } };
    const html = render({ status: "ready", screen: archived });

    expect(html).toContain("Группа в архиве.");
    expect(html).not.toContain("Добавить событие");
  });

  it("renders loading, forbidden and error states", () => {
    expect(render({ status: "loading" })).toContain("Загрузка…");
    expect(render({ status: "forbidden" })).toContain("Нет доступа к группе.");
    expect(render({ status: "error" })).toContain("Не удалось загрузить группу.");
  });
});
