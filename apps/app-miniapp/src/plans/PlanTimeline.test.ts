import { describe, expect, it } from "vitest";
import type { PlanBudget } from "@max-events/api-contracts";
import { PLAN_TRANSFER_ICON, PLAN_TRANSFER_LABELS, PLAN_TWEAKS, formatRub, planBudgetLines, planHeaderSubtitle, planPerPersonRub, planStepTime } from "./PlanTimeline";
import { planCards } from "../api/mock";

const VIEWER = "a0000000-0000-4000-8000-000000000001";

const OTHER = "a0000000-0000-4000-8000-0000000000b1";

function budget(over: Partial<PlanBudget> = {}): PlanBudget {
  return {
    expenses: [
      { id: "e1", planId: "p1", title: "Билет", amountRub: 850, payerUserId: VIEWER, shareUserIds: [VIEWER, OTHER], createdAt: "2026-09-01T10:00:00+03:00" },
      { id: "e2", planId: "p1", title: "Такси", amountRub: 620, payerUserId: OTHER, shareUserIds: [VIEWER, OTHER], createdAt: "2026-09-01T11:00:00+03:00" },
    ],
    perPerson: [
      { userId: VIEWER, paidRub: 850, shareRub: 735, netRub: 115 },
      { userId: OTHER, paidRub: 620, shareRub: 735, netRub: -115 },
    ],
    debts: [],
    totalRub: 1470,
    ...over,
  };
}

describe("planStepTime", () => {
  it("prints the clock time of a step", () => {
    const at = "2026-09-19T18:20:00+03:00";

    expect(planStepTime(at)).toBe(new Date(at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }));
    expect(planStepTime(at)).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe("planHeaderSubtitle", () => {
  it("counts the host into the party, not only the invitees", () => {
    const card = planCards()[0];

    // Три участника плюс сам хозяин — в шапке экрана стоит «4 человека», как в макете.
    expect(planHeaderSubtitle(card)).toContain(`${card.plan.participants.length + 1} человека`);
  });

  it("opens with a capitalised weekday and the date of the meeting", () => {
    const card = planCards()[0];
    const subtitle = planHeaderSubtitle(card);

    expect(subtitle.charAt(0)).toBe(subtitle.charAt(0).toUpperCase());
    expect(subtitle).toContain(new Date(card.plan.meetingAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }));
  });

  it("says «1 человек» for a plan nobody else joined", () => {
    const card = planCards()[0];

    expect(planHeaderSubtitle({ ...card, plan: { ...card.plan, participants: [] } })).toMatch(/· 1 человек$/);
  });
});

describe("formatRub", () => {
  it("groups thousands and keeps the currency sign", () => {
    expect(formatRub(2670)).toBe(`${(2670).toLocaleString("ru-RU")} ₽`);
    expect(formatRub(620)).toBe("620 ₽");
  });
});

describe("planBudgetLines", () => {
  it("shows the expenses as they are, without inventing a line of its own", () => {
    expect(planBudgetLines(budget()).map((line) => [line.title, line.amountRub])).toEqual([
      ["Билет", 850],
      ["Такси", 620],
    ]);
  });
});

describe("planPerPersonRub", () => {
  it("takes the share the budget computed for the viewer", () => {
    expect(planPerPersonRub(budget(), VIEWER)).toBe(735);
  });

  it("falls back to the total split evenly for someone outside the breakdown", () => {
    expect(planPerPersonRub(budget(), "a0000000-0000-4000-8000-0000000000ff")).toBe(735);
  });

  it("answers the whole bill when there is nobody to split it between", () => {
    expect(planPerPersonRub(budget({ perPerson: [], totalRub: 900 }), null)).toBe(900);
  });
});

describe("PLAN_TWEAKS", () => {
  it("carries the four chips of the design, each with a question for the assistant", () => {
    expect(PLAN_TWEAKS.map((tweak) => tweak.label)).toEqual(["Добавить шаг", "Дешевле", "Без такси", "Другой вечер"]);
    for (const tweak of PLAN_TWEAKS) expect(tweak.ask.length).toBeGreaterThan(tweak.label.length);
  });
});

describe("transfer vocabulary", () => {
  it("gives every mode a glyph and a ru label", () => {
    for (const mode of ["walk", "metro", "taxi"] as const) {
      expect(PLAN_TRANSFER_ICON[mode]).toBeTruthy();
      expect(PLAN_TRANSFER_LABELS[mode]).toBeTruthy();
    }
  });
});
