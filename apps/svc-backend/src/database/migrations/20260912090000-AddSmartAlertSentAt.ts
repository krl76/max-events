import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSmartAlertSentAt20260912090000 implements MigrationInterface {
  name = "AddSmartAlertSentAt20260912090000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plans" ADD COLUMN "weatherAlertSentAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "plans" ADD COLUMN "friendLeftBroadcastAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "plan_participants" ADD COLUMN "friendLeftBroadcastAt" TIMESTAMP WITH TIME ZONE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plan_participants" DROP COLUMN "friendLeftBroadcastAt"`);
    await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN "friendLeftBroadcastAt"`);
    await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN "weatherAlertSentAt"`);
  }
}
