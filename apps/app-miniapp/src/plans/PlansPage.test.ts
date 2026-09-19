import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { formatDistance, planMeetingLabel, planParticipantsLabel, PlansPage, PlansView, type PlansState } from "./PlansPage";
import { planCards } from "../api/mock";

const CARDS = planCards();

describe("planParticipantsLabel", () => {
  it("pluralizes «друг» by ru rules like the README example", () => {
    expect(planParticipantsLabel(1)).toBe("Ты + 1 друг");
    expect(planParticipantsLabel(3)).toBe("Ты + 3 друга");
    expect(planParticipantsLabel(5)).toBe("Ты + 5 друзей");
    expect(planParticipantsLabel(11)).toBe("Ты + 11 друзей");
    expect(planParticipantsLabel(12)).toBe("Ты + 12 друзей");
    expect(planParticipantsLabel(22)).toBe("Ты + 22 друга");
  });
});

describe("formatDistance", () => {
  it("formats meters under a kilometer and kilometers above it", () => {
    expect(formatDistance(850)).toBe("850 м");
    expect(formatDistance(1200)).toBe("1,2 км");
    expect(formatDistance(0)).toBe("0 м");
  });
});

describe("planMeetingLabel", () => {
  it("joins the meeting time and point like the README example «Сбор 18:20 у метро»", () => {
    const card = CARDS.find((item) => item.plan.meetingPoint.startsWith("у метро"))!;

    expect(planMeetingLabel(card.plan)).toBe(`Сбор ${new Date(card.plan.meetingAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} ${card.plan.meetingPoint}`);
    expect(planMeetingLabel(card.plan)).toMatch(/^Сбор \d{2}:\d{2} у метро/);
  });
});

describe("PlansView", () => {
  it("renders every card per the README example: event, participants, meeting, distance", () => {
    const html = renderToStaticMarkup(createElement(PlansView, { state: { status: "ready", cards: CARDS }, onOpen: () => {}, onExplore: () => {} }));

    for (const card of CARDS) {
      expect(html).toContain(card.event.title);
      expect(html).toContain(planParticipantsLabel(card.plan.participants.length));
      expect(html).toContain(planMeetingLabel(card.plan));
      expect(html).toContain(`${formatDistance(card.distanceMeters)} от тебя`);
    }
  });

  it("renders the first card as a link to the plan screen", () => {
    const html = renderToStaticMarkup(createElement(PlansView, { state: { status: "ready", cards: [CARDS[0]] }, onOpen: () => {}, onExplore: () => {} }));

    expect(html).toContain(`class="app-card app-card--link"`);
  });

  it("renders loading, error and empty states", () => {
    const render = (state: PlansState) => renderToStaticMarkup(createElement(PlansView, { state, onOpen: () => {}, onExplore: () => {} }));

    expect(render({ status: "loading" })).toContain("app-skeleton-line");
    expect(render({ status: "error" })).toContain("app-state--error");
    expect(render({ status: "error" })).toContain("Не удалось загрузить планы.");
    expect(render({ status: "ready", cards: [] })).toContain("Пока нет планов.");
  });
});

describe("PlansPage", () => {
  it("offers the day route entry above the list", () => {
    const html = renderToStaticMarkup(createElement(PlansPage));

    expect(html).toContain("Маршрут на день");
  });

  it("offers the «Мы» groups entry above the list", () => {
    const html = renderToStaticMarkup(createElement(PlansPage));

    expect(html).toContain("Мы");
  });
});
