import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePromoCampaigns20260912161000 implements MigrationInterface {
  name = "CreatePromoCampaigns20260912161000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "promo_campaigns" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "eventId" uuid NOT NULL, "organizerUserId" uuid NOT NULL, "type" character varying(32) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'active', "code" character varying(40) NOT NULL, "title" character varying(200) NOT NULL, "maxFulfillments" integer, "fulfillmentCount" integer NOT NULL DEFAULT 0, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "completedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_promo_campaigns" PRIMARY KEY ("id"), CONSTRAINT "UQ_promo_campaigns_event_code" UNIQUE ("eventId", "code"), CONSTRAINT "FK_promo_campaigns_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE, CONSTRAINT "FK_promo_campaigns_organizer" FOREIGN KEY ("organizerUserId") REFERENCES "users"("id") ON DELETE CASCADE)`);
    await queryRunner.query(`CREATE TABLE "promo_fulfillments" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "campaignId" uuid NOT NULL, "referredUserId" uuid NOT NULL, "bookingId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_promo_fulfillments" PRIMARY KEY ("id"), CONSTRAINT "UQ_promo_fulfillments_campaign_user" UNIQUE ("campaignId", "referredUserId"), CONSTRAINT "UQ_promo_fulfillments_campaign_booking" UNIQUE ("campaignId", "bookingId"), CONSTRAINT "FK_promo_fulfillments_campaign" FOREIGN KEY ("campaignId") REFERENCES "promo_campaigns"("id") ON DELETE CASCADE, CONSTRAINT "FK_promo_fulfillments_user" FOREIGN KEY ("referredUserId") REFERENCES "users"("id") ON DELETE CASCADE, CONSTRAINT "FK_promo_fulfillments_booking" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "promo_fulfillments"`);
    await queryRunner.query(`DROP TABLE "promo_campaigns"`);
  }
}
