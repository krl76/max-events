import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateProfiles20260911150000 implements MigrationInterface {
  name = "CreateProfiles20260911150000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "profiles" ("userId" uuid NOT NULL, "city" character varying NOT NULL, "interests" text[] NOT NULL DEFAULT '{}', "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_profiles" PRIMARY KEY ("userId"), CONSTRAINT "FK_profiles_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "profiles"`);
  }
}
