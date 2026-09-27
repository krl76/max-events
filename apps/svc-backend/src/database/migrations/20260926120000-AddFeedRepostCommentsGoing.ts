import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFeedRepostCommentsGoing20260926120000 implements MigrationInterface {
  name = "AddFeedRepostCommentsGoing20260926120000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "feed_posts" ADD "repostOfPostId" uuid`);
    await queryRunner.query(`ALTER TABLE "feed_posts" ADD "repostOfEventId" uuid`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_feed_posts_repost_post" ON "feed_posts" ("authorUserId", "repostOfPostId") WHERE "repostOfPostId" IS NOT NULL AND "published" = true`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_feed_posts_repost_event" ON "feed_posts" ("authorUserId", "repostOfEventId") WHERE "repostOfEventId" IS NOT NULL AND "published" = true`);
    await queryRunner.query(`ALTER TABLE "feed_comments" ADD "parentId" uuid`);
    await queryRunner.query(`CREATE TABLE "feed_post_going" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "postId" uuid NOT NULL, "userId" uuid NOT NULL, CONSTRAINT "PK_feed_post_going" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_feed_post_going_user" ON "feed_post_going" ("postId", "userId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "feed_post_going"`);
    await queryRunner.query(`ALTER TABLE "feed_comments" DROP COLUMN "parentId"`);
    await queryRunner.query(`DROP INDEX "UQ_feed_posts_repost_event"`);
    await queryRunner.query(`DROP INDEX "UQ_feed_posts_repost_post"`);
    await queryRunner.query(`ALTER TABLE "feed_posts" DROP COLUMN "repostOfEventId"`);
    await queryRunner.query(`ALTER TABLE "feed_posts" DROP COLUMN "repostOfPostId"`);
  }
}
