import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVoteOptionPosition20260912201000 implements MigrationInterface {
  name = "AddVoteOptionPosition20260912201000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "vote_options" ADD COLUMN "position" integer NOT NULL DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "vote_options" DROP COLUMN "position"`);
  }
}
