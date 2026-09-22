import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFriendsSyncedAt20260919120000 implements MigrationInterface {
  name = "AddFriendsSyncedAt20260919120000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "friendsSyncedAt" TIMESTAMPTZ`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "friendsSyncedAt"`);
  }
}
