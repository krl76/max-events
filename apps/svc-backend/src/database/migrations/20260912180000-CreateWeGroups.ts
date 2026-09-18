import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateWeGroups20260912180000 implements MigrationInterface {
  name = "CreateWeGroups20260912180000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "we_groups" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "ownerUserId" uuid NOT NULL, "title" character varying(200) NOT NULL, "chatLink" character varying, "status" character varying(16) NOT NULL DEFAULT 'active', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "archivedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_we_groups" PRIMARY KEY ("id"), CONSTRAINT "FK_we_groups_owner" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE)`);
    await queryRunner.query(`CREATE TABLE "we_group_members" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "groupId" uuid NOT NULL, "userId" uuid NOT NULL, CONSTRAINT "PK_we_group_members" PRIMARY KEY ("id"), CONSTRAINT "UQ_we_group_members_group_user" UNIQUE ("groupId", "userId"), CONSTRAINT "FK_we_group_members_group" FOREIGN KEY ("groupId") REFERENCES "we_groups"("id") ON DELETE CASCADE, CONSTRAINT "FK_we_group_members_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE)`);
    await queryRunner.query(`CREATE TABLE "we_group_items" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "groupId" uuid NOT NULL, "eventId" uuid, "placeId" uuid, CONSTRAINT "PK_we_group_items" PRIMARY KEY ("id"), CONSTRAINT "FK_we_group_items_group" FOREIGN KEY ("groupId") REFERENCES "we_groups"("id") ON DELETE CASCADE, CONSTRAINT "FK_we_group_items_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE, CONSTRAINT "FK_we_group_items_place" FOREIGN KEY ("placeId") REFERENCES "places"("id") ON DELETE CASCADE)`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_we_group_items_event" ON "we_group_items" ("groupId", "eventId") WHERE "eventId" IS NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_we_group_items_place" ON "we_group_items" ("groupId", "placeId") WHERE "placeId" IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "we_group_items"`);
    await queryRunner.query(`DROP TABLE "we_group_members"`);
    await queryRunner.query(`DROP TABLE "we_groups"`);
  }
}
