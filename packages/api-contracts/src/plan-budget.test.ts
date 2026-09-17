import { describe, expect, it } from "vitest";
import { CreatePlanExpenseWriteSchema, PlanBudgetSchema } from "./plan-budget.js";

const userA = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f";
const userB = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90";
const planId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d91";

describe("CreatePlanExpenseWriteSchema", () => {
  it("requires a positive amount and at least one share", () => {
    expect(CreatePlanExpenseWriteSchema.parse({ title: "Билет", amountRub: 850, payerUserId: userA, shareUserIds: [userA, userB] }).amountRub).toBe(850);
    expect(CreatePlanExpenseWriteSchema.safeParse({ title: "Билет", amountRub: 0, payerUserId: userA, shareUserIds: [userA] }).success).toBe(false);
    expect(CreatePlanExpenseWriteSchema.safeParse({ title: "Билет", amountRub: 850, payerUserId: userA, shareUserIds: [] }).success).toBe(false);
    expect(CreatePlanExpenseWriteSchema.safeParse({ title: "Билет", amountRub: 850, payerUserId: userA, shareUserIds: [userA, userA] }).success).toBe(false);
  });
});

describe("PlanBudgetSchema", () => {
  it("accepts per-person nets and directed debts", () => {
    const parsed = PlanBudgetSchema.parse({
      expenses: [{ id: planId, planId, title: "Билет", amountRub: 850, payerUserId: userA, shareUserIds: [userA, userB], createdAt: "2026-09-12T10:00:00+03:00" }],
      perPerson: [
        { userId: userA, paidRub: 850, shareRub: 425, netRub: 425 },
        { userId: userB, paidRub: 0, shareRub: 425, netRub: -425 },
      ],
      debts: [{ fromUserId: userB, toUserId: userA, amountRub: 425 }],
      totalRub: 850,
    });
    expect(parsed.debts[0]?.amountRub).toBe(425);
  });
});
