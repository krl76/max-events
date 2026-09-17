import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePlaces20260911120000 implements MigrationInterface {
  name = "CreatePlaces20260911120000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "places" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "title" character varying(200) NOT NULL, "address" character varying(300) NOT NULL, "city" character varying NOT NULL, "category" character varying NOT NULL, "latitude" double precision NOT NULL, "longitude" double precision NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_places_category" CHECK ("category" IN ('park', 'museum', 'food', 'sport', 'other')), CONSTRAINT "CHK_places_latitude" CHECK ("latitude" >= -90 AND "latitude" <= 90), CONSTRAINT "CHK_places_longitude" CHECK ("longitude" >= -180 AND "longitude" <= 180), CONSTRAINT "UQ_places_title_address_city" UNIQUE ("title", "address", "city"), CONSTRAINT "PK_places" PRIMARY KEY ("id"))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "places"`);
  }
}
