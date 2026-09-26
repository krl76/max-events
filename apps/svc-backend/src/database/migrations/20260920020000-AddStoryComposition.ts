import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStoryComposition20260920020000 implements MigrationInterface {
  name = "AddStoryComposition20260920020000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "stories" ADD COLUMN "text" character varying(500) NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "stories" ADD COLUMN "sticker" jsonb`);
    await queryRunner.query(`ALTER TABLE "stories" ADD COLUMN "poll" jsonb`);
    await queryRunner.query(`ALTER TABLE "stories" ADD COLUMN "audience" character varying(32) NOT NULL DEFAULT 'friends'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "stories" DROP COLUMN "audience"`);
    await queryRunner.query(`ALTER TABLE "stories" DROP COLUMN "poll"`);
    await queryRunner.query(`ALTER TABLE "stories" DROP COLUMN "sticker"`);
    await queryRunner.query(`ALTER TABLE "stories" DROP COLUMN "text"`);
  }
}
