import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PLAN_STATUS_LABELS, PlanView, type PlanState } from "./PlanPage";
import { planMeetingLabel } from "./PlansPage";
import { planCards } from "../api/mock";

function ready(cardIndex: number): Extract<PlanState, { status: "ready" }> {
  const card = planCards()[cardIndex];
  if (!card) throw new Error("plan fixture is missing");
  return { status: "ready", card };
}

describe("PLAN_STATUS_LABELS", () => {
  it("covers every participant status with a ru label", () => {
    expect(PLAN_STATUS_LABELS.invited).toBe("приглашён");
    expect(PLAN_STATUS_LABELS.confirmed).toBe("подтвердил");
    expect(PLAN_STATUS_LABELS.declined).toBe("отказался");
  });
});

describe("PlanView", () => {
  it("renders the event as a link, the meeting point and time, and every participant with a status", () => {
    const { card } = ready(0);
    const html = renderToStaticMarkup(createElement(PlanView, { state: { status: "ready", card }, onOpenEvent: () => {} }));

    expect(html).toContain(card.event.title);
    expect(html).toContain("app-plan-event");
    expect(html).toContain(planMeetingLabel(card.plan));
    for (const { friend, status } of card.plan.participants) {
      expect(html).toContain(friend.name);
      expect(html).toContain(PLAN_STATUS_LABELS[status]);
    }
  });

  it("renders declined and invited statuses with their modifier classes", () => {
    const { card } = ready(1);
    const html = renderToStaticMarkup(createElement(PlanView, { state: { status: "ready", card }, onOpenEvent: () => {} }));

    expect(html).toContain("app-plan-friend-status--confirmed");
    expect(html).toContain("app-plan-friend-status--declined");
  });

  it("renders loading and error states", () => {
    expect(renderToStaticMarkup(createElement(PlanView, { state: { status: "loading" }, onOpenEvent: () => {} }))).toContain("Загрузка…");
    expect(renderToStaticMarkup(createElement(PlanView, { state: { status: "error" }, onOpenEvent: () => {} }))).toContain("Не удалось загрузить план.");
  });
});
