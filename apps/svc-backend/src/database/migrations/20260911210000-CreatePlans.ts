import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePlans20260911210000 implements MigrationInterface {
  name = "CreatePlans20260911210000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "plans" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "hostUserId" uuid NOT NULL, "eventId" uuid NOT NULL, "meetingPoint" character varying(300) NOT NULL, "meetingAt" TIMESTAMP WITH TIME ZONE NOT NULL, "chatLink" character varying, "reminderSentAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "FK_plans_host" FOREIGN KEY ("hostUserId") REFERENCES "users"("id") ON DELETE CASCADE, CONSTRAINT "FK_plans_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE, CONSTRAINT "PK_plans" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "plan_participants" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "planId" uuid NOT NULL, "userId" uuid NOT NULL, "status" character varying NOT NULL, "reminderSentAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_plan_participants_status" CHECK ("status" IN ('invited', 'confirmed', 'declined')), CONSTRAINT "FK_plan_participants_plan" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE, CONSTRAINT "FK_plan_participants_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE, CONSTRAINT "PK_plan_participants" PRIMARY KEY ("id"), CONSTRAINT "UQ_plan_participants_plan_user" UNIQUE ("planId", "userId"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "plan_participants"`);
    await queryRunner.query(`DROP TABLE "plans"`);
  }
}
