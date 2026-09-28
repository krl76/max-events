import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mockEvents } from "../api/mock";
import { cityWalkAsk, nextWalkAsk, walkBudgetLabel, walkBudgetRub, walkClock, walkSpanLabel, walkSpanMinutes, WalkPage, WalkView } from "./WalkPage";
import { EMPTY_WALK_CHOICE, selectWalkBudget, selectWalkTime, toggleWalkInterest, walkComposeReady, WalkWizard } from "./WalkWizard";

describe("city walk query", () => {
  it("asks for sights in the selected city, and a later ask asks for a different route", () => {
    expect(cityWalkAsk("Тула")).toContain("Тула");
    expect(cityWalkAsk("Тула")).toContain("достопримечательностям");
    expect(nextWalkAsk("Тула")).toContain("другой");
    expect(nextWalkAsk("Тула")).not.toBe(cityWalkAsk("Тула"));
  });
});

describe("walk totals", () => {
  it("sums ticket prices and labels a free route", () => {
    expect(walkBudgetRub([{ event: { priceRub: 400 } }, { event: { priceRub: null } }])).toBe(400);
    expect(walkBudgetLabel(0)).toBe("Бесплатно");
    expect(walkBudgetLabel(1200)).toContain("200");
    expect(walkBudgetLabel(1200)).toContain("₽");
  });

  it("reads the span between the first and last stop", () => {
    expect(walkSpanMinutes([{ at: "2026-09-27T09:00:00" }, { at: "2026-09-27T10:53:00" }])).toBe(113);
    expect(walkSpanLabel(113)).toBe("1 ч 53 мин");
    expect(walkSpanLabel(null)).toBe("пешком");
    expect(walkClock("2026-09-27T09:00:00")).toMatch(/09:00/);
  });
});

describe("WalkView", () => {
  it("shows the reference title and the new-walk action once a draft is ready", () => {
    const event = { ...mockEvents[0], title: "Тульский кремль", city: "Тула", priceRub: 0, isPaid: false, paymentUrl: null, ratingAverage: 4.8 };
    const html = renderToStaticMarkup(
      createElement(WalkView, {
        city: "Тула",
        onBack: () => {},
        onAnother: () => {},
        state: {
          status: "ready",
          day: {
            summary: "Кремль и набережная",
            date: "2026-09-27",
            plan: null,
            planDraft: { eventId: event.id, participantIds: [], meetingPoint: "Кремль", meetingAt: event.startsAt },
            stops: [{ at: event.startsAt, explanation: "Начать с кремля", event }],
          },
        },
      }),
    );

    expect(html).toContain("Маршрут выходного дня: Тула");
    expect(html).toContain("Тульский кремль");
    expect(html).toContain("Хочу новую прогулку");
  });
});

describe("walk wizard", () => {
  it("shows time first and does not start a walk request", () => {
    const html = renderToStaticMarkup(createElement(WalkPage, { city: "Тула" }));
    expect(html).toContain("1 час");
    expect(html).toContain("2 часа");
    expect(html).toContain("Полдня");
    expect(html).toContain("Своё");
    expect(html).toContain("disabled");
    expect(html).not.toContain("Собираем прогулку");
    expect(html).not.toContain("Бесплатно");
  });

  it("enables compose only after time, budget, and one interest", () => {
    const timed = selectWalkTime(EMPTY_WALK_CHOICE, 120);
    const budgeted = selectWalkBudget(timed, "any");
    const ready = toggleWalkInterest(budgeted, "cultural");
    expect(walkComposeReady(EMPTY_WALK_CHOICE)).toBe(false);
    expect(walkComposeReady(timed)).toBe(false);
    expect(walkComposeReady(budgeted)).toBe(false);
    expect(walkComposeReady(ready)).toBe(true);
    const html = renderToStaticMarkup(createElement(WalkWizard, { city: "Тула", choice: ready, onChange: () => {}, onBack: () => {} }));
    expect(html).toContain("Культурные");
    expect(html).toContain("Собрать прогулку");
    expect(html).not.toContain("disabled");
  });
 });
