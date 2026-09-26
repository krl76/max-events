import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMicroEventExpenses20260923160000 implements MigrationInterface {
  name = "CreateMicroEventExpenses20260923160000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "micro_event_expenses" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "microEventId" uuid NOT NULL, "title" character varying(200) NOT NULL, "amountRub" integer NOT NULL, "payerUserId" uuid NOT NULL, "shareUserIds" jsonb NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_micro_event_expenses" PRIMARY KEY ("id"), CONSTRAINT "FK_micro_event_expenses_event" FOREIGN KEY ("microEventId") REFERENCES "micro_events"("id") ON DELETE CASCADE, CONSTRAINT "FK_micro_event_expenses_payer" FOREIGN KEY ("payerUserId") REFERENCES "users"("id") ON DELETE CASCADE)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "micro_event_expenses"`);
  }
}
