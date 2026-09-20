import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFeedPostPhoto20260913040000 implements MigrationInterface {
  name = "AddFeedPostPhoto20260913040000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "feed_posts" ADD "photoUrl" character varying(500)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "feed_posts" DROP COLUMN "photoUrl"`);
  }
}
