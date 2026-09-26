import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateEventOptions20260920150000 implements MigrationInterface {
  name = "CreateEventOptions20260920150000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "event_options" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "eventId" uuid NOT NULL, "waitlistEnabled" boolean NOT NULL DEFAULT true, "registrationInApp" boolean NOT NULL DEFAULT true, "externalUrl" character varying, "recurrenceRule" character varying(16), "recurrenceUntil" TIMESTAMP WITH TIME ZONE, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_event_options" PRIMARY KEY ("id"), CONSTRAINT "UQ_event_options_event" UNIQUE ("eventId"), CONSTRAINT "FK_event_options_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "event_options"`);
  }
}
