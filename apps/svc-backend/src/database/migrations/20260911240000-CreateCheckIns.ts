import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCheckIns20260911240000 implements MigrationInterface {
  name = "CreateCheckIns20260911240000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "check_ins" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "eventId" uuid, "placeId" uuid, "visitDate" date, "checkedInAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_check_ins_target" CHECK (("eventId" IS NOT NULL AND "placeId" IS NULL) OR ("eventId" IS NULL AND "placeId" IS NOT NULL)), CONSTRAINT "FK_check_ins_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE, CONSTRAINT "FK_check_ins_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE, CONSTRAINT "FK_check_ins_place" FOREIGN KEY ("placeId") REFERENCES "places"("id") ON DELETE CASCADE, CONSTRAINT "PK_check_ins" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_check_ins_user_event" ON "check_ins" ("userId", "eventId") WHERE "eventId" IS NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_check_ins_user_place_day" ON "check_ins" ("userId", "placeId", "visitDate") WHERE "placeId" IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_check_ins_user_place_day"`);
    await queryRunner.query(`DROP INDEX "UQ_check_ins_user_event"`);
    await queryRunner.query(`DROP TABLE "check_ins"`);
  }
}
