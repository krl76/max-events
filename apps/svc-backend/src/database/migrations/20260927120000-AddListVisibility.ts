import { MigrationInterface, QueryRunner } from "typeorm";

export class AddListVisibility20260927120000 implements MigrationInterface {
  name = "AddListVisibility20260927120000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "lists" ADD COLUMN "visibility" character varying(16) NOT NULL DEFAULT 'private'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "lists" DROP COLUMN "visibility"`);
  }
}
