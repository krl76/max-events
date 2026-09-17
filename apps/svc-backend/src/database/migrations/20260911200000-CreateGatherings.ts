import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateGatherings20260911200000 implements MigrationInterface {
  name = "CreateGatherings20260911200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "gatherings" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "hostUserId" uuid NOT NULL, "eventId" uuid NOT NULL, "proposedMeetingAt" TIMESTAMP WITH TIME ZONE NOT NULL, "status" character varying NOT NULL, "chatLink" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_gatherings_status" CHECK ("status" IN ('draft', 'awaiting_responses', 'confirmed', 'cancelled')), CONSTRAINT "FK_gatherings_host" FOREIGN KEY ("hostUserId") REFERENCES "users"("id") ON DELETE CASCADE, CONSTRAINT "FK_gatherings_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE, CONSTRAINT "PK_gatherings" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE "gathering_invitees" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "gatheringId" uuid NOT NULL, "userId" uuid NOT NULL, "response" character varying NOT NULL, "respondedAt" TIMESTAMP WITH TIME ZONE, "reminderSentAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_gathering_invitees_response" CHECK ("response" IN ('accepted', 'considering', 'busy')), CONSTRAINT "FK_gathering_invitees_gathering" FOREIGN KEY ("gatheringId") REFERENCES "gatherings"("id") ON DELETE CASCADE, CONSTRAINT "FK_gathering_invitees_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE, CONSTRAINT "PK_gathering_invitees" PRIMARY KEY ("id"), CONSTRAINT "UQ_gathering_invitees_gathering_user" UNIQUE ("gatheringId", "userId"))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "gathering_invitees"`);
    await queryRunner.query(`DROP TABLE "gatherings"`);
  }
}
