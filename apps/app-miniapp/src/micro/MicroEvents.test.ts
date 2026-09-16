import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { microDraftReady, microWhere, MicroCard, MicroEventCreateView, type MicroDraft } from "./MicroEvents";
import { microEvents, mockPlaces } from "../api/mock";

const events = microEvents();
const noop = () => {};

const readyDraft: MicroDraft = { title: "Играем в баскетбол", when: "2026-09-19T19:00", where: "Стритбол-площадка", limit: "6" };

describe("microWhere", () => {
  it("prefers locationText and falls back to the picked mock place title", () => {
    const withText = events.find((item) => item.locationText !== null)!;
    const withPlace = events.find((item) => item.placeId !== null)!;

    expect(microWhere(withText)).toBe(withText.locationText);
    expect(microWhere(withPlace)).toBe(mockPlaces.find((place) => place.id === withPlace.placeId)!.title);
  });
});

describe("MicroCard", () => {
  const card = (over: { joined?: boolean } = {}) => renderToStaticMarkup(createElement(MicroCard, { item: events[0], joined: over.joined ?? false, onJoin: noop, onLeave: noop }));

  it("renders the badge, title, where line and the participants counter", () => {
    const html = card();

    expect(html).toContain("Микро");
    expect(html).toContain(events[0].title);
    expect(html).toContain(microWhere(events[0]));
    expect(html).toContain(`${events[0].participantsCount}/${events[0].participantsLimit}`);
    expect(html).toContain("Присоединиться");
  });

  it("switches between the join and joined states", () => {
    expect(card({ joined: true })).toContain("Вы участвуете");
    expect(card({ joined: true })).not.toContain("Присоединиться");
  });

  it("disables joining when the counter reached the limit", () => {
    const full = { ...events[0], participantsCount: events[0].participantsLimit };
    const html = renderToStaticMarkup(createElement(MicroCard, { item: full, joined: false, onJoin: noop, onLeave: noop }));

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

    expect(html.match(/<input/g)).toHaveLength(4);
    expect(html).toContain("Что делаем");
    expect(html).toContain("Когда");
    expect(html).toContain("Где");
    expect(html).toContain("Лимит участников");
    expect(html).toContain('type="datetime-local"');
    for (const place of mockPlaces) expect(html).toContain(`value="${place.title}"`);
  });

  it("keeps publish disabled until the draft is ready and shows submitting and failure states", () => {
    expect(view()).toContain("disabled");
    expect(view({ draft: readyDraft })).not.toContain("disabled");
    expect(view({ draft: readyDraft, submitting: true })).toContain("Публикуем…");
    expect(view({ draft: readyDraft, failed: true })).toContain("Не удалось опубликовать микро-событие.");
  });
});
