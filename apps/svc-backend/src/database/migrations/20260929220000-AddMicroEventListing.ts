import { MigrationInterface, QueryRunner } from "typeorm";

/** A gathering can carry a note and stay off the public list. Existing rows stay listed and keep an empty note. */
export class AddMicroEventListing20260929220000 implements MigrationInterface {
  name = "AddMicroEventListing20260929220000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "micro_events" ADD "description" character varying(2000) NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "micro_events" ADD "listed" boolean NOT NULL DEFAULT true`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "micro_events" DROP COLUMN "listed"`);
    await queryRunner.query(`ALTER TABLE "micro_events" DROP COLUMN "description"`);
  }
}
