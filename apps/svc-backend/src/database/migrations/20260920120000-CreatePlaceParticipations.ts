import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePlaceParticipations20260920120000 implements MigrationInterface {
  name = "CreatePlaceParticipations20260920120000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "place_participations" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "placeId" uuid NOT NULL, "status" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_place_participations_status" CHECK ("status" IN ('wants_to_go', 'probably_going', 'going', 'looking_for_company', 'looking_for_travel_buddy', 'looking_for_after_event_company')), CONSTRAINT "FK_place_participations_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE, CONSTRAINT "FK_place_participations_place" FOREIGN KEY ("placeId") REFERENCES "places"("id") ON DELETE CASCADE, CONSTRAINT "PK_place_participations" PRIMARY KEY ("id"), CONSTRAINT "UQ_place_participations_user_place" UNIQUE ("userId", "placeId"))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "place_participations"`);
  }
}
