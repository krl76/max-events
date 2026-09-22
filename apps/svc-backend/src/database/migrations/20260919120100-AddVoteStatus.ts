import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVoteStatus20260919120100 implements MigrationInterface {
  name = "AddVoteStatus20260919120100";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "votes" ADD COLUMN "status" varchar(16) NOT NULL DEFAULT 'open'`);
    await queryRunner.query(`ALTER TABLE "votes" ADD COLUMN "winnerEventId" uuid`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "votes" DROP COLUMN "winnerEventId"`);
    await queryRunner.query(`ALTER TABLE "votes" DROP COLUMN "status"`);
  }
}
