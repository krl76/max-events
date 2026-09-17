import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateListDigestSends20260912110000 implements MigrationInterface {
  name = "CreateListDigestSends20260912110000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "list_digest_sends" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "windowKey" character varying(40) NOT NULL, "fingerprint" character varying(64) NOT NULL, "eventCount" integer NOT NULL, "sentAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_list_digest_sends" PRIMARY KEY ("id"), CONSTRAINT "UQ_list_digest_sends_user_window_fp" UNIQUE ("userId", "windowKey", "fingerprint"), CONSTRAINT "FK_list_digest_sends_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "list_digest_sends"`);
  }
}
