import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateWeGroupPhotos20260920050000 implements MigrationInterface {
  name = "CreateWeGroupPhotos20260920050000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "we_group_photos" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "groupId" uuid NOT NULL, "userId" uuid NOT NULL, "url" text NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_we_group_photos" PRIMARY KEY ("id"), CONSTRAINT "FK_we_group_photos_group" FOREIGN KEY ("groupId") REFERENCES "we_groups"("id") ON DELETE CASCADE, CONSTRAINT "FK_we_group_photos_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "we_group_photos"`);
  }
}
