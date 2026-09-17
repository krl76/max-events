import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPlanPollSentAt20260912192000 implements MigrationInterface {
  name = "AddPlanPollSentAt20260912192000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plan_participants" ADD COLUMN "pollSentAt" TIMESTAMP WITH TIME ZONE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plan_participants" DROP COLUMN "pollSentAt"`);
  }
}
