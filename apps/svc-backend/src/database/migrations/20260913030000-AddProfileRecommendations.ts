import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProfileRecommendations20260913030000 implements MigrationInterface {
  name = "AddProfileRecommendations20260913030000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "profiles" ADD COLUMN "recommendationsEnabled" boolean NOT NULL DEFAULT true`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN "recommendationsEnabled"`);
  }
}
