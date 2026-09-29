import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEventAfishaSource20260927140000 implements MigrationInterface {
  name = "AddEventAfishaSource20260927140000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" ADD COLUMN "source" varchar`);
    await queryRunner.query(`ALTER TABLE "events" ADD COLUMN "externalId" varchar`);
    await queryRunner.query(`ALTER TABLE "events" ADD COLUMN "popularity" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "places" ADD COLUMN "source" varchar`);
    await queryRunner.query(`ALTER TABLE "places" ADD COLUMN "externalId" varchar`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_events_source_externalId" ON "events" ("source", "externalId") WHERE "externalId" IS NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_places_source_externalId" ON "places" ("source", "externalId") WHERE "externalId" IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_places_source_externalId"`);
    await queryRunner.query(`DROP INDEX "UQ_events_source_externalId"`);
    await queryRunner.query(`ALTER TABLE "places" DROP COLUMN "externalId"`);
    await queryRunner.query(`ALTER TABLE "places" DROP COLUMN "source"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "popularity"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "externalId"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "source"`);
  }
}
