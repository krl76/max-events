import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPlanAssembledByMax20260920160000 implements MigrationInterface {
  name = "AddPlanAssembledByMax20260920160000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plans" ADD COLUMN "assembledByMax" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN "assembledByMax"`);
  }
}
