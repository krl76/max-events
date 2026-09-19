import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildShareText, WheretoView, wizardStepIndex, type WheretoState } from "./WheretoPage";
import { mockEvents } from "../api/mock";
import type { ShareChannel } from "../max/bridge";
import type { Event, WheretoQuery } from "@max-events/api-contracts";

const query = (over: Partial<WheretoQuery> = {}): WheretoQuery => ({ company: "alone", mood: "active", budget: "any", ...over });

const noop = () => {};

function viewHtml(state: WheretoState, over: { events?: Event[]; shared?: ShareChannel | null; status?: "loading" | "error" | "ready" } = {}): string {
  return renderToStaticMarkup(
    createElement(WheretoView, {
      state,
      events: over.events ?? [],
      status: over.status ?? "ready",
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

    expect(html).toContain("Шаг 1 из 3");
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
    const events = mockEvents.slice(0, 2);
    const html = viewHtml({ step: "result", query: query({ mood: "unusual", company: "friends", budget: "under_3000" }) }, { events });

    expect(html).toContain("Ваша подборка");
    expect(html).toContain("С друзьями · Необычное · До 3000 ₽");
    for (const item of events) expect(html).toContain(item.title);
    expect(html).toContain("Отправить друзьям");
    expect(html).toContain("Начать заново");
  });

  it("renders the empty state without a share CTA", () => {
    const html = viewHtml({ step: "result", query: query() }, { events: [] });

    expect(html).toContain("Ничего не нашлось");
    expect(html).not.toContain("Отправить друзьям");
  });

  it("renders loading and error states via AppState instead of cards", () => {
    const loading = viewHtml({ step: "result", query: query() }, { status: "loading" });
    const failed = viewHtml({ step: "result", query: query() }, { status: "error" });

    expect(loading).toContain("Загрузка");
    expect(loading).not.toContain("Отправить друзьям");
    expect(failed).toContain("Не удалось загрузить подборку");
    expect(failed).not.toContain("Отправить друзьям");
  });

  it("offers the vote creation CTA only when at least two events are suggested", () => {
    const events = mockEvents.slice(0, 2);
    const enough = viewHtml({ step: "result", query: query() }, { events });
    const single = viewHtml({ step: "result", query: query() }, { events: events.slice(0, 1) });

    expect(enough).toContain("Голосование с друзьями");
    expect(single).not.toContain("Голосование с друзьями");
  });

  it("renders share feedback per channel", () => {
    const events = mockEvents.slice(0, 2);
    const bridge = viewHtml({ step: "result", query: query() }, { events, shared: "bridge" });
    const clipboard = viewHtml({ step: "result", query: query() }, { events, shared: "clipboard" });
    const manual = viewHtml({ step: "result", query: query() }, { events, shared: "unavailable" });

    expect(bridge).toContain("экран отправки открыт");
    expect(clipboard).toContain("скопирована");
    expect(manual).toContain(buildShareText(events));
  });
});

describe("wizardStepIndex", () => {
  it("maps the wizard steps to 0-based progress positions", () => {
    expect(wizardStepIndex({ step: "company" })).toBe(0);
    expect(wizardStepIndex({ step: "context", company: "alone", mood: null, budget: null })).toBe(1);
    expect(wizardStepIndex({ step: "result", query: { company: "alone", mood: "calm", budget: "any" } })).toBe(2);
    expect(wizardStepIndex({ step: "vote", query: { company: "alone", mood: "calm", budget: "any" } })).toBe(2);
  });
});
