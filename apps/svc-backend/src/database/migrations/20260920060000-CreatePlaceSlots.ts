import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePlaceSlots20260920060000 implements MigrationInterface {
  name = "CreatePlaceSlots20260920060000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "place_slots" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "placeId" uuid NOT NULL, "startsAt" TIMESTAMP WITH TIME ZONE NOT NULL, "endsAt" TIMESTAMP WITH TIME ZONE NOT NULL, "capacity" integer NOT NULL, "takenSeats" integer NOT NULL DEFAULT 0, "priceRub" integer, "unitTitle" character varying(200) NOT NULL DEFAULT 'Площадка', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_place_slots" PRIMARY KEY ("id"), CONSTRAINT "UQ_place_slots_place_start" UNIQUE ("placeId", "startsAt"), CONSTRAINT "FK_place_slots_place" FOREIGN KEY ("placeId") REFERENCES "places"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE TABLE "slot_bookings" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "slotId" uuid NOT NULL, "placeId" uuid NOT NULL, "userId" uuid NOT NULL, "status" character varying NOT NULL DEFAULT 'active', "partySize" integer NOT NULL DEFAULT 1, "extraIds" text[] NOT NULL DEFAULT '{}', "totalRub" integer NOT NULL DEFAULT 0, "cancelBefore" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_slot_bookings" PRIMARY KEY ("id"), CONSTRAINT "UQ_slot_bookings_slot_user_active" UNIQUE ("slotId", "userId"), CONSTRAINT "FK_slot_bookings_slot" FOREIGN KEY ("slotId") REFERENCES "place_slots"("id") ON DELETE CASCADE, CONSTRAINT "FK_slot_bookings_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "slot_bookings"`);
    await queryRunner.query(`DROP TABLE "place_slots"`);
  }
}
