import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { CreateSubscriptions20260911230000 } from "../database/migrations/20260911230000-CreateSubscriptions";
import { AddSubscriptionTargetUser20260919120200 } from "../database/migrations/20260919120200-AddSubscriptionTargetUser";
import { FixSubscriptionTypeUser20260919120500 } from "../database/migrations/20260919120500-FixSubscriptionTypeUser";

describe("CreateSubscriptions20260911230000", () => {
  it("adds organizerUserId and subscriptions, then reverts", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new CreateSubscriptions20260911230000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain("organizerUserId");
    expect(queries[2]).toContain('CREATE TABLE "subscriptions"');
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries[3]).toContain('DROP TABLE "subscriptions"');
    expect(queries[5]).toContain("organizerUserId");
  });
});

describe("AddSubscriptionTargetUser20260919120200", () => {
  it("adds targetUserId and unique index and drops them on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new AddSubscriptionTargetUser20260919120200();
    await migration.up(queryRunner);
    expect(queries[0]).toContain("targetUserId");
    expect(queries[1]).toContain("UQ_subscriptions_user_target");
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries[0]).toContain("UQ_subscriptions_user_target");
    expect(queries[1]).toContain("targetUserId");
  });
});

describe("FixSubscriptionTypeUser20260919120500", () => {
  it("widens the type check, adds the user FK and tightens the unique index", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new FixSubscriptionTypeUser20260919120500();
    await migration.up(queryRunner);
    expect(queries.join("\n")).toContain("CHK_subscriptions_type");
    expect(queries.join("\n")).toContain("FK_subscriptions_target_user");
    expect(queries.join("\n")).toContain("= 'user'");
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries.join("\n")).toContain("FK_subscriptions_target_user");
    expect(queries.join("\n")).toContain("UQ_subscriptions_user_target");
  });
});
