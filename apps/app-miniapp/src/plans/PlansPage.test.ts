import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { formatDistance, heroDragPx, heroIndexAfterDirection, heroShiftPx, heroSlideMs, planCompanyLabel, planDistanceLabel, planMeetingLabel, planPartyLabel, planWhenPlace, PlansPage, PlansView, type PlansState } from "./PlansPage";
import { pluralRu } from "../catalog/format";
import { planCards } from "../api/mock";
import { dampOffset } from "../ui/gestures";

const CARDS = planCards();

describe("plan participants label", () => {
  it("pluralizes «друг» by ru rules like the README example", () => {
    expect(`Ты + 1 ${pluralRu(1, "друг", "друга", "друзей")}`).toBe("Ты + 1 друг");
    expect(`Ты + 3 ${pluralRu(3, "друг", "друга", "друзей")}`).toBe("Ты + 3 друга");
    expect(`Ты + 5 ${pluralRu(5, "друг", "друга", "друзей")}`).toBe("Ты + 5 друзей");
    expect(`Ты + 11 ${pluralRu(11, "друг", "друга", "друзей")}`).toBe("Ты + 11 друзей");
    expect(`Ты + 12 ${pluralRu(12, "друг", "друга", "друзей")}`).toBe("Ты + 12 друзей");
    expect(`Ты + 22 ${pluralRu(22, "друг", "друга", "друзей")}`).toBe("Ты + 22 друга");
    expect(planCompanyLabel(0)).toBe("Пока только ты");
    expect(planCompanyLabel(1)).toBe("Ты + 1 друг");
  });
});

describe("formatDistance", () => {
  it("formats meters under a kilometer and kilometers above it", () => {
    expect(formatDistance(850)).toBe("850 м");
    expect(formatDistance(1200)).toBe("1,2 км");
    expect(formatDistance(0)).toBe("0 м");
    expect(planDistanceLabel(892_200)).toBe("далеко от тебя");
    expect(planDistanceLabel(6_000, false)).toBe("6,0 км от центра");
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
  it("renders the nearest plan as a hero and the rest as rows", () => {
    const html = renderToStaticMarkup(createElement(PlansView, { state: { status: "ready", cards: CARDS }, onOpen: () => {}, onExplore: () => {}, onCreate: () => {} }));

    expect(html).toContain("Ближайший план");
    expect(html).toContain("app-plans-hero-track");
    expect(html).not.toContain("app-plans-hero--next");
    expect(html).toContain(CARDS[0]!.event.title);
    expect(html).toContain(planPartyLabel(CARDS[0]!.plan.participants.length));
    expect(html).toContain(planWhenPlace(CARDS[0]!.plan));
    expect(html).toContain("Мои планы");
    expect(html).toContain("Создать новый план");
    expect(html).toContain("маршрут на день");
  });

  it("renders loading, error and empty states", () => {
    const render = (state: PlansState) => renderToStaticMarkup(createElement(PlansView, { state, onOpen: () => {}, onExplore: () => {}, onCreate: () => {} }));

    expect(render({ status: "loading" })).toContain("app-skeleton-line");
    expect(render({ status: "error" })).toContain("app-state--error");
    expect(render({ status: "error" })).toContain("Не удалось загрузить планы.");
    expect(render({ status: "ready", cards: [] })).toContain("Пока нет планов.");
  });
});

describe("PlansPage", () => {
  it("draws its own title and a way to start a plan", () => {
    const html = renderToStaticMarkup(createElement(PlansPage));

    expect(html).toContain("Планы");
    expect(html).not.toContain("Новый план");
    expect(html).not.toContain("app-tab-row");
  });
});

describe("nearest plan pager", () => {
  it("follows the finger and eases into the next card without a cut", () => {
    expect(heroDragPx(120, 1, 3, 300)).toBe(120);
    expect(heroDragPx(-500, 1, 3, 300)).toBe(-300);
    expect(heroDragPx(80, 0, 3, 300)).toBe(dampOffset(80, 72));
    expect(heroDragPx(-40, 2, 3, 300)).toBe(dampOffset(-40, 72));
    expect(heroDragPx(80, 0, 1, 300)).toBe(0);
    expect(heroDragPx(80, 1, 3, 0)).toBe(0);
    expect(heroIndexAfterDirection(0, 3, "left")).toBe(1);
    expect(heroIndexAfterDirection(2, 3, "right")).toBe(1);
    expect(heroIndexAfterDirection(0, 3, "right")).toBe(0);
    expect(heroIndexAfterDirection(2, 3, "left")).toBe(2);
    expect(heroIndexAfterDirection(0, 1, "left")).toBe(0);
    expect(heroShiftPx(2, -24, 320)).toBe(-664);
    expect(heroShiftPx(1, 0, 0)).toBe(0);
    expect(heroSlideMs(0, 1)).toBe(460);
    expect(heroSlideMs(0, 4)).toBe(670);
    expect(heroSlideMs(0, 8)).toBe(680);
  });
});
