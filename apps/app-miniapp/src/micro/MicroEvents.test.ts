import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { joinedMicroEvents, microDraftReady, microWhere, MicroCard, MicroEventCreateView, type MicroDraft } from "./MicroEvents";
import { joinMockMicroEvent, microEvents, mockDemoUser, mockPlaces, resetMockMicroEvents } from "../api/mock";

const events = microEvents();
const noop = () => {};

const readyDraft: MicroDraft = { title: "Играем в баскетбол", when: "2026-09-19T19:00", where: "Стритбол-площадка", limit: "6" };

describe("microWhere", () => {
  it("prefers locationText and falls back to the picked place title", () => {
    const withText = events.find((item) => item.locationText !== null)!;
    const withPlace = events.find((item) => item.placeId !== null)!;

    expect(microWhere(withText, mockPlaces)).toBe(withText.locationText);
    expect(microWhere(withPlace, mockPlaces)).toBe(mockPlaces.find((place) => place.id === withPlace.placeId)!.title);
  });
});

describe("MicroCard", () => {
  const card = (over: { joined?: boolean } = {}) => renderToStaticMarkup(createElement(MicroCard, { item: events[0], places: mockPlaces, joined: over.joined ?? false, onJoin: noop, onLeave: noop }));

  it("renders the badge, title, where line and the participants counter", () => {
    const html = card();

    expect(html).toContain("Микро");
    expect(html).toContain(events[0].title);
    expect(html).toContain(microWhere(events[0], mockPlaces));
    expect(html).toContain(`${events[0].participantsCount}/${events[0].participantsLimit}`);
    expect(html).toContain("Присоединиться");
  });

  it("switches between the join and joined states", () => {
    expect(card({ joined: true })).toContain("Выйти");
    expect(card({ joined: true })).not.toContain("Присоединиться");
  });

  it("disables joining when the counter reached the limit", () => {
    const full = { ...events[0], participantsCount: events[0].participantsLimit };
    const html = renderToStaticMarkup(createElement(MicroCard, { item: full, places: mockPlaces, joined: false, onJoin: noop, onLeave: noop }));

    expect(html).toContain("Мест нет");
    expect(html).toContain("disabled");
  });
});

describe("microDraftReady", () => {
  it("requires every one of the four fields with a positive limit", () => {
    expect(microDraftReady(readyDraft)).toBe(true);
    expect(microDraftReady({ ...readyDraft, title: "  " })).toBe(false);
    expect(microDraftReady({ ...readyDraft, when: "" })).toBe(false);
    expect(microDraftReady({ ...readyDraft, where: "" })).toBe(false);
    expect(microDraftReady({ ...readyDraft, limit: "0" })).toBe(false);
    expect(microDraftReady({ ...readyDraft, limit: "" })).toBe(false);
  });
});

describe("MicroEventCreateView", () => {
  const view = (over: { draft?: MicroDraft; submitting?: boolean; failed?: boolean } = {}) => renderToStaticMarkup(createElement(MicroEventCreateView, { draft: over.draft ?? { title: "", when: "", where: "", limit: "6" }, places: mockPlaces, submitting: over.submitting ?? false, failed: over.failed ?? false, onChange: noop, onSubmit: noop }));

  it("renders exactly four inputs and offers mock places in the datalist", () => {
    const html = view();

    expect(html).toContain("Что делаем");
    expect(html).toContain("Когда");
    expect(html).toContain("Где");
    expect(html).toContain("Лимит участников");
    expect(html).toContain("Адрес или карта");
    expect(html).toContain("Пригласить друзей");
    expect(html).not.toContain('type="datetime-local"');
  });

  it("keeps publish disabled until the draft is ready and shows submitting and failure states", () => {
    expect(view()).toContain("Создать микрособытие");
    expect(view()).toContain("disabled");
    expect(view({ draft: readyDraft })).toContain("Создать микрособытие");
    expect(view({ draft: readyDraft, submitting: true })).toContain("Публикуем…");
    expect(view({ draft: readyDraft, failed: true })).toContain("Не удалось опубликовать микро-событие.");
  });
});

describe("joinedMicroEvents", () => {
  afterEach(resetMockMicroEvents);

  it("reads membership from the answer, so it no longer dies with the page", () => {
    const target = microEvents()[0];
    const before = new Date(Date.parse(target.startsAt) - 3_600_000);

    expect(joinedMicroEvents(microEvents(), mockDemoUser.id, before)).toEqual([]);
    joinMockMicroEvent(target.id, mockDemoUser.id);
    // A fresh list — as after a reload — still knows the viewer is in.
    expect(joinedMicroEvents(microEvents(), mockDemoUser.id, before).map((item) => item.id)).toEqual([target.id]);
  });

  it("keeps only what is joined and still ahead, soonest first", () => {
    // Заполненный сбор не принимает новых, поэтому в своих оказываются только те, где ещё есть место.
    const all = microEvents().filter((item) => item.participantsCount < item.participantsLimit);
    for (const item of all) joinMockMicroEvent(item.id, mockDemoUser.id);
    const byStart = [...all].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

    expect(joinedMicroEvents(microEvents(), mockDemoUser.id, new Date(0)).map((item) => item.id)).toEqual(byStart.map((item) => item.id));
    // Only the second one is still ahead of a viewer standing between the two earliest starts.
    const between = new Date(Date.parse(byStart[0].startsAt) + 1);
    expect(joinedMicroEvents(microEvents(), mockDemoUser.id, between).map((item) => item.id)).toEqual(byStart.slice(1).map((item) => item.id));
    // Nothing belongs to a viewer who is not signed in, and nothing that has already started shows up.
    expect(joinedMicroEvents(microEvents(), null, new Date(0))).toEqual([]);
    expect(joinedMicroEvents(microEvents(), mockDemoUser.id, new Date("2099-01-01T00:00:00Z"))).toEqual([]);
  });

  it("drops a cancelled micro-event even from the one who joined it", () => {
    const target = microEvents()[0];
    joinMockMicroEvent(target.id, mockDemoUser.id);
    const cancelled = microEvents().map((item) => (item.id === target.id ? { ...item, status: "cancelled" as const } : item));

    expect(joinedMicroEvents(cancelled, mockDemoUser.id, new Date(0)).some((item) => item.id === target.id)).toBe(false);
  });
});
