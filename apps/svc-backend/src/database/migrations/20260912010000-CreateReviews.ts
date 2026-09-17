import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateReviews20260912010000 implements MigrationInterface {
  name = "CreateReviews20260912010000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "reviews" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "eventId" uuid NOT NULL, "stars" integer NOT NULL, "categoryScores" jsonb NOT NULL DEFAULT '{}', "wouldGoAgain" boolean NOT NULL, "photoUrls" text[] NOT NULL DEFAULT '{}', "text" character varying(2000), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_reviews" PRIMARY KEY ("id"), CONSTRAINT "UQ_reviews_user_event" UNIQUE ("userId", "eventId"), CONSTRAINT "FK_reviews_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE, CONSTRAINT "FK_reviews_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE, CONSTRAINT "CHK_reviews_stars" CHECK ("stars" BETWEEN 1 AND 5))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "reviews"`);
  }
}
