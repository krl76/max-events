import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateReports20260912040000 implements MigrationInterface {
  name = "CreateReports20260912040000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "reports" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "targetType" character varying NOT NULL, "targetId" uuid NOT NULL, "reason" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'open', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_reports" PRIMARY KEY ("id"), CONSTRAINT "UQ_reports_user_target" UNIQUE ("userId", "targetType", "targetId"), CONSTRAINT "FK_reports_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "reports"`);
  }
}
