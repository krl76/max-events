import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildShareText, suggestEvents, WheretoView, type WheretoState } from "./WheretoPage";
import { mockEvents } from "../api/mock";
import type { ShareChannel } from "../max/bridge";
import type { Event, WheretoQuery } from "@max-events/api-contracts";

const query = (over: Partial<WheretoQuery> = {}): WheretoQuery => ({ company: "alone", mood: "active", budget: "any", ...over });

const noop = () => {};

function viewHtml(state: WheretoState, over: { events?: Event[]; shared?: ShareChannel | null } = {}): string {
  return renderToStaticMarkup(
    createElement(WheretoView, {
      state,
      events: over.events ?? [],
      shared: over.shared ?? null,
      onCompany: noop,
      onMood: noop,
      onBudget: noop,
      onShow: noop,
      onRestart: noop,
      onShare: noop,
      onOpenEvent: noop,
      onCreateVote: noop,
    }),
  );
}

describe("suggestEvents", () => {
  it("caps the result at 5 events sorted by start time", () => {
    const result = suggestEvents(mockEvents, query());

    expect(result).toHaveLength(5);
    const starts = result.map((item) => item.startsAt);
    expect([...starts].sort((a, b) => a.localeCompare(b))).toEqual(starts);
  });

  it("maps mood to categories (calm -> afisha only)", () => {
    const result = suggestEvents(mockEvents, query({ mood: "calm" }));

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((item) => item.category === "afisha")).toBe(true);
  });

  it("budget free keeps only unpaid events", () => {
    const result = suggestEvents(mockEvents, query({ mood: "unusual", budget: "free" }));

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((item) => item.priceRub === null)).toBe(true);
  });

  it("budget under_3000 keeps free and cheap events", () => {
    const result = suggestEvents(mockEvents, query({ mood: "unusual", budget: "under_3000" }));

    expect(result.every((item) => item.priceRub === null || item.priceRub <= 3000)).toBe(true);
  });

  it("company partner drops volunteering, kids caps the price", () => {
    const partner = suggestEvents(mockEvents, query({ mood: "unusual", company: "partner" }));
    const kids = suggestEvents(mockEvents, query({ mood: "unusual", company: "kids", budget: "any" }));

    expect(partner.every((item) => item.category !== "volunteering")).toBe(true);
    expect(kids.every((item) => (item.priceRub ?? 0) <= 3000)).toBe(true);
  });

  it("a different mood changes the result", () => {
    expect(suggestEvents(mockEvents, query({ mood: "active" })).map((item) => item.id)).not.toEqual(suggestEvents(mockEvents, query({ mood: "unusual" })).map((item) => item.id));
  });
});

describe("buildShareText", () => {
  it("numbers the events with their start time", () => {
    const text = buildShareText(mockEvents.slice(0, 2));

    expect(text).toContain("Куда пойдём? Подборка MAX Events:");
    expect(text).toContain(`1. ${mockEvents[0].title} — `);
    expect(text).toContain(`2. ${mockEvents[1].title} — `);
  });
});

describe("WheretoView", () => {
  it("renders the four company options on step 1", () => {
    const html = viewHtml({ step: "company" });

    expect(html).toContain("Я один");
    expect(html).toContain("С друзьями");
    expect(html).toContain("С девушкой");
    expect(html).toContain("С детьми");
  });

  it("renders mood and budget chips with the show button disabled until both chosen", () => {
    const html = viewHtml({ step: "context", company: "friends", mood: null, budget: null });

    expect(html).toContain("С друзьями");
    expect(html).toContain("Активное");
    expect(html).toContain("Спокойное");
    expect(html).toContain("Необычное");
    expect(html).toContain("Любой");
    expect(html).toContain("Бесплатное");
    expect(html).toContain("До 3000 ₽");
    expect(html).toContain("Показать подборку");
    expect(html).toContain("disabled");
  });

  it("renders the result cards, the share CTA and the query context", () => {
    const result = suggestEvents(mockEvents, query({ mood: "unusual", company: "friends", budget: "under_3000" }));
    const html = viewHtml({ step: "result", query: query({ mood: "unusual", company: "friends", budget: "under_3000" }) }, { events: result });

    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(5);
    expect(html).toContain("Ваша подборка");
    expect(html).toContain("С друзьями · Необычное · До 3000 ₽");
    for (const item of result) expect(html).toContain(item.title);
    expect(html).toContain("Отправить друзьям");
    expect(html).toContain("Начать заново");
  });

  it("renders the empty state without a share CTA", () => {
    const html = viewHtml({ step: "result", query: query() }, { events: [] });

    expect(html).toContain("Ничего не нашлось");
    expect(html).not.toContain("Отправить друзьям");
  });

  it("offers the vote creation CTA only when at least two events are suggested", () => {
    const events = suggestEvents(mockEvents, query());
    const enough = viewHtml({ step: "result", query: query() }, { events });
    const single = viewHtml({ step: "result", query: query() }, { events: events.slice(0, 1) });

    expect(enough).toContain("Голосование с друзьями");
    expect(single).not.toContain("Голосование с друзьями");
  });

  it("renders share feedback per channel", () => {
    const events = suggestEvents(mockEvents, query());
    const bridge = viewHtml({ step: "result", query: query() }, { events, shared: "bridge" });
    const clipboard = viewHtml({ step: "result", query: query() }, { events, shared: "clipboard" });
    const manual = viewHtml({ step: "result", query: query() }, { events, shared: "unavailable" });

    expect(bridge).toContain("экран отправки открыт");
    expect(clipboard).toContain("скопирована");
    expect(manual).toContain(buildShareText(events));
  });
});
