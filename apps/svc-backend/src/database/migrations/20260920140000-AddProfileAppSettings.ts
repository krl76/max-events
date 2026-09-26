import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProfileAppSettings20260920140000 implements MigrationInterface {
  name = "AddProfileAppSettings20260920140000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "profiles" ADD COLUMN "appSettings" jsonb NOT NULL DEFAULT '{}'::jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN "appSettings"`);
  }
}
