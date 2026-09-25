import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Repair migration. CreateOrganizations20260916020000 was edited in place after the production
 * database had already applied its first version, which had no "organizerUserId" column: the
 * organization entity reads that column on every organizer login, so production fails where the
 * staging database (which ran the edited version) does not. Both statements are guarded, so a
 * database that already carries the column and its foreign key is left untouched.
 */
export class AddOrganizationOrganizerUserId20260919130000 implements MigrationInterface {
  name = "AddOrganizationOrganizerUserId20260919130000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "organizerUserId" uuid`);
    await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_organizations_organizer_user') THEN ALTER TABLE "organizations" ADD CONSTRAINT "FK_organizations_organizer_user" FOREIGN KEY ("organizerUserId") REFERENCES "users"("id") ON DELETE SET NULL; END IF; END $$`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Symmetric on purpose: a revert takes the column away wherever it came from, and the
    // CreateOrganizations revert that follows drops the table itself.
    await queryRunner.query(`ALTER TABLE "organizations" DROP CONSTRAINT IF EXISTS "FK_organizations_organizer_user"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "organizerUserId"`);
  }
}
