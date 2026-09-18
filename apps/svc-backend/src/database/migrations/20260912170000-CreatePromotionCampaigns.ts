import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePromotionCampaigns20260912170000 implements MigrationInterface {
  name = "CreatePromotionCampaigns20260912170000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "promotion_campaigns" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "eventId" uuid NOT NULL, "organizerUserId" uuid NOT NULL, "type" character varying(32) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'active', "startsAt" TIMESTAMP WITH TIME ZONE NOT NULL, "endsAt" TIMESTAMP WITH TIME ZONE NOT NULL, "tariffCode" character varying(40) NOT NULL, "priceRub" integer NOT NULL, "paidAt" TIMESTAMP WITH TIME ZONE, "audience" jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "completedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_promotion_campaigns" PRIMARY KEY ("id"), CONSTRAINT "FK_promotion_campaigns_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE, CONSTRAINT "FK_promotion_campaigns_organizer" FOREIGN KEY ("organizerUserId") REFERENCES "users"("id") ON DELETE CASCADE)`);
    await queryRunner.query(`CREATE INDEX "IDX_promotion_campaigns_event_status" ON "promotion_campaigns" ("eventId", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_promotion_campaigns_type_status" ON "promotion_campaigns" ("type", "status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "promotion_campaigns"`);
  }
}
