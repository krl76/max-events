import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProfileBioCoverAvatarCustom20260920100000 implements MigrationInterface {
  name = "AddProfileBioCoverAvatarCustom20260920100000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "profiles" ADD COLUMN "bio" varchar(150) NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "profiles" ADD COLUMN "coverUrl" text`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "avatarCustom" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatarCustom"`);
    await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN "coverUrl"`);
    await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN "bio"`);
  }
}
