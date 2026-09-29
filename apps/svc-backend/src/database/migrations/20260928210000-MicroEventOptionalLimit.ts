import { MigrationInterface, QueryRunner } from "typeorm";

/** A gathering can stay open with no seat cap. Existing rows keep the number they already have. */
export class MicroEventOptionalLimit20260928210000 implements MigrationInterface {
  name = "MicroEventOptionalLimit20260928210000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "micro_events" ALTER COLUMN "participantsLimit" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "micro_events" SET "participantsLimit" = 6 WHERE "participantsLimit" IS NULL`);
    await queryRunner.query(`ALTER TABLE "micro_events" ALTER COLUMN "participantsLimit" SET NOT NULL`);
  }
}
