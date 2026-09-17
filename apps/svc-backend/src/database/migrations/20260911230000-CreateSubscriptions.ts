import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSubscriptions20260911230000 implements MigrationInterface {
  name = "CreateSubscriptions20260911230000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" ADD "organizerUserId" uuid`);
    await queryRunner.query(`ALTER TABLE "events" ADD CONSTRAINT "FK_events_organizer" FOREIGN KEY ("organizerUserId") REFERENCES "users"("id") ON DELETE SET NULL`);
    await queryRunner.query(`CREATE TABLE "subscriptions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "type" character varying NOT NULL, "organizerUserId" uuid, "placeId" uuid, "interest" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_subscriptions_type" CHECK ("type" IN ('organizer', 'place', 'interest')), CONSTRAINT "FK_subscriptions_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE, CONSTRAINT "FK_subscriptions_organizer" FOREIGN KEY ("organizerUserId") REFERENCES "users"("id") ON DELETE CASCADE, CONSTRAINT "FK_subscriptions_place" FOREIGN KEY ("placeId") REFERENCES "places"("id") ON DELETE CASCADE, CONSTRAINT "PK_subscriptions" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_subscriptions_user_organizer" ON "subscriptions" ("userId", "organizerUserId") WHERE "type" = 'organizer' AND "organizerUserId" IS NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_subscriptions_user_place" ON "subscriptions" ("userId", "placeId") WHERE "type" = 'place' AND "placeId" IS NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_subscriptions_user_interest" ON "subscriptions" ("userId", "interest") WHERE "type" = 'interest' AND "interest" IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_subscriptions_user_interest"`);
    await queryRunner.query(`DROP INDEX "UQ_subscriptions_user_place"`);
    await queryRunner.query(`DROP INDEX "UQ_subscriptions_user_organizer"`);
    await queryRunner.query(`DROP TABLE "subscriptions"`);
    await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT "FK_events_organizer"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "organizerUserId"`);
  }
}
