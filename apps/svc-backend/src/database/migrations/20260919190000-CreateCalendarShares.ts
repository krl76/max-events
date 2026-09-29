import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCalendarShares20260919190000 implements MigrationInterface {
  name = "CreateCalendarShares20260919190000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "calendar_shares" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "ownerUserId" uuid NOT NULL, "peerUserId" uuid NOT NULL, "canEdit" boolean NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_calendar_shares" PRIMARY KEY ("id"), CONSTRAINT "UQ_calendar_shares_owner_peer" UNIQUE ("ownerUserId", "peerUserId"), CONSTRAINT "FK_calendar_shares_owner" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE, CONSTRAINT "FK_calendar_shares_peer" FOREIGN KEY ("peerUserId") REFERENCES "users"("id") ON DELETE CASCADE)`);
    await queryRunner.query(`CREATE TABLE "calendar_invites" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "token" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_calendar_invites" PRIMARY KEY ("id"), CONSTRAINT "UQ_calendar_invites_user" UNIQUE ("userId"), CONSTRAINT "UQ_calendar_invites_token" UNIQUE ("token"), CONSTRAINT "FK_calendar_invites_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE)`);
    await queryRunner.query(`CREATE TABLE "calendar_goings" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "eventId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_calendar_goings" PRIMARY KEY ("id"), CONSTRAINT "UQ_calendar_goings_user_event" UNIQUE ("userId", "eventId"), CONSTRAINT "FK_calendar_goings_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE, CONSTRAINT "FK_calendar_goings_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "calendar_goings"`);
    await queryRunner.query(`DROP TABLE "calendar_invites"`);
    await queryRunner.query(`DROP TABLE "calendar_shares"`);
  }
}
