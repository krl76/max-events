import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { WeGroupCard } from "../api/client";
import { listMockWeGroups, mockDemoUser, mockFriendIds } from "../api/mock";
import { WeGroupView, nameOf, weGroupBookingMeta, weGroupBudgetLine, weGroupEventWhen, weGroupGoingLabel, weGroupPeopleLabel, weGroupSinceLabel, type WeGroupState } from "./WeGroupPage";

const NOW = new Date(2026, 8, 15, 12, 0);
const GROUPS = listMockWeGroups();
function ownedGroup(): WeGroupCard {
  const found = GROUPS.find((card) => card.group.ownerUserId === mockDemoUser.id && card.group.status === "active" && card.events.length > 0);
  if (found === undefined) throw new Error("seeded owned group missing");
  return found;
}

const OWNED = ownedGroup();

function localIso(day: number, hour: number): string {
  return new Date(2026, 8, day, hour, 0).toISOString();
}

function render(over: { state?: WeGroupState; ownId?: string | null; menuOpen?: boolean; onAddPhoto?: () => void } = {}): string {
  return renderToStaticMarkup(
    createElement(WeGroupView, {
      state: over.state ?? { status: "ready", card: OWNED },
      ownId: over.ownId === undefined ? mockDemoUser.id : over.ownId,
      now: NOW,
      menuOpen: over.menuOpen ?? false,
      picker: null,
      pickerEvents: [],
      pickerPlaces: [],
      pickerLoading: false,
      actionFailed: false,
      onBack: () => {},
      onToggleMenu: () => {},
      onTogglePicker: () => {},
      onClosePicker: () => {},
      onPick: () => {},
      onArchive: () => {},
      onChat: () => {},
      onVote: () => {},
      onOpenEvent: () => {},
      onOpenPlace: () => {},
      onOpenMap: () => {},
      onAddPhoto: over.onAddPhoto,
    }),
  );
}

describe("group header labels", () => {
  it("names the month the company started", () => {
    expect(weGroupSinceLabel(localIso(1, 12))).toBe("с сентября 2026");
    expect(weGroupPeopleLabel(5, localIso(1, 12))).toBe("5 участников · с сентября 2026");
  });
});

describe("weGroupGoingLabel", () => {
  it("writes collective numerals up to seven and «все» once everyone is in", () => {
    expect(weGroupGoingLabel(4, 5)).toBe("идут четверо");
    expect(weGroupGoingLabel(2, 5)).toBe("идут двое");
    expect(weGroupGoingLabel(1, 5)).toBe("идёт один");
    expect(weGroupGoingLabel(5, 5)).toBe("идут все");
    expect(weGroupGoingLabel(9, 12)).toBe("идут 9");
    expect(weGroupGoingLabel(0, 5)).toBe("пока никто не идёт");
  });
});

describe("weGroupEventWhen", () => {
  it("says «Сегодня» for today and the short weekday otherwise", () => {
    expect(weGroupEventWhen(localIso(15, 20), NOW)).toContain("Сегодня");
    expect(weGroupEventWhen(localIso(19, 14), NOW)).not.toContain("Сегодня");
    expect(weGroupEventWhen(localIso(19, 14), NOW)).toContain("Сб");
  });
});

describe("weGroupBookingMeta", () => {
  const base = OWNED.events[0];

  it("reads the window off the event and says whether it was paid for", () => {
    const paid = weGroupBookingMeta({ ...base, startsAt: localIso(19, 14), endsAt: localIso(19, 17), isPaid: true, priceRub: 700 });
    expect(paid).toBe("Сб 14:00–17:00 · оплачено");

    const free = weGroupBookingMeta({ ...base, startsAt: localIso(19, 14), endsAt: null, isPaid: false, priceRub: null });
    expect(free).toBe("Сб 14:00 · бесплатно");
  });
});

describe("weGroupBudgetLine", () => {
  it("fills the bar against the agreed ceiling and leaves the rest free", () => {
    const line = weGroupBudgetLine(9800, 14200);

    expect(line.spent).toBe(`потрачено ${(9800).toLocaleString("ru-RU")} из ${(14200).toLocaleString("ru-RU")} ₽`);
    expect(line.percent).toBe(69);
    expect(line.value).toBe(`${(4400).toLocaleString("ru-RU")} ₽`);
    expect(line.note).toBe("свободно на ближайшие события");
  });

  it("drops the bar without a ceiling and never shows a negative remainder", () => {
    const noLimit = weGroupBudgetLine(9800, null);
    expect(noLimit.percent).toBeNull();
    expect(noLimit.spent).toBeNull();
    expect(noLimit.value).toBe(`${(9800).toLocaleString("ru-RU")} ₽`);

    const overspent = weGroupBudgetLine(20000, 14200);
    expect(overspent.percent).toBe(100);
    expect(overspent.value).toBe("0 ₽");
  });
});

describe("nameOf", () => {
  it("calls the viewer «Ты» and an unknown id «Участник»", () => {
    expect(nameOf(OWNED.members, mockDemoUser.id, mockDemoUser.id)).toBe("Ты");
    expect(nameOf(OWNED.members, mockFriendIds[3], mockDemoUser.id)).not.toBe("Ты");
    expect(nameOf(OWNED.members, "unknown", mockDemoUser.id)).toBe("Участник");
  });
});

describe("WeGroupView", () => {
  it("reads as one group: the six blocks под общей шапкой, а не шесть отдельных списков", () => {
    const html = render();

    expect(html).toContain(OWNED.group.title);
    expect(html).toContain(weGroupPeopleLabel(OWNED.members.length, OWNED.group.createdAt));
    for (const title of ["Общий бюджет", "Ближайшие события", "Места компании", "Маршрут дня", "Фотографии"]) expect(html).toContain(title);
    expect(html).toContain("Голосование");
    expect(html).toContain("Архивировать группу");
  });

  it("prints the budget hero from the aggregate and the agreed ceiling", () => {
    const line = weGroupBudgetLine(OWNED.budget?.totalRub ?? 0, OWNED.budgetLimitRub);
    const html = render();

    expect(html).toContain(line.value);
    expect(html).toContain(line.note);
    if (line.spent !== null) expect(html).toContain(line.spent);
  });

  it("lists the bound events, places and photos of the group", () => {
    const html = render();

    for (const event of OWNED.events) expect(html).toContain(event.title);
    for (const place of OWNED.places) expect(html).toContain(place.title);
    expect(html).toContain(`Все ${OWNED.photosTotal}`);
  });

  it("offers the owner menu only while the group is active", () => {
    const menu = render({ menuOpen: true });
    expect(menu).toContain("Добавить событие");
    expect(menu).toContain("Добавить место");

    const archived: WeGroupCard = { ...OWNED, group: { ...OWNED.group, status: "archived", archivedAt: localIso(1, 12) } };
    const html = render({ state: { status: "ready", card: archived }, menuOpen: true });
    expect(html).toContain("Группа в архиве");
    expect(html).not.toContain("Архивировать группу");
    expect(html).not.toContain("Добавить место");
  });

  it("still lets a member add a photo to an archived group", () => {
    const archived: WeGroupCard = { ...OWNED, group: { ...OWNED.group, status: "archived", archivedAt: localIso(1, 12) } };
    const html = render({ state: { status: "ready", card: archived }, onAddPhoto: () => {} });
    expect(html).toContain("Добавить фото");
  });

  it("hides the archive action from a member who does not own the group", () => {
    const html = render({ ownId: mockFriendIds[3] });

    expect(html).not.toContain("Архивировать группу");
  });

  it("renders loading, forbidden and error states", () => {
    expect(render({ state: { status: "loading" } })).toContain("Загрузка");
    expect(render({ state: { status: "forbidden" } })).toContain("Нет доступа к группе.");
    expect(render({ state: { status: "error" } })).toContain("Не удалось загрузить группу.");
  });
});
