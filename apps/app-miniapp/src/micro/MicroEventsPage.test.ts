import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { MicroEvent } from "@max-events/api-contracts";
import { DayStrip, groupMicroEvents, microBucket, microCtaState, microDays, microRelative, microSeatsLine, microTime, MicroEventsView, MicroRow, type MicroDay, type MicroEventsState } from "./MicroEventsPage";
import { microEvents, mockFriends, mockPlaces } from "../api/mock";

const noop = () => {};
const NOW = new Date("2026-09-19T12:00:00+03:00");

/** A start at the given offset from NOW, so the buckets are asserted against a clock and not against fixtures. */
function at(offsetMs: number): string {
  return new Date(NOW.getTime() + offsetMs).toISOString();
}

const HOUR = 60 * 60 * 1000;

function event(over: Partial<MicroEvent> = {}): MicroEvent {
  return { id: "20000000-0000-4000-8000-0000000000ff", authorId: mockFriends[0].id, title: "Настолки, нужны четверо", startsAt: at(HOUR), locationText: "Кофейня «Человек и пароход»", placeId: null, participantsLimit: 6, participantsCount: 2, participantIds: [mockFriends[0].id, mockFriends[1].id], participants: [], status: "open", createdAt: "2026-08-01T12:00:00+03:00", ...over };
}

describe("microBucket", () => {
  it("puts the next hour and a half under «ЧЕРЕЗ ЧАС»", () => {
    expect(microBucket(at(15 * 60 * 1000), NOW)).toBe("soon");
    expect(microBucket(at(HOUR), NOW)).toBe("soon");
    expect(microBucket(at(80 * 60 * 1000), NOW)).toBe("soon");
  });

  it("splits the rest of the day into the afternoon and the evening", () => {
    expect(microBucket(at(3 * HOUR), NOW)).toBe("today");
    expect(microBucket(at(7 * HOUR), NOW)).toBe("evening");
  });

  it("names tomorrow and leaves everything further out as «ПОЗЖЕ»", () => {
    expect(microBucket(at(26 * HOUR), NOW)).toBe("tomorrow");
    expect(microBucket(at(72 * HOUR), NOW)).toBe("later");
  });
});

describe("groupMicroEvents", () => {
  it("drops cancelled and already started gatherings and orders each bucket by the clock", () => {
    const list = [event({ id: "20000000-0000-4000-8000-000000000101", startsAt: at(26 * HOUR) }), event({ id: "20000000-0000-4000-8000-000000000102", startsAt: at(7 * HOUR) }), event({ id: "20000000-0000-4000-8000-000000000103", startsAt: at(HOUR) }), event({ id: "20000000-0000-4000-8000-000000000104", startsAt: at(-HOUR) }), event({ id: "20000000-0000-4000-8000-000000000105", startsAt: at(8 * HOUR), status: "cancelled" })];

    const groups = groupMicroEvents(list, NOW);

    expect(groups.map((group) => group.bucket)).toEqual(["soon", "evening", "tomorrow"]);
    expect(groups.map((group) => group.label)).toEqual(["ЧЕРЕЗ ЧАС", "СЕГОДНЯ ВЕЧЕРОМ", "ЗАВТРА"]);
    expect(groups.flatMap((group) => group.events.map((item) => item.id))).toEqual(["20000000-0000-4000-8000-000000000103", "20000000-0000-4000-8000-000000000102", "20000000-0000-4000-8000-000000000101"]);
  });

  it("keeps no empty section", () => {
    expect(groupMicroEvents([], NOW)).toEqual([]);
    expect(groupMicroEvents([event({ startsAt: at(26 * HOUR) })], NOW).map((group) => group.bucket)).toEqual(["tomorrow"]);
  });
});

describe("microCtaState", () => {
  it("tells the four states of a card apart", () => {
    expect(microCtaState(event(), false)).toBe("join");
    expect(microCtaState(event(), true)).toBe("joined");
    expect(microCtaState(event({ participantsCount: 6, participantIds: mockFriends.slice(0, 6).map((friend) => friend.id) }), false)).toBe("full");
    expect(microCtaState(event({ status: "cancelled" }), false)).toBe("cancelled");
  });

  it("keeps «ты в деле» over «мест нет» for someone already inside a full gathering", () => {
    const full = event({ participantsCount: 6, participantIds: mockFriends.slice(0, 6).map((friend) => friend.id) });

    expect(microCtaState(full, true)).toBe("joined");
  });
});

describe("microDays", () => {
  it("lists the days with upcoming gatherings, today first, with a count each", () => {
    const list = [event({ id: "20000000-0000-4000-8000-000000000201", startsAt: at(HOUR) }), event({ id: "20000000-0000-4000-8000-000000000202", startsAt: at(3 * HOUR) }), event({ id: "20000000-0000-4000-8000-000000000203", startsAt: at(26 * HOUR) }), event({ id: "20000000-0000-4000-8000-000000000204", startsAt: at(-HOUR) })];

    const days: MicroDay[] = microDays(list, NOW);

    expect(days).toHaveLength(2);
    expect(days[0].key).toBe("2026-8-19");
    expect(days[0].count).toBe(2);
    expect(days[0].today).toBe(true);
    expect(days[1].key).toBe("2026-8-20");
    expect(days[1].count).toBe(1);
    expect(days[1].today).toBe(false);
  });

  it("keeps today in the strip even when nothing is on today", () => {
    const days = microDays([event({ startsAt: at(26 * HOUR) })], NOW);

    expect(days[0].key).toBe("2026-8-19");
    expect(days[0].count).toBe(0);
    expect(days).toHaveLength(2);
  });

  it("returns an empty strip when there are no gatherings at all", () => {
    expect(microDays([], NOW)).toEqual([]);
  });
});

describe("microRelative", () => {
  it("names minutes and hours until the start within the next hour", () => {
    expect(microRelative(at(15 * 60 * 1000), NOW)).toBe("через 15 мин");
    expect(microRelative(at(58 * 60 * 1000), NOW)).toBe("через 58 мин");
  });

  it("stays silent for anything an hour out or more", () => {
    expect(microRelative(at(HOUR), NOW)).toBe("");
    expect(microRelative(at(3 * HOUR), NOW)).toBe("");
    expect(microRelative(at(-10 * 60 * 1000), NOW)).toBe("");
  });
});

describe("microSeatsLine", () => {
  it("says the free seats positively and picks the right Russian plural", () => {
    expect(microSeatsLine(event({ participantsCount: 0, participantsLimit: 8 }))).toBe("8 мест свободно");
    expect(microSeatsLine(event({ participantsCount: 2, participantsLimit: 6 }))).toBe("4 места свободно");
    expect(microSeatsLine(event({ participantsCount: 5, participantsLimit: 6 }))).toBe("1 место свободно");
  });
});

describe("DayStrip", () => {
  it("renders a pill per day with its label and count, and marks today as selected", () => {
    const days = microDays(microEvents(), NOW);
    const html = renderToStaticMarkup(createElement(DayStrip, { days, selectedKey: days[0].key, onSelect: noop }));

    expect(html).toContain("app-micro-daystrip");
    expect(html).toContain("Сегодня");
    expect(days.length === 0 ? "" : html).toContain(days[1].label);
    expect(html).toContain(`app-micro-day${" app-micro-day--on"}`);
    expect([...html.matchAll(/app-micro-daycount/g)]).toHaveLength(days.length);
  });
});

describe("MicroRow", () => {
  const row = (item: MicroEvent, joined = false) => renderToStaticMarkup(createElement(MicroRow, { item, places: mockPlaces, people: mockFriends, joined, now: NOW, onOpen: noop }));

  it("renders the title, the clock column, the venue and the free-places line", () => {
    const html = row(event());

    expect(html).toContain("Настолки, нужны четверо");
    expect(html).toContain(microTime(event().startsAt));
    expect(html).toContain("Кофейня «Человек и пароход»");
    expect(html).toContain("4 места свободно");
    expect(html).toContain("Иду");
  });

  it("says «через N мин» next to the clock for a gathering starting within the hour", () => {
    expect(row(event({ startsAt: at(25 * 60 * 1000) }))).toContain("через 25 мин");
    expect(row(event({ startsAt: at(3 * HOUR) }))).not.toContain("через");
  });

  it("names a picked venue by its title instead of leaving the line empty", () => {
    expect(row(event({ locationText: null, placeId: mockPlaces[0].id }))).toContain(mockPlaces[0].title);
  });

  it("swaps the action for the state: ты в деле, мест нет, отменено", () => {
    expect(row(event(), true)).toContain("Ты идёшь");
    expect(row(event(), true)).not.toContain(">Иду<");
    expect(row(event({ participantsCount: 6, participantIds: mockFriends.slice(0, 6).map((friend) => friend.id) }))).toContain("Мест нет");
    expect(row(event({ status: "cancelled" }))).toContain("Отменено");
  });

  it("shows at most three faces and labels the stack with the names behind it", () => {
    const html = row(event({ participantsCount: 5, participantIds: mockFriends.slice(0, 5).map((friend) => friend.id) }));

    expect([...html.matchAll(/app-micro-face"/g)]).toHaveLength(3);
    expect(html).toContain(mockFriends[0].name);
  });
});

describe("MicroEventsView", () => {
  const view = (state: MicroEventsState, notice: string | null = null) => renderToStaticMarkup(createElement(MicroEventsView, { state, places: mockPlaces, people: mockFriends, viewerId: null, now: NOW, notice, onCreate: noop, onOpen: noop, onRetry: noop }));

  it("keeps the topbar, the «Собрать» pill and the lead-in line of the design", () => {
    const html = view({ status: "ready", events: microEvents() });

    expect(html).toContain("Микро-события");
    expect(html).toContain("Собрать");
    expect(html).toContain("Зовут соседи и такие же пользователи. Без билетов и организаторов — только время и место.");
  });

  it("tells the viewer when joining failed instead of silently reloading", () => {
    const html = view({ status: "ready", events: microEvents() }, "Не удалось вступить. Попробуйте ещё раз.");

    expect(html).toContain('role="status"');
    expect(html).toContain("Не удалось вступить. Попробуйте ещё раз.");
    expect(view({ status: "ready", events: microEvents() })).not.toContain("Не удалось вступить");
  });

  it("renders the seeded gatherings of the chosen day under the day strip", () => {
    const html = view({ status: "ready", events: microEvents() });

    expect(html).toContain("app-micro-daystrip");
    expect(html).not.toContain("app-micro-group-label");
    expect(html).toContain(microEvents()[0].title);
    expect(html).toContain("Сегодня");
  });

  it("carries the full gathering into the feed as «Мест нет» rather than hiding it", () => {
    const full = event({ startsAt: at(3 * HOUR), participantsCount: 6, participantIds: mockFriends.slice(0, 6).map((friend) => friend.id) });
    const html = view({ status: "ready", events: [full] });

    expect(html).toContain("Мест нет");
    expect(html).not.toContain(">Иду<");
  });

  it("renders loading, error and empty states", () => {
    expect(view({ status: "loading" })).toContain("app-skeleton");
    expect(view({ status: "error" })).toContain("Не удалось загрузить микро-события.");
    expect(view({ status: "ready", events: [] })).toContain("Пока никто ничего не собирает.");
  });
});
