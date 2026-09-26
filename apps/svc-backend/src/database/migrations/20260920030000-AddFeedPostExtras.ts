import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFeedPostExtras20260920030000 implements MigrationInterface {
  name = "AddFeedPostExtras20260920030000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "feed_posts" ADD COLUMN "placeId" uuid`);
    await queryRunner.query(`ALTER TABLE "feed_posts" ADD COLUMN "taggedFriendIds" text[] NOT NULL DEFAULT '{}'`);
    await queryRunner.query(`ALTER TABLE "feed_posts" ADD COLUMN "audience" character varying(16) NOT NULL DEFAULT 'friends'`);
    await queryRunner.query(`ALTER TABLE "feed_posts" ADD COLUMN "allowJoin" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "feed_posts" DROP COLUMN "allowJoin"`);
    await queryRunner.query(`ALTER TABLE "feed_posts" DROP COLUMN "audience"`);
    await queryRunner.query(`ALTER TABLE "feed_posts" DROP COLUMN "taggedFriendIds"`);
    await queryRunner.query(`ALTER TABLE "feed_posts" DROP COLUMN "placeId"`);
  }
}
