import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { CreatePlans20260911210000 } from "../database/migrations/20260911210000-CreatePlans";
import { AddPlanRecurring20260912190000 } from "../database/migrations/20260912190000-AddPlanRecurring";
import { AddPlanRecurringGuards20260912191000 } from "../database/migrations/20260912191000-AddPlanRecurringGuards";
import { AddPlanPollSentAt20260912192000 } from "../database/migrations/20260912192000-AddPlanPollSentAt";

describe("CreatePlans20260911210000", () => {
  it("creates plans and participants tables and drops them on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new CreatePlans20260911210000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('CREATE TABLE "plans"');
    expect(queries[1]).toContain('CREATE TABLE "plan_participants"');
    expect(queries[1]).toContain("UQ_plan_participants_plan_user");
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries).toEqual([`DROP TABLE "plan_participants"`, `DROP TABLE "plans"`]);
  });
});

describe("AddPlanRecurring20260912190000", () => {
  it("adds recurring columns and drops them on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new AddPlanRecurring20260912190000();
    await migration.up(queryRunner);
    expect(queries).toEqual([
      `ALTER TABLE "plans" ADD COLUMN "recurringRule" jsonb`,
      `ALTER TABLE "plans" ADD COLUMN "seriesId" uuid`,
      `ALTER TABLE "plans" ADD COLUMN "sourcePlanId" uuid`,
    ]);
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries).toEqual([`ALTER TABLE "plans" DROP COLUMN "sourcePlanId"`, `ALTER TABLE "plans" DROP COLUMN "seriesId"`, `ALTER TABLE "plans" DROP COLUMN "recurringRule"`]);
  });
});

describe("AddPlanRecurringGuards20260912191000", () => {
  it("adds cancelledAt and a unique series meeting index", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new AddPlanRecurringGuards20260912191000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain(`ADD COLUMN "cancelledAt"`);
    expect(queries[1]).toContain(`DELETE FROM "plans"`);
    expect(queries[1]).toContain(`GROUP BY q."seriesId", q."meetingAt"`);
    expect(queries[2]).toContain(`CREATE UNIQUE INDEX "UQ_plans_series_meeting"`);
    expect(queries[2]).toContain(`"seriesId", "meetingAt"`);
    expect(queries[2]).toContain(`WHERE "seriesId" IS NOT NULL`);
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries).toEqual([`DROP INDEX "UQ_plans_series_meeting"`, `ALTER TABLE "plans" DROP COLUMN "cancelledAt"`]);
  });
});

describe("AddPlanPollSentAt20260912192000", () => {
  it("adds pollSentAt on plan participants", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new AddPlanPollSentAt20260912192000();
    await migration.up(queryRunner);
    expect(queries).toEqual([`ALTER TABLE "plan_participants" ADD COLUMN "pollSentAt" TIMESTAMP WITH TIME ZONE`]);
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries).toEqual([`ALTER TABLE "plan_participants" DROP COLUMN "pollSentAt"`]);
  });
});
