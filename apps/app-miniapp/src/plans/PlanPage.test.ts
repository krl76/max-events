import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PLAN_STATUS_LABELS, PlanView, planChatLabel, planShareText, type PlanBudgetState, type PlanState, type PlanTimelineState } from "./PlanPage";
import { mockPlanTimeline, planCards } from "../api/mock";
import type { PlanTimeline } from "../api/client";

function ready(cardIndex: number): Extract<PlanState, { status: "ready" }> {
  const card = planCards()[cardIndex];
  if (!card) throw new Error("plan fixture is missing");
  return { status: "ready", card };
}

function timelineOf(cardIndex: number): PlanTimeline {
  const timeline = mockPlanTimeline(planCards()[cardIndex].plan.id);
  if (timeline === null) throw new Error("plan timeline fixture is missing");
  return timeline;
}

const LOADING_TIMELINE: PlanTimelineState = { status: "loading" };

const HIDDEN_BUDGET: PlanBudgetState = { status: "hidden" };

describe("PLAN_STATUS_LABELS", () => {
  it("covers every participant status with a ru label", () => {
    expect(PLAN_STATUS_LABELS.invited).toBe("приглашён");
    expect(PLAN_STATUS_LABELS.confirmed).toBe("подтвердил");
    expect(PLAN_STATUS_LABELS.declined).toBe("отказался");
  });
});

describe("planChatLabel", () => {
  it("offers to create the chat only while the plan has none", () => {
    const { card } = ready(0);
    expect(planChatLabel({ ...card, plan: { ...card.plan, chatLink: null } })).toBe("Собрать план и создать чат");
    expect(planChatLabel({ ...card, plan: { ...card.plan, chatLink: "https://max.ru/chat/x" } })).toBe("Открыть чат плана");
  });
});

describe("planShareText", () => {
  it("names the event and the meeting even without a timeline", () => {
    const { card } = ready(0);
    const text = planShareText(card, null);

    expect(text).toContain(card.event.title);
    expect(text).toContain(card.plan.meetingPoint);
  });

  it("lists the steps of the evening once the timeline is there", () => {
    const { card } = ready(0);
    const timeline = timelineOf(0);
    const text = planShareText(card, timeline);

    for (const step of timeline.steps) expect(text).toContain(step.title);
  });
});

describe("PlanView cancellation", () => {
  const view = (over: Partial<Parameters<typeof PlanView>[0]> = {}, plan: Partial<ReturnType<typeof planCards>[number]["plan"]> = {}) => {
    const { card } = ready(0);
    const merged = { ...card, plan: { ...card.plan, ...plan } };
    // The host is the only one offered a cancel, so the fixture views the plan as its host.
    return renderToStaticMarkup(createElement(PlanView, { state: { status: "ready", card: merged }, timeline: LOADING_TIMELINE, budget: HIDDEN_BUDGET, viewerId: merged.plan.hostUserId, ...over }));
  };

  it("keeps the choice behind one tap rather than cancelling on the spot", () => {
    expect(view()).toContain("Отменить план");
    expect(view()).not.toContain("Отменить эту встречу");
    expect(view({ cancelling: true })).toContain("Не отменять");
  });

  it("offers «this one» or «the whole series» only for a repeating plan", () => {
    // A plan that happens once has nothing to choose between; the series question would be noise.
    const single = view({ cancelling: true }, { seriesId: null });
    expect(single).toContain("Отменить план");
    expect(single).not.toContain("Отменить всю серию");

    const repeating = view({ cancelling: true }, { seriesId: "90000000-0000-4000-8000-000000000001" });
    expect(repeating).toContain("Отменить эту встречу");
    expect(repeating).toContain("Отменить всю серию");
  });

  it("says how a repeating plan repeats, and says nothing for a one-off", () => {
    expect(view({}, { recurringRule: { type: "weekly_weekday", weekday: 4 } })).toContain("Повторяется каждый четверг");
    expect(view()).not.toContain("Повторяется");
  });

  it("offers the cancel to the host only", () => {
    // Only the host may cancel on the backend; anyone else would press a button that answers 403.
    const { card } = ready(0);
    const guest = renderToStaticMarkup(createElement(PlanView, { state: { status: "ready", card }, timeline: LOADING_TIMELINE, budget: HIDDEN_BUDGET, viewerId: "a0000000-0000-4000-8000-0000000000ff" }));

    expect(guest).not.toContain("Отменить");
  });

  it("reports a failed cancel instead of leaving the screen unchanged", () => {
    expect(view({ cancelFailed: true })).toContain("Не удалось отменить план.");
  });
});

describe("PlanView", () => {
  it("draws the header with the day, the party size and the timeline steps", () => {
    const { card } = ready(0);
    const timeline = timelineOf(0);
    const html = renderToStaticMarkup(createElement(PlanView, { state: { status: "ready", card }, timeline: { status: "ready", timeline }, budget: HIDDEN_BUDGET }));

    expect(html).toContain("План на вечер");
    expect(html).toContain("4 человека");
    for (const step of timeline.steps) expect(html).toContain(step.title);
  });

  it("wears the «MAX СОБРАЛ» badge only for a plan the assistant assembled", () => {
    const { card } = ready(0);
    const timeline = timelineOf(0);
    const assembled = renderToStaticMarkup(createElement(PlanView, { state: { status: "ready", card }, timeline: { status: "ready", timeline }, budget: HIDDEN_BUDGET }));
    const byHand = renderToStaticMarkup(createElement(PlanView, { state: { status: "ready", card }, timeline: { status: "ready", timeline: { ...timeline, assembledByMax: false } }, budget: HIDDEN_BUDGET }));

    expect(assembled).toContain("MAX СОБРАЛ");
    expect(byHand).not.toContain("MAX СОБРАЛ");
  });

  it("keeps the party names behind «Изменить» and shows every status once opened", () => {
    const { card } = ready(0);
    const closed = renderToStaticMarkup(createElement(PlanView, { state: { status: "ready", card }, timeline: LOADING_TIMELINE, budget: HIDDEN_BUDGET }));
    const open = renderToStaticMarkup(createElement(PlanView, { state: { status: "ready", card }, timeline: LOADING_TIMELINE, budget: HIDDEN_BUDGET, editingParty: true }));

    // Свёрнутая карточка — это стопка лиц; имена в ней живут только в подписи для скринридера,
    // а статусы участия не показываются вовсе.
    expect(closed).toContain("Компания");
    expect(closed).not.toContain("app-plan-friend-status");
    for (const { friend, status } of card.plan.participants) {
      expect(open).toContain(friend.name);
      expect(open).toContain(PLAN_STATUS_LABELS[status]);
    }
  });

  it("renders declined and invited statuses with their modifier classes", () => {
    const { card } = ready(1);
    const html = renderToStaticMarkup(createElement(PlanView, { state: { status: "ready", card }, timeline: LOADING_TIMELINE, budget: HIDDEN_BUDGET, editingParty: true }));

    expect(html).toContain("app-plan-friend-status--confirmed");
    expect(html).toContain("app-plan-friend-status--declined");
  });

  it("renders loading and error states", () => {
    expect(renderToStaticMarkup(createElement(PlanView, { state: { status: "loading" }, timeline: LOADING_TIMELINE, budget: HIDDEN_BUDGET }))).toContain("app-skeleton");
    expect(renderToStaticMarkup(createElement(PlanView, { state: { status: "error" }, timeline: LOADING_TIMELINE, budget: HIDDEN_BUDGET }))).toContain("Не удалось загрузить план.");
    expect(renderToStaticMarkup(createElement(PlanView, { state: ready(0), timeline: { status: "error" }, budget: HIDDEN_BUDGET }))).toContain("Не удалось загрузить таймлайн вечера.");
  });

  it("hides the money block — and the expense editor with it — when the budget is not the viewer's to see", () => {
    const html = renderToStaticMarkup(createElement(PlanView, { state: ready(0), timeline: LOADING_TIMELINE, budget: HIDDEN_BUDGET }));

    expect(html).not.toContain("Итого на человека");
    expect(html).not.toContain("Расходы и долги");
  });

  it("offers every tweak chip of the design", () => {
    const html = renderToStaticMarkup(createElement(PlanView, { state: ready(0), timeline: LOADING_TIMELINE, budget: HIDDEN_BUDGET }));

    for (const label of ["Добавить шаг", "Дешевле", "Без такси", "Другой вечер"]) expect(html).toContain(label);
  });

  it("names the bottom actions of the design", () => {
    const html = renderToStaticMarkup(createElement(PlanView, { state: ready(1), timeline: LOADING_TIMELINE, budget: HIDDEN_BUDGET }));

    expect(html).toContain("Собрать план и создать чат");
    expect(html).toContain("Отправить в чат MAX");
    expect(html).toContain("В календарь");
  });
});
