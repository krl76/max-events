import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePromoCodes20260912150000 implements MigrationInterface {
  name = "CreatePromoCodes20260912150000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" ADD COLUMN "bookingOpensAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "bookings" ADD COLUMN "promoCode" character varying(40)`);
    await queryRunner.query(`CREATE TABLE "promo_codes" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "eventId" uuid NOT NULL, "organizerUserId" uuid NOT NULL, "code" character varying(40) NOT NULL, "maxRedemptions" integer, "redeemedCount" integer NOT NULL DEFAULT 0, "expiresAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_promo_codes" PRIMARY KEY ("id"), CONSTRAINT "UQ_promo_codes_event_code" UNIQUE ("eventId", "code"), CONSTRAINT "FK_promo_codes_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE, CONSTRAINT "FK_promo_codes_organizer" FOREIGN KEY ("organizerUserId") REFERENCES "users"("id") ON DELETE CASCADE)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "promo_codes"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "promoCode"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "bookingOpensAt"`);
  }
}
