import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrganizerSetup20260919140000 implements MigrationInterface {
  name = "AddOrganizerSetup20260919140000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "organizations" ADD COLUMN "setupStep" character varying(16) NOT NULL DEFAULT 'venue'`);
    await queryRunner.query(`ALTER TABLE "organizations" ADD COLUMN "setupCompletedAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "organizations" ADD COLUMN "activities" jsonb NOT NULL DEFAULT '[]'`);
    await queryRunner.query(`ALTER TABLE "organizations" ADD COLUMN "venuePlaceId" uuid`);
    await queryRunner.query(`ALTER TABLE "organizations" ADD COLUMN "venueTitle" character varying(200) NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "organizations" ADD COLUMN "venueAddress" character varying(300) NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "organizations" ADD COLUMN "venueCity" character varying(200) NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "organizations" ADD COLUMN "payoutMode" character varying(16) NOT NULL DEFAULT 'none'`);
    await queryRunner.query(`ALTER TABLE "organizations" ADD COLUMN "paymentUrl" character varying`);
    await queryRunner.query(`ALTER TABLE "organizations" ADD CONSTRAINT "CHK_organizations_setup_step" CHECK ("setupStep" IN ('venue', 'payouts', 'event'))`);
    await queryRunner.query(`ALTER TABLE "organizations" ADD CONSTRAINT "CHK_organizations_payout_mode" CHECK ("payoutMode" IN ('external', 'none'))`);
    await queryRunner.query(`ALTER TABLE "organizations" ADD CONSTRAINT "FK_organizations_venue_place" FOREIGN KEY ("venuePlaceId") REFERENCES "places"("id") ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE "places" ADD COLUMN "logoUrl" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "places" DROP COLUMN "logoUrl"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP CONSTRAINT "FK_organizations_venue_place"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP CONSTRAINT "CHK_organizations_payout_mode"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP CONSTRAINT "CHK_organizations_setup_step"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "paymentUrl"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "payoutMode"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "venueCity"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "venueAddress"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "venueTitle"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "venuePlaceId"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "activities"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "setupCompletedAt"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "setupStep"`);
  }
}
