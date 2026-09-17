import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLeaveNowSentAt20260912080000 implements MigrationInterface {
  name = "AddLeaveNowSentAt20260912080000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plans" ADD COLUMN "leaveNowSentAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "plan_participants" ADD COLUMN "leaveNowSentAt" TIMESTAMP WITH TIME ZONE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plan_participants" DROP COLUMN "leaveNowSentAt"`);
    await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN "leaveNowSentAt"`);
  }
}
