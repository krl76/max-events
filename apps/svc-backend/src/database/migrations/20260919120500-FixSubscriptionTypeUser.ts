import { MigrationInterface, QueryRunner } from "typeorm";

export class FixSubscriptionTypeUser20260919120500 implements MigrationInterface {
  name = "FixSubscriptionTypeUser20260919120500";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_subscriptions_user_target"`);
    await queryRunner.query(`ALTER TABLE "subscriptions" DROP CONSTRAINT "CHK_subscriptions_type"`);
    await queryRunner.query(`ALTER TABLE "subscriptions" ADD CONSTRAINT "CHK_subscriptions_type" CHECK ("type" IN ('organizer', 'place', 'interest', 'user'))`);
    await queryRunner.query(`ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_subscriptions_target_user" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE CASCADE`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_subscriptions_user_target" ON "subscriptions" ("userId", "targetUserId") WHERE "type" = 'user' AND "targetUserId" IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_subscriptions_user_target"`);
    await queryRunner.query(`ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_subscriptions_target_user"`);
    await queryRunner.query(`ALTER TABLE "subscriptions" DROP CONSTRAINT "CHK_subscriptions_type"`);
    await queryRunner.query(`ALTER TABLE "subscriptions" ADD CONSTRAINT "CHK_subscriptions_type" CHECK ("type" IN ('organizer', 'place', 'interest'))`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_subscriptions_user_target" ON "subscriptions" ("userId", "targetUserId") WHERE "targetUserId" IS NOT NULL`);
  }
}
