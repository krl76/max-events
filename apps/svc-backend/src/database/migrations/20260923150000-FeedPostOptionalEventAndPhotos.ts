import { MigrationInterface, QueryRunner } from "typeorm";

export class FeedPostOptionalEventAndPhotos20260923150000 implements MigrationInterface {
  name = "FeedPostOptionalEventAndPhotos20260923150000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "feed_posts" ALTER COLUMN "eventId" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "feed_posts" ADD COLUMN "photoUrls" text array NOT NULL DEFAULT '{}'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "feed_posts" DROP COLUMN "photoUrls"`);
    await queryRunner.query(`UPDATE "feed_posts" SET "eventId" = '00000000-0000-4000-8000-000000000000' WHERE "eventId" IS NULL`);
    await queryRunner.query(`ALTER TABLE "feed_posts" ALTER COLUMN "eventId" SET NOT NULL`);
  }
}
