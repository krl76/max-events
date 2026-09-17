import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateWaitlistEntries20260912020000 implements MigrationInterface {
  name = "CreateWaitlistEntries20260912020000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "waitlist_entries" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "eventId" uuid NOT NULL, "status" character varying NOT NULL DEFAULT 'waiting', "offeredUntil" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_waitlist_entries" PRIMARY KEY ("id"), CONSTRAINT "FK_waitlist_entries_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE, CONSTRAINT "FK_waitlist_entries_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE)`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_waitlist_active_user_event" ON "waitlist_entries" ("userId", "eventId") WHERE status IN ('waiting', 'offered')`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "waitlist_entries"`);
  }
}
