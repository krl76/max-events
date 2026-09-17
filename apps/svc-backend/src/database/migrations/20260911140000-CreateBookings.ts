import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBookings20260911140000 implements MigrationInterface {
  name = "CreateBookings20260911140000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" ADD COLUMN "bookedCount" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`CREATE TABLE "bookings" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "eventId" uuid NOT NULL, "status" character varying NOT NULL DEFAULT 'active', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_bookings_status" CHECK ("status" IN ('active', 'cancelled')), CONSTRAINT "FK_bookings_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE, CONSTRAINT "FK_bookings_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE, CONSTRAINT "PK_bookings" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_bookings_active_user_event" ON "bookings" ("userId", "eventId") WHERE "status" = 'active'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_bookings_active_user_event"`);
    await queryRunner.query(`DROP TABLE "bookings"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "bookedCount"`);
  }
}
