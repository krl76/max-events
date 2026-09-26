import { MigrationInterface, QueryRunner } from "typeorm";

export class AddListItemFeedPost20260920190000 implements MigrationInterface {
  name = "AddListItemFeedPost20260920190000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "list_items" DROP CONSTRAINT "CHK_list_items_target"`);
    await queryRunner.query(`ALTER TABLE "list_items" ADD COLUMN "feedPostId" uuid`);
    await queryRunner.query(`ALTER TABLE "list_items" ADD CONSTRAINT "CHK_list_items_target" CHECK ((("eventId" IS NOT NULL)::int + ("placeId" IS NOT NULL)::int + ("feedPostId" IS NOT NULL)::int) = 1)`);
    await queryRunner.query(`ALTER TABLE "list_items" ADD CONSTRAINT "FK_list_items_feed_post" FOREIGN KEY ("feedPostId") REFERENCES "feed_posts"("id") ON DELETE CASCADE`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_list_items_list_feed_post" ON "list_items" ("listId", "feedPostId") WHERE "feedPostId" IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_list_items_list_feed_post"`);
    await queryRunner.query(`ALTER TABLE "list_items" DROP CONSTRAINT "FK_list_items_feed_post"`);
    await queryRunner.query(`ALTER TABLE "list_items" DROP CONSTRAINT "CHK_list_items_target"`);
    await queryRunner.query(`ALTER TABLE "list_items" DROP COLUMN "feedPostId"`);
    await queryRunner.query(`ALTER TABLE "list_items" ADD CONSTRAINT "CHK_list_items_target" CHECK (("eventId" IS NOT NULL AND "placeId" IS NULL) OR ("eventId" IS NULL AND "placeId" IS NOT NULL))`);
  }
}
