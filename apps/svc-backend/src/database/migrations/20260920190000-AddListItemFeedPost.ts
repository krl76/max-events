import { MigrationInterface, QueryRunner } from "typeorm";

export class AddListItemFeedPost20260920190000 implements MigrationInterface {
  name = "AddListItemFeedPost20260920190000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "list_items" ADD COLUMN "feedPostId" uuid`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_list_items_list_feed_post" ON "list_items" ("listId", "feedPostId") WHERE "feedPostId" IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_list_items_list_feed_post"`);
    await queryRunner.query(`ALTER TABLE "list_items" DROP COLUMN "feedPostId"`);
  }
}
