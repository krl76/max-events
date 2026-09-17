import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProfileSmartAlerts20260912100000 implements MigrationInterface {
  name = "AddProfileSmartAlerts20260912100000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "profiles" ADD COLUMN "smartAlerts" jsonb NOT NULL DEFAULT '{"leaveNow":true,"weather":true,"friendLeft":true,"listDigest":true}'::jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN "smartAlerts"`);
  }
}
