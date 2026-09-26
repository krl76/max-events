import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFriendshipClose20260921120000 implements MigrationInterface {
  name = "AddFriendshipClose20260921120000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "friendships" ADD COLUMN "closeFriend" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "friendships" DROP COLUMN "closeFriend"`);
  }
}
