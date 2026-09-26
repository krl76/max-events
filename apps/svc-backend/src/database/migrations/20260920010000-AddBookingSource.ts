import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingSource20260920010000 implements MigrationInterface {
  name = "AddBookingSource20260920010000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bookings" ADD COLUMN "source" character varying(16)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "source"`);
  }
}
