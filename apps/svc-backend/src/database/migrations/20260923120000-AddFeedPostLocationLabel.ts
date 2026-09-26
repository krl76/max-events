import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFeedPostLocationLabel20260923120000 implements MigrationInterface {
  name = "AddFeedPostLocationLabel20260923120000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "feed_posts" ADD COLUMN "locationLabel" character varying(120)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "feed_posts" DROP COLUMN "locationLabel"`);
  }
}
