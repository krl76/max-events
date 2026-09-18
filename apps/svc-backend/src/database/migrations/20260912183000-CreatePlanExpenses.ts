import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePlanExpenses20260912183000 implements MigrationInterface {
  name = "CreatePlanExpenses20260912183000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "plan_expenses" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "planId" uuid NOT NULL, "title" character varying(200) NOT NULL, "amountRub" integer NOT NULL, "payerUserId" uuid NOT NULL, "shareUserIds" jsonb NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_plan_expenses" PRIMARY KEY ("id"), CONSTRAINT "FK_plan_expenses_plan" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE, CONSTRAINT "FK_plan_expenses_payer" FOREIGN KEY ("payerUserId") REFERENCES "users"("id") ON DELETE CASCADE)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "plan_expenses"`);
  }
}
