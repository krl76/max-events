import { MigrationInterface, QueryRunner } from "typeorm";

export class AddListMembers20260919150000 implements MigrationInterface {
  name = "AddListMembers20260919150000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "list_members" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "listId" uuid NOT NULL, "userId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_list_members" PRIMARY KEY ("id"), CONSTRAINT "UQ_list_members_list_user" UNIQUE ("listId", "userId"), CONSTRAINT "FK_list_members_list" FOREIGN KEY ("listId") REFERENCES "lists"("id") ON DELETE CASCADE, CONSTRAINT "FK_list_members_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE)`);
    await queryRunner.query(`ALTER TABLE "list_items" ADD COLUMN "addedByUserId" uuid`);
    await queryRunner.query(`ALTER TABLE "list_items" ADD CONSTRAINT "FK_list_items_added_by" FOREIGN KEY ("addedByUserId") REFERENCES "users"("id") ON DELETE SET NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "list_items" DROP CONSTRAINT "FK_list_items_added_by"`);
    await queryRunner.query(`ALTER TABLE "list_items" DROP COLUMN "addedByUserId"`);
    await queryRunner.query(`DROP TABLE "list_members"`);
  }
}
