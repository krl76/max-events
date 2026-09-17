import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateParticipations20260911180000 implements MigrationInterface {
  name = "CreateParticipations20260911180000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "participations" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "eventId" uuid NOT NULL, "status" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_participations_status" CHECK ("status" IN ('wants_to_go', 'probably_going', 'going', 'looking_for_company', 'looking_for_travel_buddy', 'looking_for_after_event_company')), CONSTRAINT "FK_participations_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE, CONSTRAINT "FK_participations_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE, CONSTRAINT "PK_participations" PRIMARY KEY ("id"), CONSTRAINT "UQ_participations_user_event" UNIQUE ("userId", "eventId"))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "participations"`);
  }
}
