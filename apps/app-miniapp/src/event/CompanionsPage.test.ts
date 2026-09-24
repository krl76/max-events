import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { EventCompanion, EventCompanions } from "../api/client";
import { mockEvents } from "../api/mock";
import { CompanionCard, CompanionsView, companionMeta, gatheringLine, matchesBadge, myStatusLine, tabCount, tabOfStatus } from "./CompanionsPage";

const companionOf = (over: Partial<EventCompanion> = {}): EventCompanion => ({
  friend: { id: "a1", name: "Катя Лебедева", avatarUrl: null },
  status: "looking_for_company",
  chatTitle: "Двор",
  sharedPlansCount: 5,
  matchesCount: 3,
  interests: ["джаз", "концерты", "ночная жизнь"],
  note: "Иду одна, была на прошлом концерте — огонь. Кто со мной к сцене?",
  ...over,
});

const companionsOf = (over: Partial<EventCompanions> = {}): EventCompanions => ({
  counts: { going: 14, wants: 7, looking: 3 },
  myStatus: "looking_for_company",
  companions: [companionOf(), companionOf({ friend: { id: "a2", name: "Сергей Ильин", avatarUrl: null }, chatTitle: "Падел", sharedPlansCount: 0, matchesCount: 1, interests: [], note: null })],
  gathering: null,
  ...over,
});

const noop = () => {};

const viewProps = {
  event: { ...mockEvents[0], title: "Вечер Рахманинова" },
  companions: companionsOf(),
  failed: false,
  tab: "looking" as const,
  pickerOpen: false,
  onTab: noop,
  onBack: noop,
  onGather: noop,
  onToggleLooking: noop,
  onTogglePicker: noop,
  onStatus: noop,
  onInvite: noop,
  onChat: noop,
  onRetry: noop,
};

describe("tabOfStatus and tabCount", () => {
  it("folds the six statuses into the three tabs of the design", () => {
    expect(tabOfStatus("going")).toBe("going");
    expect(tabOfStatus("wants_to_go")).toBe("wants");
    expect(tabOfStatus("probably_going")).toBe("wants");
    expect(tabOfStatus("looking_for_company")).toBe("looking");
    expect(tabOfStatus("looking_for_travel_buddy")).toBe("looking");
    expect(tabOfStatus("looking_for_after_event_company")).toBe("looking");
  });

  it("reads the counter of each tab from the aggregate", () => {
    const companions = companionsOf();

    expect(tabCount(companions, "going")).toBe(14);
    expect(tabCount(companions, "wants")).toBe(7);
    expect(tabCount(companions, "looking")).toBe(3);
  });
});

describe("companionMeta and matchesBadge", () => {
  it("spends the expanded line on shared plans and the compact one on matches", () => {
    expect(companionMeta(companionOf(), true)).toBe("Из чата «Двор» · 5 общих планов");
    expect(companionMeta(companionOf({ sharedPlansCount: 1 }), true)).toContain("1 общий план");
    expect(companionMeta(companionOf({ chatTitle: "Падел", matchesCount: 1 }), false)).toBe("Из чата «Падел» · 1 совпадение");
  });

  it("says out loud when somebody is outside your chats", () => {
    expect(companionMeta(companionOf({ chatTitle: null, matchesCount: 2 }), false)).toBe("Не в твоих чатах · 2 совпадения");
  });

  it("declines the badge and drops it below one match", () => {
    expect(matchesBadge(3)).toBe("3 СОВПАДЕНИЯ");
    expect(matchesBadge(1)).toBe("1 СОВПАДЕНИЕ");
    expect(matchesBadge(0)).toBeNull();
  });
});

describe("gatheringLine and myStatusLine", () => {
  it("counts the people past the faces and keeps the meeting note", () => {
    expect(gatheringLine("Катя, Сергей", 2, "у входа в 19:30")).toBe("Катя, Сергей и ещё 2 договариваются встретиться у входа в 19:30");
    expect(gatheringLine("Катя, Сергей", 0, "у входа в 19:30")).toBe("Катя, Сергей договариваются встретиться у входа в 19:30");
  });

  it("names the viewer status and admits when there is none", () => {
    expect(myStatusLine("looking_for_company")).toBe("Мой статус: ищу компанию");
    expect(myStatusLine(null)).toBe("Мой статус: не выбран");
  });
});

describe("CompanionCard", () => {
  it("expands a person who left a note: their line, interests and «Позвать в план»", () => {
    const html = renderToStaticMarkup(createElement(CompanionCard, { companion: companionOf(), onInvite: noop, onChat: noop }));

    expect(html).toContain("Катя Лебедева");
    expect(html).toContain("Из чата «Двор» · 5 общих планов");
    expect(html).toContain("3 СОВПАДЕНИЯ");
    expect(html).toContain("Кто со мной к сцене?");
    expect(html).toContain("джаз");
    expect(html).toContain("Позвать в план");
  });

  it("keeps a person without a note in one compact row", () => {
    const html = renderToStaticMarkup(createElement(CompanionCard, { companion: companionOf({ note: null, chatTitle: "Падел", matchesCount: 1 }), onInvite: noop, onChat: noop }));

    expect(html).toContain("app-evc-row");
    expect(html).toContain("Из чата «Падел» · 1 совпадение");
    expect(html).toContain("Позвать");
    expect(html).not.toContain("Позвать в план");
  });
});

describe("CompanionsView", () => {
  it("draws the topbar with the event title, the three tabs and the status card", () => {
    const html = renderToStaticMarkup(createElement(CompanionsView, viewProps));

    expect(html).toContain("С кем пойти");
    expect(html).toContain("Вечер Рахманинова");
    expect(html).toContain("Идут · 14");
    expect(html).toContain("Хотят · 7");
    expect(html).toContain("Ищут · 3");
    expect(html).toContain("Мой статус: ищу компанию");
    expect(html).toContain("Видят только участники события");
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("Тоже ищут компанию");
  });

  it("filters the list by the selected tab", () => {
    const html = renderToStaticMarkup(createElement(CompanionsView, { ...viewProps, tab: "going" as const }));

    expect(html).toContain("Уже идут");
    expect(html).toContain("Здесь пока никого");
    expect(html).not.toContain("Катя Лебедева");
  });

  it("opens the six-status picker only when it is asked for", () => {
    const closed = renderToStaticMarkup(createElement(CompanionsView, viewProps));
    const open = renderToStaticMarkup(createElement(CompanionsView, { ...viewProps, pickerOpen: true }));

    expect(closed).not.toContain("Ищу попутчика");
    expect(open).toContain("Ищу попутчика");
    expect(open).toContain("Скорее всего пойду");
  });

  it("shows the gathering teaser with the faces and the way in", () => {
    const gathering = { members: [{ id: "a1", name: "Катя Лебедева", avatarUrl: null }], extraCount: 2, meetingNote: "у входа в 19:30" };
    const html = renderToStaticMarkup(createElement(CompanionsView, { ...viewProps, companions: companionsOf({ gathering }) }));

    expect(html).toContain("Собирается компания");
    expect(html).toContain("у входа в 19:30");
    expect(html).toContain("+2");
    expect(html).toContain("Присоединиться");
  });

  it("offers a retry instead of an empty list when the load failed", () => {
    const html = renderToStaticMarkup(createElement(CompanionsView, { ...viewProps, companions: null, failed: true }));

    expect(html).toContain("Не удалось загрузить участников.");
    expect(html).toContain("Повторить");
  });
});
