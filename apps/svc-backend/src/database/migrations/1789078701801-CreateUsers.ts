import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUsers1789078701801 implements MigrationInterface {
  name = "CreateUsers1789078701801";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "maxUserId" character varying NOT NULL, "firstName" character varying NOT NULL, "lastName" character varying, "avatarUrl" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_cafa5bdc0c369bc67e1e2755e95" UNIQUE ("maxUserId"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
