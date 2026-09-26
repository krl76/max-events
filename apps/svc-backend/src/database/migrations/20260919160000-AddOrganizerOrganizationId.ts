import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrganizerOrganizationId20260919160000 implements MigrationInterface {
  name = "AddOrganizerOrganizationId20260919160000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" ADD COLUMN "organizerOrganizationId" uuid`);
    await queryRunner.query(`ALTER TABLE "places" ADD COLUMN "organizerOrganizationId" uuid`);
    await queryRunner.query(`UPDATE "events" e SET "organizerOrganizationId" = o.id FROM "organizations" o WHERE o."organizerUserId" = e."organizerUserId" AND e."organizerUserId" IS NOT NULL`);
    await queryRunner.query(`UPDATE "places" p SET "organizerOrganizationId" = o.id FROM "organizations" o WHERE o."organizerUserId" = p."organizerUserId" AND p."organizerUserId" IS NOT NULL`);
    await queryRunner.query(`ALTER TABLE "events" ADD CONSTRAINT "FK_events_organizer_organization" FOREIGN KEY ("organizerOrganizationId") REFERENCES "organizations"("id") ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE "places" ADD CONSTRAINT "FK_places_organizer_organization" FOREIGN KEY ("organizerOrganizationId") REFERENCES "organizations"("id") ON DELETE SET NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "places" DROP CONSTRAINT "FK_places_organizer_organization"`);
    await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT "FK_events_organizer_organization"`);
    await queryRunner.query(`ALTER TABLE "places" DROP COLUMN "organizerOrganizationId"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "organizerOrganizationId"`);
  }
}
