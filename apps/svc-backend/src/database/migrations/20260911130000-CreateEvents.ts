import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateEvents20260911130000 implements MigrationInterface {
  name = "CreateEvents20260911130000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "events" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "title" character varying(200) NOT NULL, "description" character varying(5000) NOT NULL DEFAULT '', "category" character varying NOT NULL, "city" character varying NOT NULL, "placeId" uuid, "startsAt" TIMESTAMP WITH TIME ZONE NOT NULL, "endsAt" TIMESTAMP WITH TIME ZONE, "isPaid" boolean NOT NULL DEFAULT false, "priceRub" integer, "paymentUrl" character varying, "capacity" integer, "published" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_events_category" CHECK ("category" IN ('afisha', 'volunteering', 'tourism', 'sport')), CONSTRAINT "CHK_events_payment" CHECK (("isPaid" = false AND "paymentUrl" IS NULL) OR ("isPaid" = true AND "paymentUrl" IS NOT NULL)), CONSTRAINT "FK_events_place" FOREIGN KEY ("placeId") REFERENCES "places"("id") ON DELETE SET NULL, CONSTRAINT "PK_events" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "events"`);
  }
}
