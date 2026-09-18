import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePayments20260912210000 implements MigrationInterface {
  name = "CreatePayments20260912210000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "bookingId" uuid NOT NULL, "providerPaymentId" character varying(80) NOT NULL, "status" character varying(16) NOT NULL, "amountRub" integer NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'RUB', "description" character varying(300) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_payments" PRIMARY KEY ("id"), CONSTRAINT "UQ_payments_booking" UNIQUE ("bookingId"), CONSTRAINT "CHK_payments_status" CHECK ("status" IN ('pending', 'succeeded', 'failed', 'cancelled', 'refunded')), CONSTRAINT "FK_payments_booking" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "payments"`);
  }
}
