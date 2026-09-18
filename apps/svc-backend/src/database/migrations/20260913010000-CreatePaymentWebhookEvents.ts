import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePaymentWebhookEvents20260913010000 implements MigrationInterface {
  name = "CreatePaymentWebhookEvents20260913010000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM "payments" GROUP BY "providerPaymentId" HAVING COUNT(*) > 1) THEN RAISE EXCEPTION 'duplicate payments.providerPaymentId; cannot create UQ_payments_provider_payment'; END IF; END $$;`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_payments_provider_payment" ON "payments" ("providerPaymentId")`);
    await queryRunner.query(`CREATE TABLE "payment_webhook_events" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "providerEventId" character varying(80) NOT NULL, "providerPaymentId" character varying(80) NOT NULL, "status" character varying(16) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_payment_webhook_events" PRIMARY KEY ("id"), CONSTRAINT "UQ_payment_webhook_events_provider_event" UNIQUE ("providerEventId"))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "payment_webhook_events"`);
    await queryRunner.query(`DROP INDEX "UQ_payments_provider_payment"`);
  }
}
