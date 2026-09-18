import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPaymentCommission20260913020000 implements MigrationInterface {
  name = "AddPaymentCommission20260913020000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payments" ADD COLUMN "commissionRub" integer`);
    await queryRunner.query(`ALTER TABLE "payments" ADD COLUMN "netRub" integer`);
    await queryRunner.query(`ALTER TABLE "payments" ADD COLUMN "commissionBps" integer`);
    await queryRunner.query(`ALTER TABLE "payments" ADD COLUMN "commissionFixedAt" TIMESTAMP WITH TIME ZONE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "commissionFixedAt"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "commissionBps"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "netRub"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "commissionRub"`);
  }
}
