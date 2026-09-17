import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCollections20260912070000 implements MigrationInterface {
  name = "CreateCollections20260912070000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "collections" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "ownerUserId" uuid NOT NULL, "title" character varying(200) NOT NULL, "chatLink" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_collections" PRIMARY KEY ("id"), CONSTRAINT "FK_collections_owner" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE)`);
    await queryRunner.query(`CREATE TABLE "collection_members" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "collectionId" uuid NOT NULL, "userId" uuid NOT NULL, CONSTRAINT "PK_collection_members" PRIMARY KEY ("id"), CONSTRAINT "UQ_collection_members" UNIQUE ("collectionId", "userId"), CONSTRAINT "FK_collection_members_collection" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE, CONSTRAINT "FK_collection_members_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE)`);
    await queryRunner.query(`CREATE TABLE "collection_items" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "collectionId" uuid NOT NULL, "eventId" uuid NOT NULL, "section" character varying NOT NULL, "addedByUserId" uuid NOT NULL, "addedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_collection_items" PRIMARY KEY ("id"), CONSTRAINT "UQ_collection_items" UNIQUE ("collectionId", "eventId"), CONSTRAINT "FK_collection_items_collection" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE, CONSTRAINT "FK_collection_items_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE, CONSTRAINT "FK_collection_items_user" FOREIGN KEY ("addedByUserId") REFERENCES "users"("id") ON DELETE CASCADE)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "collection_items"`);
    await queryRunner.query(`DROP TABLE "collection_members"`);
    await queryRunner.query(`DROP TABLE "collections"`);
  }
}
