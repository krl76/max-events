import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWaitlistReferralCode20260912172000 implements MigrationInterface {
  name = "AddWaitlistReferralCode20260912172000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "waitlist_entries" ADD COLUMN "referralCode" character varying(40)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "waitlist_entries" DROP COLUMN "referralCode"`);
  }
}
