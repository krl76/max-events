import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEventChatLink20260911160000 implements MigrationInterface {
  name = "AddEventChatLink20260911160000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" ADD COLUMN "chatLink" character varying`);
    await queryRunner.query(`ALTER TABLE "events" ADD COLUMN "chatSyncPending" boolean NOT NULL DEFAULT true`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "chatSyncPending"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "chatLink"`);
  }
}
