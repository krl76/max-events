// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for a plan's shared expenses, per-person totals, and debts.
// SCOPE: expense entity, create write, budget summary with per-person nets and who-owes-whom.
// DEPENDS: zod, ./primitives.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PlanExpenseSchema - one expense line
// - PlanExpense - expense type
// - CreatePlanExpenseWriteSchema - add expense payload
// - CreatePlanExpenseWrite - write type
// - PlanBudgetPersonSchema - per-person spent/share/net
// - PlanBudgetPerson - person type
// - PlanDebtSchema - directed debt
// - PlanDebt - debt type
// - PlanBudgetSchema - expenses plus totals
// - PlanBudget - budget type
// END_MODULE_MAP

import { z } from "zod";
import { IdSchema, TimestampSchema } from "./primitives.js";

export const PlanExpenseSchema = z.object({
  id: IdSchema,
  planId: IdSchema,
  title: z.string().min(1).max(200),
  amountRub: z.number().int().positive().max(2_147_483_647),
  payerUserId: IdSchema,
  shareUserIds: z.array(IdSchema).min(1),
  createdAt: TimestampSchema,
});
export type PlanExpense = z.infer<typeof PlanExpenseSchema>;

export const CreatePlanExpenseWriteSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    amountRub: z.number().int().positive().max(2_147_483_647),
    payerUserId: IdSchema,
    shareUserIds: z.array(IdSchema).min(1),
  })
  .refine((row) => new Set(row.shareUserIds).size === row.shareUserIds.length, { message: "shareUserIds must be unique", path: ["shareUserIds"] });
export type CreatePlanExpenseWrite = z.infer<typeof CreatePlanExpenseWriteSchema>;

export const PlanBudgetPersonSchema = z.object({
  userId: IdSchema,
  paidRub: z.number().int(),
  shareRub: z.number().int(),
  netRub: z.number().int(),
});
export type PlanBudgetPerson = z.infer<typeof PlanBudgetPersonSchema>;

export const PlanDebtSchema = z.object({
  fromUserId: IdSchema,
  toUserId: IdSchema,
  amountRub: z.number().int().positive(),
});
export type PlanDebt = z.infer<typeof PlanDebtSchema>;

export const PlanBudgetSchema = z.object({
  expenses: z.array(PlanExpenseSchema),
  perPerson: z.array(PlanBudgetPersonSchema),
  debts: z.array(PlanDebtSchema),
  totalRub: z.number().int().nonnegative(),
});
export type PlanBudget = z.infer<typeof PlanBudgetSchema>;
