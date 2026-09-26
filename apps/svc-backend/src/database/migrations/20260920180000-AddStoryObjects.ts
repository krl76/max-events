import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStoryObjects20260920180000 implements MigrationInterface {
  name = "AddStoryObjects20260920180000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "stories" ADD COLUMN "objects" jsonb NOT NULL DEFAULT '[]'::jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "stories" DROP COLUMN "objects"`);
  }
}
