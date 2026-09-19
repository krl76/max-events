import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BudgetSection, BudgetView, expenseDraftErrors, expenseNameOf, emptyExpenseDraft } from "./BudgetSection";
import { mockDemoUser, mockPlanBudget, mockPlans } from "../api/mock";

const PLAN_ONE_ID = mockPlans[0].plan.id;
const MEMBERS = mockPlans[0].plan.participants.map(({ friend }) => friend);
const BUDGET = mockPlanBudget(PLAN_ONE_ID)!;

function renderBudget(budget = BUDGET, draft = emptyExpenseDraft(BUDGET.perPerson[0].userId)): string {
  return renderToStaticMarkup(createElement(BudgetView, { budget, members: MEMBERS, draft, saving: false, failed: false, showErrors: true, onDraftChange: () => {}, onSubmit: () => {} }));
}

describe("expenseDraftErrors", () => {
  it("flags an empty title, a non-integer or tiny amount and empty shares", () => {
    const payer = BUDGET.perPerson[0].userId;

    expect(expenseDraftErrors({ title: "", amount: "100", payerUserId: payer, shareUserIds: [payer] })).toContain("Укажите, за что платили");
    expect(expenseDraftErrors({ title: "Х", amount: "10.5", payerUserId: payer, shareUserIds: [payer] })).toContain("Сумма — целое число от 1 ₽");
    expect(expenseDraftErrors({ title: "Х", amount: "0", payerUserId: payer, shareUserIds: [payer] })).toContain("Сумма — целое число от 1 ₽");
    expect(expenseDraftErrors({ title: "Х", amount: "100", payerUserId: payer, shareUserIds: [] })).toContain("Выберите, на кого делится расход");
    expect(expenseDraftErrors({ title: "Х", amount: "100", payerUserId: payer, shareUserIds: [payer] })).toHaveLength(0);
  });
});

describe("expenseNameOf", () => {
  it("resolves participant names and falls back to «Ты» for the host", () => {
    expect(expenseNameOf(MEMBERS, MEMBERS[0].id)).toBe(MEMBERS[0].name);
    expect(expenseNameOf(MEMBERS, mockDemoUser.id)).toBe("Ты");
  });
});

describe("BudgetView", () => {
  it("renders every expense with payer, the per-person totals and the debts table", () => {
    const html = renderBudget();

    for (const expense of BUDGET.expenses) {
      expect(html).toContain(expense.title);
      expect(html).toContain(`${expense.amountRub} ₽`);
      expect(html).toContain(`оплатил ${expenseNameOf(MEMBERS, expense.payerUserId)}`);
    }
    expect(html).toContain(`Итого ${BUDGET.totalRub} ₽`);
    for (const person of BUDGET.perPerson) {
      expect(html).toContain(`доля ${person.shareRub} ₽`);
    }
    for (const debt of BUDGET.debts) {
      expect(html).toContain(`${expenseNameOf(MEMBERS, debt.fromUserId)} → ${expenseNameOf(MEMBERS, debt.toUserId)} ${debt.amountRub} ₽`);
    }
  });

  it("renders the add-expense form with payer options and share checkboxes", () => {
    const html = renderBudget();

    expect(html).toContain("За что платили");
    expect(html).toContain("Добавить расход");
    expect(html).toContain("Кто оплатил");
    expect(html).toContain("Делится на");
  });

  it("shows the empty state when the plan has no expenses yet", () => {
    const html = renderBudget({ expenses: [], perPerson: BUDGET.perPerson, debts: [], totalRub: 0 });

    expect(html).toContain("Пока нет расходов.");
    expect(html).not.toContain("Кто кому должен");
  });
});

describe("BudgetSection", () => {
  it("starts in the loading state", () => {
    const html = renderToStaticMarkup(createElement(BudgetSection, { planId: PLAN_ONE_ID, members: MEMBERS }));

    expect(html).toContain("Загружаем бюджет…");
  });
});
