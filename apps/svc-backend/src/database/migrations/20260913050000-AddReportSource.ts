import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReportSource20260913050000 implements MigrationInterface {
  name = "AddReportSource20260913050000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reports" ADD "source" character varying NOT NULL DEFAULT 'user'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN "source"`);
  }
}
