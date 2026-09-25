import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateNotifications20260919150100 implements MigrationInterface {
  name = "CreateNotifications20260919150100";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "type" character varying NOT NULL, "actorUserId" uuid, "title" character varying(300) NOT NULL, "body" character varying(2000) NOT NULL DEFAULT '', "quote" character varying(300), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "readAt" TIMESTAMP WITH TIME ZONE, "link" jsonb, "actions" jsonb NOT NULL DEFAULT '[]', "deadlineAt" TIMESTAMP WITH TIME ZONE, "answeredActionId" character varying(80), "urgent" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_notifications" PRIMARY KEY ("id"), CONSTRAINT "FK_notifications_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE, CONSTRAINT "FK_notifications_actor" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL)`);
    await queryRunner.query(`CREATE INDEX "IDX_notifications_user_created" ON "notifications" ("userId", "createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_notifications_user_created"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
  }
}
