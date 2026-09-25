import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReviewFactTags20260919180000 implements MigrationInterface {
  name = "AddReviewFactTags20260919180000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reviews" ADD COLUMN "factTags" text[] NOT NULL DEFAULT '{}'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN "factTags"`);
  }
}
