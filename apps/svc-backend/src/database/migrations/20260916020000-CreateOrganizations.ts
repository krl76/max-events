import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOrganizations20260916020000 implements MigrationInterface {
  name = "CreateOrganizations20260916020000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "organizations" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(200) NOT NULL, "contacts" character varying(300), "login" character varying(64) NOT NULL, "passwordHash" character varying(255) NOT NULL, "organizerUserId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_organizations" PRIMARY KEY ("id"), CONSTRAINT "UQ_organizations_login" UNIQUE ("login"), CONSTRAINT "FK_organizations_organizer_user" FOREIGN KEY ("organizerUserId") REFERENCES "users"("id") ON DELETE SET NULL)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "organizations"`);
  }
}
