import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSlotExtrasWaitlistChat20260920170000 implements MigrationInterface {
  name = "CreateSlotExtrasWaitlistChat20260920170000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "place_extras" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "placeId" uuid NOT NULL, "title" character varying(200) NOT NULL, "priceRub" integer NOT NULL, CONSTRAINT "PK_place_extras" PRIMARY KEY ("id"), CONSTRAINT "FK_place_extras_place" FOREIGN KEY ("placeId") REFERENCES "places"("id") ON DELETE CASCADE)`);
    await queryRunner.query(`CREATE TABLE "slot_waitlist" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "slotId" uuid NOT NULL, "placeId" uuid NOT NULL, "userId" uuid NOT NULL, "seats" integer NOT NULL DEFAULT 1, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_slot_waitlist" PRIMARY KEY ("id"), CONSTRAINT "UQ_slot_waitlist_slot_user" UNIQUE ("slotId", "userId"), CONSTRAINT "FK_slot_waitlist_slot" FOREIGN KEY ("slotId") REFERENCES "place_slots"("id") ON DELETE CASCADE)`);
    await queryRunner.query(`CREATE TABLE "slot_chat_messages" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "bookingId" uuid NOT NULL, "userId" uuid NOT NULL, "text" character varying(2000) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_slot_chat_messages" PRIMARY KEY ("id"), CONSTRAINT "FK_slot_chat_booking" FOREIGN KEY ("bookingId") REFERENCES "slot_bookings"("id") ON DELETE CASCADE)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "slot_chat_messages"`);
    await queryRunner.query(`DROP TABLE "slot_waitlist"`);
    await queryRunner.query(`DROP TABLE "place_extras"`);
  }
}
