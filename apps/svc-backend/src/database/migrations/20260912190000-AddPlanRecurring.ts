import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPlanRecurring20260912190000 implements MigrationInterface {
  name = "AddPlanRecurring20260912190000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plans" ADD COLUMN "recurringRule" jsonb`);
    await queryRunner.query(`ALTER TABLE "plans" ADD COLUMN "seriesId" uuid`);
    await queryRunner.query(`ALTER TABLE "plans" ADD COLUMN "sourcePlanId" uuid`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN "sourcePlanId"`);
    await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN "seriesId"`);
    await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN "recurringRule"`);
  }
}
