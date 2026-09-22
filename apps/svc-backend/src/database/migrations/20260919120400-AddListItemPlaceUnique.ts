import { MigrationInterface, QueryRunner } from "typeorm";

export class AddListItemPlaceUnique20260919120400 implements MigrationInterface {
  name = "AddListItemPlaceUnique20260919120400";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "list_items" WHERE id IN (SELECT id FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY "listId", "placeId" ORDER BY "addedAt" DESC, id DESC) AS rn FROM "list_items" WHERE "placeId" IS NOT NULL) ranked WHERE rn > 1)`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_list_items_list_place" ON "list_items" ("listId", "placeId") WHERE "placeId" IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_list_items_list_place"`);
  }
}
