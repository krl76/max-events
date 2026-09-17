import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateFeed20260912030000 implements MigrationInterface {
  name = "CreateFeed20260912030000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "feed_posts" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "authorUserId" uuid NOT NULL, "eventId" uuid NOT NULL, "text" character varying(5000) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_feed_posts" PRIMARY KEY ("id"), CONSTRAINT "FK_feed_posts_author" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE CASCADE, CONSTRAINT "FK_feed_posts_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE)`);
    await queryRunner.query(`CREATE TABLE "feed_likes" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "postId" uuid NOT NULL, "userId" uuid NOT NULL, CONSTRAINT "PK_feed_likes" PRIMARY KEY ("id"), CONSTRAINT "UQ_feed_likes_post_user" UNIQUE ("postId", "userId"), CONSTRAINT "FK_feed_likes_post" FOREIGN KEY ("postId") REFERENCES "feed_posts"("id") ON DELETE CASCADE, CONSTRAINT "FK_feed_likes_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE)`);
    await queryRunner.query(`CREATE TABLE "feed_comments" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "postId" uuid NOT NULL, "authorUserId" uuid NOT NULL, "text" character varying(2000) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_feed_comments" PRIMARY KEY ("id"), CONSTRAINT "FK_feed_comments_post" FOREIGN KEY ("postId") REFERENCES "feed_posts"("id") ON DELETE CASCADE, CONSTRAINT "FK_feed_comments_author" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE CASCADE)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "feed_comments"`);
    await queryRunner.query(`DROP TABLE "feed_likes"`);
    await queryRunner.query(`DROP TABLE "feed_posts"`);
  }
}
