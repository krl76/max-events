import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUserAchievements20260911250000 implements MigrationInterface {
  name = "CreateUserAchievements20260911250000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "user_achievements" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "code" character varying NOT NULL, "grantedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "CHK_user_achievements_code" CHECK ("code" IN ('city_explorer', 'music_fan', 'weekend_city', 'volunteer')), CONSTRAINT "FK_user_achievements_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE, CONSTRAINT "PK_user_achievements" PRIMARY KEY ("id"), CONSTRAINT "UQ_user_achievements_user_code" UNIQUE ("userId", "code"))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_achievements"`);
  }
}
