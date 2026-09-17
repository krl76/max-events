import { MigrationInterface, QueryRunner } from "typeorm";

export class AddModerationFlags20260912050000 implements MigrationInterface {
  name = "AddModerationFlags20260912050000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "bannedFromPublishing" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "places" ADD "published" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "feed_posts" ADD "published" boolean NOT NULL DEFAULT true`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "feed_posts" DROP COLUMN "published"`);
    await queryRunner.query(`ALTER TABLE "places" DROP COLUMN "published"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "bannedFromPublishing"`);
  }
}
