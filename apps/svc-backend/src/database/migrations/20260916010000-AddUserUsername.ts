import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserUsername20260916010000 implements MigrationInterface {
  name = "AddUserUsername20260916010000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "username" varchar(64)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "username"`);
  }
}
