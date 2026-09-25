import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSwipeDecisions20260919170000 implements MigrationInterface {
  name = "CreateSwipeDecisions20260919170000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "swipe_decisions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "placeId" uuid NOT NULL, "decision" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_swipe_decisions" PRIMARY KEY ("id"), CONSTRAINT "UQ_swipe_decisions_user_place" UNIQUE ("userId", "placeId"), CONSTRAINT "FK_swipe_decisions_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE, CONSTRAINT "FK_swipe_decisions_place" FOREIGN KEY ("placeId") REFERENCES "places"("id") ON DELETE CASCADE)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "swipe_decisions"`);
  }
}
