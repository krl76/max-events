import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEventCoverUrl20260919120300 implements MigrationInterface {
  name = "AddEventCoverUrl20260919120300";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" ADD COLUMN "coverUrl" varchar`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "coverUrl"`);
  }
}
