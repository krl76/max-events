import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPlanRecurringGuards20260912191000 implements MigrationInterface {
  name = "AddPlanRecurringGuards20260912191000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plans" ADD COLUMN "cancelledAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`WITH ranked AS (SELECT "id", row_number() OVER (PARTITION BY "seriesId", "meetingAt" ORDER BY "id") AS rn FROM "plans" WHERE "seriesId" IS NOT NULL) DELETE FROM "plans" p WHERE p."id" IN (SELECT "id" FROM ranked WHERE rn > 1)`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_plans_series_meeting" ON "plans" ("seriesId", "meetingAt") WHERE "seriesId" IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_plans_series_meeting"`);
    await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN "cancelledAt"`);
  }
}
