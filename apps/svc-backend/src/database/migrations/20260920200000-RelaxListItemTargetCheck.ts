import { MigrationInterface, QueryRunner } from "typeorm";

/** The 190000 migration added feedPostId but left CHK_list_items_target as event-XOR-place, so saving a post failed the check and the picker rolled back. */
export class RelaxListItemTargetCheck20260920200000 implements MigrationInterface {
  name = "RelaxListItemTargetCheck20260920200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "list_items" DROP CONSTRAINT IF EXISTS "CHK_list_items_target"`);
    await queryRunner.query(`ALTER TABLE "list_items" ADD CONSTRAINT "CHK_list_items_target" CHECK ((("eventId" IS NOT NULL)::int + ("placeId" IS NOT NULL)::int + ("feedPostId" IS NOT NULL)::int) = 1)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "list_items" DROP CONSTRAINT IF EXISTS "CHK_list_items_target"`);
    await queryRunner.query(`ALTER TABLE "list_items" ADD CONSTRAINT "CHK_list_items_target" CHECK (("eventId" IS NOT NULL AND "placeId" IS NULL) OR ("eventId" IS NULL AND "placeId" IS NOT NULL))`);
  }
}
