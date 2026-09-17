import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateFriendships20260911190000 implements MigrationInterface {
  name = "CreateFriendships20260911190000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "friendships" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "friendUserId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_friendships_not_self" CHECK ("userId" <> "friendUserId"), CONSTRAINT "FK_friendships_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE, CONSTRAINT "FK_friendships_friend" FOREIGN KEY ("friendUserId") REFERENCES "users"("id") ON DELETE CASCADE, CONSTRAINT "PK_friendships" PRIMARY KEY ("id"), CONSTRAINT "UQ_friendships_user_friend" UNIQUE ("userId", "friendUserId"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "friendships"`);
  }
}
