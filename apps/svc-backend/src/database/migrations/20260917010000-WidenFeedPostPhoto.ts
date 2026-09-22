import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * A picked photo is stored as a data URL until object storage lands (#477), and varchar(500) fits no
 * photo at all. Widening keeps every existing value; the revert truncates, so it drops the column's
 * contents rather than failing halfway through a table.
 */
export class WidenFeedPostPhoto20260917010000 implements MigrationInterface {
  name = "WidenFeedPostPhoto20260917010000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "feed_posts" ALTER COLUMN "photoUrl" TYPE text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "feed_posts" SET "photoUrl" = NULL WHERE length("photoUrl") > 500`);
    await queryRunner.query(`ALTER TABLE "feed_posts" ALTER COLUMN "photoUrl" TYPE character varying(500)`);
  }
}
