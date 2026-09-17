import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePageViews20260912140000 implements MigrationInterface {
  name = "CreatePageViews20260912140000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "page_views" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "targetType" character varying NOT NULL, "targetId" uuid NOT NULL, "viewedOn" date NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_page_views" PRIMARY KEY ("id"), CONSTRAINT "UQ_page_views_user_target_day" UNIQUE ("userId", "targetType", "targetId", "viewedOn"), CONSTRAINT "FK_page_views_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "page_views"`);
  }
}
