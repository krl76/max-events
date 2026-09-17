import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProfilePrivacy20260912120000 implements MigrationInterface {
  name = "AddProfilePrivacy20260912120000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "profiles" ADD COLUMN "privacy" jsonb NOT NULL DEFAULT '{"visitHistory":"friends","routes":"friends"}'::jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN "privacy"`);
  }
}
