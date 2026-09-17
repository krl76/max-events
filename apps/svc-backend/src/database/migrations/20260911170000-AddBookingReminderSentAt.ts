import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingReminderSentAt20260911170000 implements MigrationInterface {
  name = "AddBookingReminderSentAt20260911170000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bookings" ADD COLUMN "reminderSentAt" TIMESTAMP WITH TIME ZONE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "reminderSentAt"`);
  }
}
