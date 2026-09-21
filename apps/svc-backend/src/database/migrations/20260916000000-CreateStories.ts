import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateStories20260916000000 implements MigrationInterface {
  name = "CreateStories20260916000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "stories" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "imageUrl" text NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_stories" PRIMARY KEY ("id"), CONSTRAINT "FK_stories_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "stories"`);
  }
}
