import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPlanRecurringGuards20260912191000 implements MigrationInterface {
  name = "AddPlanRecurringGuards20260912191000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plans" ADD COLUMN "cancelledAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(
      `DELETE FROM "plans" p WHERE p."seriesId" IS NOT NULL AND p."id" NOT IN (SELECT MIN(q."id") FROM "plans" q WHERE q."seriesId" IS NOT NULL GROUP BY q."seriesId", q."meetingAt")`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_plans_series_meeting" ON "plans" ("seriesId", "meetingAt") WHERE "seriesId" IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_plans_series_meeting"`);
    await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN "cancelledAt"`);
  }
}
