import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { WeGroupCard } from "../api/client";
import { listMockWeGroups, mockFriends } from "../api/mock";
import { WeGroupsView, createDraftErrors, formatRub, weGroupArchivedLabel, weGroupMembersLabel, weGroupSummary, weekdayIn, weekdayOn, type WeGroupsState } from "./WeGroupsPage";

/** Локальный полдень 15 сентября 2026: день недели у календарной даты один во всех поясах. */
const NOW = new Date(2026, 8, 15, 12, 0);
const GROUPS = listMockWeGroups();

function localIso(day: number, hour: number): string {
  return new Date(2026, 8, day, hour, 0).toISOString();
}

function cardWith(over: Partial<WeGroupCard>): WeGroupCard {
  return { ...GROUPS[0], ...over };
}

function eventAt(day: number, hour: number) {
  return { ...GROUPS[0].events[0], id: `event-${day}-${hour}`, startsAt: localIso(day, hour) };
}

function render(state: WeGroupsState): string {
  return renderToStaticMarkup(createElement(WeGroupsView, { state, friends: mockFriends, creating: false, draft: { title: "", memberIds: [] }, saving: false, failed: false, now: NOW, onToggleCreate: () => {}, onDraftChange: () => {}, onCreate: () => {}, onOpen: () => {} }));
}

describe("ru weekday forms", () => {
  it("puts the weekday into the accusative both prepositions need", () => {
    expect(weekdayIn(localIso(17, 20))).toBe("в четверг");
    expect(weekdayIn(localIso(19, 20))).toBe("в субботу");
    // вторник — единственный день с длинным предлогом
    expect(weekdayIn(localIso(15, 20))).toBe("во вторник");
    expect(weekdayOn(localIso(19, 14))).toBe("на субботу");
  });
});

describe("summary labels", () => {
  it("formats money with the ru thousands separator", () => {
    expect(formatRub(14200)).toBe(`${(14200).toLocaleString("ru-RU")} ₽`);
  });

  it("pluralizes «участник» by ru rules", () => {
    expect(weGroupMembersLabel(1)).toBe("1 участник");
    expect(weGroupMembersLabel(3)).toBe("3 участника");
    expect(weGroupMembersLabel(5)).toBe("5 участников");
    expect(weGroupMembersLabel(11)).toBe("11 участников");
  });

  it("names the day a group was archived", () => {
    expect(weGroupArchivedLabel("2026-09-03T12:00:00+03:00")).toContain("Архивирована");
    expect(weGroupArchivedLabel("2026-09-03T12:00:00+03:00")).toContain("сентября");
  });
});

describe("weGroupSummary", () => {
  it("counts what is ahead and adds the agreed budget", () => {
    const card = cardWith({ events: [eventAt(17, 20), eventAt(19, 14)], budgetLimitRub: 14200 });

    expect(weGroupSummary(card, NOW)).toBe(`2 события впереди · бюджет ${formatRub(14200)}`);
  });

  it("names the day of a single event and falls back to the album when there is no budget", () => {
    const card = cardWith({ events: [eventAt(17, 20)], budgetLimitRub: null, photosTotal: 62 });

    expect(weGroupSummary(card, NOW)).toBe("Событие в четверг · 62 фотографии");
  });

  it("counts saved places when nothing is ahead and names the day of a dated route", () => {
    const route = GROUPS[0].route;
    if (route === null) throw new Error("seeded group route missing");
    const places = GROUPS[0].places.slice(0, 2);
    const dated = { ...route, points: [{ ...route.points[0], at: localIso(19, 14) }, ...route.points.slice(1)] };

    expect(weGroupSummary(cardWith({ events: [], places, budgetLimitRub: null, photosTotal: 0, route: dated }), NOW)).toBe("2 места сохранено · маршрут на субботу");
    expect(weGroupSummary(cardWith({ events: [], places, budgetLimitRub: null, photosTotal: 0, route: { ...route, points: route.points.map((point) => ({ ...point, at: null })) } }), NOW)).toBe("2 места сохранено · маршрут дня");
  });

  it("ignores events that already happened", () => {
    const card = cardWith({ events: [eventAt(1, 20)], places: [], budgetLimitRub: null, photosTotal: 0, route: null });

    expect(weGroupSummary(card, NOW)).toBe("Пока пусто — добавьте событие или место");
  });

  it("says only when an archived group was archived", () => {
    const archived = GROUPS.find((card) => card.group.status === "archived");
    if (archived === undefined) throw new Error("seeded archived group missing");

    expect(weGroupSummary(archived, NOW)).toBe(weGroupArchivedLabel(archived.group.archivedAt ?? archived.group.updatedAt));
  });
});

describe("createDraftErrors", () => {
  it("requires a non-empty title", () => {
    expect(createDraftErrors({ title: "  ", memberIds: [] })).toHaveLength(1);
    expect(createDraftErrors({ title: "Поездка", memberIds: [] })).toHaveLength(0);
  });
});

describe("WeGroupsView", () => {
  it("draws its own topbar with «Создать» and the explanation of what a group is", () => {
    const html = render({ status: "ready", groups: GROUPS });

    expect(html).toContain("Создать");
    expect(html).toContain("Группа живёт дольше одного вечера");
    expect(html).toContain("Новая группа");
  });

  it("lists active groups first, archived ones under their own section, each with its summary", () => {
    const html = render({ status: "ready", groups: GROUPS });
    const active = GROUPS.filter((card) => card.group.status === "active");
    const archived = GROUPS.filter((card) => card.group.status === "archived");

    for (const card of GROUPS) expect(html).toContain(card.group.title);
    expect(html.indexOf("Архив<")).toBeGreaterThan(html.indexOf(active[0].group.title));
    expect(html).toContain("В архиве");
    expect(html).toContain(weGroupSummary(active[0], NOW));
    expect(html).toContain(weGroupSummary(archived[0], NOW));
    expect(html).toContain(weGroupMembersLabel(active[0].members.length));
  });

  it("renders loading, error and empty states", () => {
    expect(render({ status: "loading" })).toContain("Загрузка");
    expect(render({ status: "error" })).toContain("Не удалось загрузить группы.");
    expect(render({ status: "ready", groups: [] })).toContain("Пока нет групп.");
  });
});
