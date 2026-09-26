import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateFeedDrafts20260920130000 implements MigrationInterface {
  name = "CreateFeedDrafts20260920130000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "feed_drafts" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "authorUserId" uuid NOT NULL, "eventId" uuid, "text" character varying(5000) NOT NULL DEFAULT '', "photoUrls" text[] NOT NULL DEFAULT '{}', "placeId" uuid, "taggedFriendIds" text[] NOT NULL DEFAULT '{}', "audience" character varying(16) NOT NULL DEFAULT 'friends', "allowJoin" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_feed_drafts" PRIMARY KEY ("id"), CONSTRAINT "UQ_feed_drafts_author" UNIQUE ("authorUserId"), CONSTRAINT "FK_feed_drafts_author" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE CASCADE)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "feed_drafts"`);
  }
}
