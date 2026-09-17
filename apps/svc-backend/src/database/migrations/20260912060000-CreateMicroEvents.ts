import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMicroEvents20260912060000 implements MigrationInterface {
  name = "CreateMicroEvents20260912060000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "micro_events" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "authorId" uuid NOT NULL, "title" character varying(200) NOT NULL, "startsAt" TIMESTAMP WITH TIME ZONE NOT NULL, "locationText" character varying(300), "placeId" uuid, "participantsLimit" integer NOT NULL, "status" character varying NOT NULL DEFAULT 'open', "published" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_micro_events" PRIMARY KEY ("id"), CONSTRAINT "FK_micro_events_author" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE)`);
    await queryRunner.query(`CREATE TABLE "micro_event_participants" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "microEventId" uuid NOT NULL, "userId" uuid NOT NULL, CONSTRAINT "PK_micro_event_participants" PRIMARY KEY ("id"), CONSTRAINT "UQ_micro_event_participants" UNIQUE ("microEventId", "userId"), CONSTRAINT "FK_micro_event_participants_event" FOREIGN KEY ("microEventId") REFERENCES "micro_events"("id") ON DELETE CASCADE, CONSTRAINT "FK_micro_event_participants_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "micro_event_participants"`);
    await queryRunner.query(`DROP TABLE "micro_events"`);
  }
}
