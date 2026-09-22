import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSubscriptionTargetUser20260919120200 implements MigrationInterface {
  name = "AddSubscriptionTargetUser20260919120200";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "subscriptions" ADD COLUMN "targetUserId" uuid`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_subscriptions_user_target" ON "subscriptions" ("userId", "targetUserId") WHERE "targetUserId" IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_subscriptions_user_target"`);
    await queryRunner.query(`ALTER TABLE "subscriptions" DROP COLUMN "targetUserId"`);
  }
}
