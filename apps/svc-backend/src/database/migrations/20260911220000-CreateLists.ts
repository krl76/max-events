import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateLists20260911220000 implements MigrationInterface {
  name = "CreateLists20260911220000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "lists" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "preset" character varying, "title" character varying(200) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_lists_preset" CHECK ("preset" IS NULL OR "preset" IN ('want_to_go', 'favorites', 'weekend', 'with_children', 'with_friends', 'try_later')), CONSTRAINT "FK_lists_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE, CONSTRAINT "PK_lists" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_lists_user_preset" ON "lists" ("userId", "preset") WHERE "preset" IS NOT NULL`);
    await queryRunner.query(
      `CREATE TABLE "list_items" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "listId" uuid NOT NULL, "eventId" uuid, "placeId" uuid, "addedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_list_items_target" CHECK (("eventId" IS NOT NULL AND "placeId" IS NULL) OR ("eventId" IS NULL AND "placeId" IS NOT NULL)), CONSTRAINT "FK_list_items_list" FOREIGN KEY ("listId") REFERENCES "lists"("id") ON DELETE CASCADE, CONSTRAINT "FK_list_items_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE, CONSTRAINT "FK_list_items_place" FOREIGN KEY ("placeId") REFERENCES "places"("id") ON DELETE CASCADE, CONSTRAINT "PK_list_items" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_list_items_list_event" ON "list_items" ("listId", "eventId") WHERE "eventId" IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_list_items_list_event"`);
    await queryRunner.query(`DROP TABLE "list_items"`);
    await queryRunner.query(`DROP INDEX "UQ_lists_user_preset"`);
    await queryRunner.query(`DROP TABLE "lists"`);
  }
}
