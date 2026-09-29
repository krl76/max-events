import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCityWalks20260927120000 implements MigrationInterface {
  name = "CreateCityWalks20260927120000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "city_walks" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "city" character varying NOT NULL, "payload" jsonb NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_city_walks" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_city_walks_user_created" ON "city_walks" ("user_id", "created_at" DESC)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_city_walks_user_created"`);
    await queryRunner.query(`DROP TABLE "city_walks"`);
  }
}
