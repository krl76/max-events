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
    expect(PLAN_STATUS_LABELS.invited).toBe("ждёт ответа");
    expect(PLAN_STATUS_LABELS.confirmed).toBe("идёт");
    expect(PLAN_STATUS_LABELS.declined).toBe("не идёт");
  });
});

describe("PlanView cancellation", () => {
  const view = (over: Partial<Parameters<typeof PlanView>[0]> = {}, plan: Partial<ReturnType<typeof planCards>[number]["plan"]> = {}) => {
    const { card } = ready(0);
    const merged = { ...card, plan: { ...card.plan, ...plan } };
    // The host is the only one offered a cancel, so the fixture views the plan as its host.
    return renderToStaticMarkup(createElement(PlanView, { state: { status: "ready", card: merged }, onOpenEvent: () => {}, viewerId: merged.plan.hostUserId, ...over }));
  };

  it("keeps the choice behind one tap rather than cancelling on the spot", () => {
    expect(view()).toContain("Отменить");
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
    const guest = renderToStaticMarkup(createElement(PlanView, { state: { status: "ready", card }, onOpenEvent: () => {}, viewerId: "a0000000-0000-4000-8000-0000000000ff" }));

    expect(guest).toContain(card.event.title);
    expect(guest).not.toContain("Отменить");
  });

  it("reports a failed cancel instead of leaving the screen unchanged", () => {
    expect(view({ cancelFailed: true })).toContain("Не удалось отменить план.");
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

  it("embeds the budget section into the ready plan screen", () => {
    const { card } = ready(0);
    const html = renderToStaticMarkup(createElement(PlanView, { state: { status: "ready", card }, onOpenEvent: () => {} }));

    expect(html).toContain("Загружаем бюджет…");
  });

  it("renders the chat button only when the plan has a chat link", () => {
    const withChat = renderToStaticMarkup(createElement(PlanView, { state: ready(0), onOpenEvent: () => {} }));
    expect(withChat).toContain("В чат плана");

    const withoutChat = renderToStaticMarkup(createElement(PlanView, { state: ready(1), onOpenEvent: () => {} }));
    expect(withoutChat).not.toContain("В чат плана");
  });
});
